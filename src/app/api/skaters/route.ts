import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  deleteSkatersSchema,
  insertSkaterSchema,
  insertSkatersSchema,
  updateSkatersSchema,
} from "@/app/data-grid-live/lib/validation";
import { db } from "@/db";
import { type Skater, skaters } from "@/db/schema";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  try {
    const allSkaters = await db.select().from(skaters);
    return NextResponse.json(allSkaters);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to fetch skaters" },
      { status: 500 },
    );
  }
}

// Supports both single insert and bulk insert
// Single: { name, email, ... }
// Bulk: { skaters: [{ name, email, ... }, ...] }
export async function POST(request: Request) {
  const rateLimit = await checkRateLimit();
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body: unknown = await request.json();

    // Try bulk insert first
    const bulkResult = insertSkatersSchema.safeParse(body);
    if (bulkResult.success) {
      const newSkaters = await db
        .insert(skaters)
        .values(bulkResult.data.skaters)
        .returning();

      return NextResponse.json({
        inserted: newSkaters.length,
        skaters: newSkaters,
      });
    }

    // Try single insert
    const singleResult = insertSkaterSchema.safeParse(body);
    if (!singleResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: singleResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const newSkater = await db
      .insert(skaters)
      .values(singleResult.data)
      .returning()
      .then((res) => res[0]);

    return NextResponse.json(newSkater);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to create skater" },
      { status: 500 },
    );
  }
}

// Bulk update endpoint
// Body: { updates: [{ id, changes: { status?, style?, ... } }, ...] }
export async function PATCH(request: Request) {
  const rateLimit = await checkRateLimit();
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body: unknown = await request.json();

    const result = updateSkatersSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const { updates } = result.data;
    // Zod schema guarantees min 1 element, but we check anyway for type safety
    const firstUpdate = updates.at(0);
    if (!firstUpdate) {
      return NextResponse.json(
        { error: "updates array is empty" },
        { status: 400 },
      );
    }

    // Single update - just update directly
    if (updates.length === 1) {
      const [updated] = await db
        .update(skaters)
        .set(firstUpdate.changes)
        .where(eq(skaters.id, firstUpdate.id))
        .returning();

      return NextResponse.json({ updated: updated ? 1 : 0 });
    }

    // Group updates by the same changes for efficiency
    // If all updates have the same changes, we can do a single query
    const firstChanges = JSON.stringify(firstUpdate.changes);
    const allSameChanges = updates.every(
      (u) => JSON.stringify(u.changes) === firstChanges,
    );

    if (allSameChanges) {
      // All updates have the same changes - use single query with IN clause
      const ids = updates.map((u) => u.id);

      const updated = await db
        .update(skaters)
        .set(firstUpdate.changes)
        .where(inArray(skaters.id, ids))
        .returning();

      return NextResponse.json({ updated: updated.length });
    }

    // Different changes per row - need individual updates (but in a transaction)
    const results = await db.transaction(async (tx) => {
      const updated: Skater[] = [];
      for (const { id, changes } of updates) {
        const [updateResult] = await tx
          .update(skaters)
          .set(changes)
          .where(eq(skaters.id, id))
          .returning();
        if (updateResult) updated.push(updateResult);
      }
      return updated;
    });

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to update skaters" },
      { status: 500 },
    );
  }
}

// Bulk delete endpoint
// Body: { ids: string[] }
export async function DELETE(request: Request) {
  const rateLimit = await checkRateLimit();
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body: unknown = await request.json();

    const result = deleteSkatersSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const deletedSkaters = await db
      .delete(skaters)
      .where(inArray(skaters.id, result.data.ids))
      .returning();

    return NextResponse.json({ deleted: deletedSkaters.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to delete skaters" },
      { status: 500 },
    );
  }
}
