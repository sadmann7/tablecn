"use cache";

import { and, asc, count, desc, gt, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import "server-only";

import type { InferDataTableQuery } from "@/lib/data-table-config";

import { db } from "@/db";
import { tasks } from "@/db/schema";

import type { tasksTableConfig } from "./validations";

import { filterColumns } from "./filter-columns";
import { encodeTasksCursor, type TasksCursor } from "./tasks-cursor";
import { sanitizeEnumFilters } from "./utils";

export async function getTasks(
  input: InferDataTableQuery<typeof tasksTableConfig>,
) {
  cacheLife({ revalidate: 1, stale: 1, expire: 60 });
  cacheTag("tasks");

  try {
    const offset = (input.page - 1) * input.perPage;

    const where = filterColumns({
      table: tasks,
      filters: sanitizeEnumFilters(input.filters),
      joinOperator: input.joinOperator,
    });

    const { data, total } = await db.transaction(async (tx) => {
      const data = await tx
        .select()
        .from(tasks)
        .limit(input.perPage)
        .offset(offset)
        .where(where)
        .orderBy(
          ...(input.sorting.length > 0
            ? input.sorting.map((item) =>
                item.desc ? desc(tasks[item.id]) : asc(tasks[item.id]),
              )
            : [asc(tasks.createdAt)]),
          asc(tasks.id),
        );

      const total = await tx
        .select({
          count: count(),
        })
        .from(tasks)
        .where(where)
        .execute()
        .then((res) => res[0]?.count ?? 0);

      return {
        data,
        total,
      };
    });

    const pageCount = Math.ceil(total / input.perPage);
    return { data, pageCount, rowCount: total };
  } catch {
    return { data: [], pageCount: 0, rowCount: 0 };
  }
}

export async function getTasksAfter(
  input: InferDataTableQuery<typeof tasksTableConfig>,
  cursor: TasksCursor | null,
) {
  cacheLife({ revalidate: 1, stale: 1, expire: 60 });
  cacheTag("tasks");

  const isDesc = input.sorting[0]?.desc ?? true;
  const order = isDesc ? desc : asc;
  const where = filterColumns({
    table: tasks,
    filters: sanitizeEnumFilters(input.filters),
    joinOperator: input.joinOperator,
  });
  const after = cursor
    ? isDesc
      ? sql`(${tasks.createdAt}, ${tasks.id}) < (${cursor.createdAt}::timestamp, ${cursor.id})`
      : sql`(${tasks.createdAt}, ${tasks.id}) > (${cursor.createdAt}::timestamp, ${cursor.id})`
    : undefined;

  const { rows, total } = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        task: tasks,
        createdAtKey: sql<string>`${tasks.createdAt}::text`,
      })
      .from(tasks)
      .where(and(where, after))
      .orderBy(order(tasks.createdAt), order(tasks.id))
      .limit(input.perPage + 1);

    const total = await tx
      .select({ count: count() })
      .from(tasks)
      .where(where)
      .then((res) => res[0]?.count ?? 0);

    return { rows, total };
  });

  const page = rows.slice(0, input.perPage);
  const last = page.at(-1);
  const nextCursor =
    rows.length > input.perPage && last
      ? encodeTasksCursor({ createdAt: last.createdAtKey, id: last.task.id })
      : null;

  return { data: page.map((row) => row.task), rowCount: total, nextCursor };
}

export async function getRecentTasks() {
  cacheLife({ revalidate: 1, stale: 1, expire: 60 });
  cacheTag("tasks");

  try {
    return await db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.createdAt))
      .limit(1000);
  } catch {
    return [];
  }
}

export async function getTaskStatusCounts() {
  cacheLife("hours");
  cacheTag("task-status-counts");

  try {
    return await db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .groupBy(tasks.status)
      .having(gt(count(tasks.status), 0))
      .then((res) =>
        res.reduce(
          (acc, { status, count }) => {
            acc[status] = count;
            return acc;
          },
          {
            todo: 0,
            "in-progress": 0,
            done: 0,
            canceled: 0,
          },
        ),
      );
  } catch {
    return {
      todo: 0,
      "in-progress": 0,
      done: 0,
      canceled: 0,
    };
  }
}

export async function getTaskPriorityCounts() {
  cacheLife("hours");
  cacheTag("task-priority-counts");

  try {
    return await db
      .select({
        priority: tasks.priority,
        count: count(),
      })
      .from(tasks)
      .groupBy(tasks.priority)
      .having(gt(count(), 0))
      .then((res) =>
        res.reduce(
          (acc, { priority, count }) => {
            acc[priority] = count;
            return acc;
          },
          {
            low: 0,
            medium: 0,
            high: 0,
          },
        ),
      );
  } catch {
    return {
      low: 0,
      medium: 0,
      high: 0,
    };
  }
}

export async function getEstimatedHoursRange() {
  cacheLife("hours");
  cacheTag("estimated-hours-range");

  try {
    return await db
      .select({
        min: sql<number>`min(${tasks.estimatedHours})`,
        max: sql<number>`max(${tasks.estimatedHours})`,
      })
      .from(tasks)
      .then((res) => res[0] ?? { min: 0, max: 0 });
  } catch {
    return { min: 0, max: 0 };
  }
}
