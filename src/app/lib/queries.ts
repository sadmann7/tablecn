"use cache";

import "server-only";

import {
  and,
  asc,
  count,
  desc,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { tasks } from "@/db/schema";

import { filterColumns } from "@/lib/filter-columns";

import type { GetTasksSchema } from "./validations";

export async function getTasks(input: GetTasksSchema) {
  cacheLife({ revalidate: 1, stale: 1, expire: 60 });
  cacheTag("tasks");

  try {
    const offset = (input.page - 1) * input.perPage;
    const advancedTable =
      input.filterFlag === "advancedFilters" ||
      input.filterFlag === "commandFilters";

    const advancedWhere = filterColumns({
      table: tasks,
      filters: input.filters,
      joinOperator: input.joinOperator,
    });

    const where = advancedTable
      ? advancedWhere
      : and(
          input.title ? ilike(tasks.title, `%${input.title}%`) : undefined,
          input.status.length > 0
            ? inArray(tasks.status, input.status)
            : undefined,
          input.priority.length > 0
            ? inArray(tasks.priority, input.priority)
            : undefined,
          input.estimatedHours.length > 0
            ? and(
                input.estimatedHours[0]
                  ? gte(tasks.estimatedHours, input.estimatedHours[0])
                  : undefined,
                input.estimatedHours[1]
                  ? lte(tasks.estimatedHours, input.estimatedHours[1])
                  : undefined,
              )
            : undefined,
          input.createdAt.length > 0
            ? and(
                input.createdAt[0]
                  ? gte(
                      tasks.createdAt,
                      (() => {
                        const date = new Date(input.createdAt[0]);
                        date.setHours(0, 0, 0, 0);
                        return date;
                      })(),
                    )
                  : undefined,
                input.createdAt[1]
                  ? lte(
                      tasks.createdAt,
                      (() => {
                        const date = new Date(input.createdAt[1]);
                        date.setHours(23, 59, 59, 999);
                        return date;
                      })(),
                    )
                  : undefined,
              )
            : undefined,
        );

    const orderBy =
      input.sort.length > 0
        ? input.sort.map((item) =>
            item.desc ? desc(tasks[item.id]) : asc(tasks[item.id]),
          )
        : [asc(tasks.createdAt)];

    const { data, total } = await db.transaction(async (tx) => {
      const data = await tx
        .select()
        .from(tasks)
        .limit(input.perPage)
        .offset(offset)
        .where(where)
        .orderBy(...orderBy);

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
