import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { TaskSchema } from "@/app/data-grid-live/lib/validation";
import { db } from "@/db";
import { tasks } from "@/db/schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<TaskSchema>;

    console.log("PATCH /api/tasks/[id]:", { id, body });

    // Remove fields that shouldn't be updated by the client
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...updateData
    } = body;

    console.log("Updating task with:", updateData);

    const updatedTask = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning()
      .then((res) => res[0]);

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const deletedTask = await db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning()
      .then((res) => res[0]);

    if (!deletedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(deletedTask);
  } catch (error) {
    console.error({ error });
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 },
    );
  }
}
