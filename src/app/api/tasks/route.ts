import type { NextRequest } from "next/server";

import type { DataResult } from "@/lib/data-table-types";

import { getTasks, getTasksAfter } from "@/app/lib/queries";
import { decodeTasksCursor } from "@/app/lib/tasks-cursor";
import { tasksTableConfig } from "@/app/lib/validations";
import { type Task } from "@/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = tasksTableConfig.parse(searchParams);
  const cursorParam = searchParams.get("cursor");

  if (cursorParam === null) {
    const { data, rowCount } = await getTasks(query);
    return Response.json({ rows: data, rowCount } satisfies DataResult<Task>);
  }

  if (query.sorting.some((item) => item.id !== "createdAt")) {
    return Response.json(
      { error: "Cursor pagination sorts by createdAt only." },
      { status: 400 },
    );
  }

  const cursor = cursorParam === "" ? null : decodeTasksCursor(cursorParam);
  if (cursorParam !== "" && !cursor) {
    return Response.json({ error: "Invalid cursor." }, { status: 400 });
  }

  const { data, rowCount, nextCursor } = await getTasksAfter(query, cursor);
  return Response.json({
    rows: data,
    rowCount,
    nextCursor,
  } satisfies DataResult<Task>);
}
