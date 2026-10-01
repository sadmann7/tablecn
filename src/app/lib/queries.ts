"use cache";

import { asc, count, desc, gt, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import "server-only";

import type { DataTableQuery } from "@/lib/data-table-types";

import { db } from "@/db";
import { tasks } from "@/db/schema";

import type {
  tasksFilterableColumns,
  tasksSortableColumns,
} from "./validations";

import { filterColumns } from "./filter-columns";
import { sanitizeEnumFilters } from "./utils";

export async function getTasks(
  input: DataTableQuery<
    keyof typeof tasksFilterableColumns,
    (typeof tasksSortableColumns)[number]
  >,
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
    return { data, pageCount };
  } catch {
    return { data: [], pageCount: 0 };
  }
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
