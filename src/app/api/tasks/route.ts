import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  deleteTasksSchema,
  insertTaskSchema,
  insertTasksSchema,
  updateTasksSchema,
} from "@/app/data-grid-live/lib/validation";
import { db } from "@/db";
import { type Task, tasks } from "@/db/schema";

export async function GET() {
  try {
    const allTasks = await db.select().from(tasks);
    return NextResponse.json(allTasks);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 },
    );
  }
}

// Supports both single insert and bulk insert
// Single: { code, title, ... }
// Bulk: { tasks: [{ code, title, ... }, ...] }
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    // Try bulk insert first
    const bulkResult = insertTasksSchema.safeParse(body);
    if (bulkResult.success) {
      const newTasks = await db
        .insert(tasks)
        .values(bulkResult.data.tasks)
        .returning();

      return NextResponse.json({ inserted: newTasks.length, tasks: newTasks });
    }

    // Try single insert
    const singleResult = insertTaskSchema.safeParse(body);
    if (!singleResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: singleResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const newTask = await db
      .insert(tasks)
      .values(singleResult.data)
      .returning()
      .then((res) => res[0]);

    return NextResponse.json(newTask);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 },
    );
  }
}

// Bulk update endpoint
// Body: { updates: [{ id, changes: { status?, priority?, ... } }, ...] }
export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();

    const result = updateTasksSchema.safeParse(body);
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
        .update(tasks)
        .set(firstUpdate.changes)
        .where(eq(tasks.id, firstUpdate.id))
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
        .update(tasks)
        .set(firstUpdate.changes)
        .where(inArray(tasks.id, ids))
        .returning();

      return NextResponse.json({ updated: updated.length });
    }

    // Different changes per row - need individual updates (but in a transaction)
    const results = await db.transaction(async (tx) => {
      const updated: Task[] = [];
      for (const { id, changes } of updates) {
        const [updateResult] = await tx
          .update(tasks)
          .set(changes)
          .where(eq(tasks.id, id))
          .returning();
        if (updateResult) updated.push(updateResult);
      }
      return updated;
    });

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to update tasks" },
      { status: 500 },
    );
  }
}

// Bulk delete endpoint
// Body: { ids: string[] }
export async function DELETE(request: Request) {
  try {
    const body: unknown = await request.json();

    const result = deleteTasksSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const deletedTasks = await db
      .delete(tasks)
      .where(inArray(tasks.id, result.data.ids))
      .returning();

    return NextResponse.json({ deleted: deletedTasks.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to delete tasks" },
      { status: 500 },
    );
  }
}
