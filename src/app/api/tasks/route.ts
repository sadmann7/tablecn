import type { NextRequest } from "next/server";

import type { DataResult } from "@/lib/data-table-types";

import { getTasks } from "@/app/lib/queries";
import { tasksTableConfig } from "@/app/lib/validations";
import { type Task } from "@/db/schema";

export async function GET(request: NextRequest) {
  const { data, rowCount } = await getTasks(
    tasksTableConfig.parse(request.nextUrl.searchParams),
  );

  return Response.json({ rows: data, rowCount } satisfies DataResult<Task>);
}
