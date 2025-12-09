import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  deleteEmployeesSchema,
  insertEmployeeSchema,
  insertEmployeesSchema,
  updateEmployeesSchema,
} from "@/app/data-grid-live/lib/validation";
import { db } from "@/db";
import { type Employee, employees } from "@/db/schema";

export async function GET() {
  try {
    const allEmployees = await db.select().from(employees);
    return NextResponse.json(allEmployees);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}

// Supports both single insert and bulk insert
// Single: { name, email, ... }
// Bulk: { employees: [{ name, email, ... }, ...] }
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    // Try bulk insert first
    const bulkResult = insertEmployeesSchema.safeParse(body);
    if (bulkResult.success) {
      const newEmployees = await db
        .insert(employees)
        .values(bulkResult.data.employees)
        .returning();

      return NextResponse.json({
        inserted: newEmployees.length,
        employees: newEmployees,
      });
    }

    // Try single insert
    const singleResult = insertEmployeeSchema.safeParse(body);
    if (!singleResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: singleResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const newEmployee = await db
      .insert(employees)
      .values(singleResult.data)
      .returning()
      .then((res) => res[0]);

    return NextResponse.json(newEmployee);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to create employee" },
      { status: 500 },
    );
  }
}

// Bulk update endpoint
// Body: { updates: [{ id, changes: { status?, role?, ... } }, ...] }
export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();

    const result = updateEmployeesSchema.safeParse(body);
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
        .update(employees)
        .set(firstUpdate.changes)
        .where(eq(employees.id, firstUpdate.id))
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
        .update(employees)
        .set(firstUpdate.changes)
        .where(inArray(employees.id, ids))
        .returning();

      return NextResponse.json({ updated: updated.length });
    }

    // Different changes per row - need individual updates (but in a transaction)
    const results = await db.transaction(async (tx) => {
      const updated: Employee[] = [];
      for (const { id, changes } of updates) {
        const [updateResult] = await tx
          .update(employees)
          .set(changes)
          .where(eq(employees.id, id))
          .returning();
        if (updateResult) updated.push(updateResult);
      }
      return updated;
    });

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to update employees" },
      { status: 500 },
    );
  }
}

// Bulk delete endpoint
// Body: { ids: string[] }
export async function DELETE(request: Request) {
  try {
    const body: unknown = await request.json();

    const result = deleteEmployeesSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.flatten() },
        { status: 400 },
      );
    }

    const deletedEmployees = await db
      .delete(employees)
      .where(inArray(employees.id, result.data.ids))
      .returning();

    return NextResponse.json({ deleted: deletedEmployees.length });
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to delete employees" },
      { status: 500 },
    );
  }
}
