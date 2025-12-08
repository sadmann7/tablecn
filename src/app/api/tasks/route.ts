import { NextResponse } from "next/server";
import { db } from "@/db";
import { type NewTask, tasks } from "@/db/schema";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NewTask;
    const newTask = await db
      .insert(tasks)
      .values(body)
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
