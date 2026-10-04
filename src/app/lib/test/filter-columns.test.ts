import { addDays, endOfDay, startOfDay } from "date-fns";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { ColumnFilterItem, JoinOperator } from "@/lib/data-table-types";

import { filterColumns, getColumn } from "@/app/lib/filter-columns";
import { type Task, tasks } from "@/db/schema";

const dialect = new PgDialect();

type TaskColumnId = keyof Task;

function columnFilter(
  filter: Omit<ColumnFilterItem<TaskColumnId>, "filterId"> & {
    filterId?: string;
  },
): ColumnFilterItem<TaskColumnId> {
  return { filterId: `${filter.id}-0`, ...filter };
}

function compile(
  filters: ColumnFilterItem<TaskColumnId>[],
  joinOperator: JoinOperator = "and",
) {
  const statement = filterColumns({ table: tasks, filters, joinOperator });
  if (!statement) return undefined;
  return dialect.sqlToQuery(statement);
}

describe("filterColumns", () => {
  it("returns the column from the table", () => {
    expect(getColumn(tasks, "title")).toBe(tasks.title);
  });

  it("returns nothing when no filter produces a condition", () => {
    expect(compile([])).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "number",
          operator: "iLike",
          value: "2",
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "eq",
          value: "2026-02-30",
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "status",
          variant: "multiSelect",
          operator: "inArray",
          value: "todo",
        }),
      ]),
    ).toBeUndefined();
  });

  it("compares text, booleans, numbers, and lists", () => {
    expect(
      compile([
        columnFilter({
          id: "title",
          variant: "text",
          operator: "iLike",
          value: "the",
        }),
      ])?.params,
    ).toEqual(["%the%"]);
    expect(
      compile([
        columnFilter({
          id: "title",
          variant: "text",
          operator: "notILike",
          value: "the",
        }),
      ])?.sql.toLowerCase(),
    ).toContain("not");
    expect(
      compile([
        columnFilter({
          id: "title",
          variant: "text",
          operator: "eq",
          value: "bug",
        }),
      ])?.params,
    ).toEqual(["bug"]);
    expect(
      compile([
        columnFilter({
          id: "archived",
          variant: "boolean",
          operator: "eq",
          value: "true",
        }),
      ])?.params,
    ).toEqual([true]);
    expect(
      compile([
        columnFilter({
          id: "archived",
          variant: "boolean",
          operator: "ne",
          value: "false",
        }),
      ])?.params,
    ).toEqual([false]);
    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "number",
          operator: "lt",
          value: "3",
        }),
      ])?.params,
    ).toEqual(["3"]);
    expect(
      compile([
        columnFilter({
          id: "status",
          variant: "multiSelect",
          operator: "inArray",
          value: ["todo", "done"],
        }),
      ])?.params,
    ).toEqual(["todo", "done"]);
    expect(
      compile([
        columnFilter({
          id: "status",
          variant: "multiSelect",
          operator: "notInArray",
          value: ["todo"],
        }),
      ])?.sql.toLowerCase(),
    ).toContain("not");
  });

  it("bounds a calendar day for date comparisons", () => {
    const day = "2026-10-03";
    const start = startOfDay(new Date(2026, 9, 3));
    const end = endOfDay(start);

    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "eq",
          value: day,
        }),
      ])?.params,
    ).toEqual([start.toISOString(), end.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "dateRange",
          operator: "ne",
          value: day,
        }),
      ])?.params,
    ).toEqual([start.toISOString(), end.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "lt",
          value: day,
        }),
      ])?.params,
    ).toEqual([start.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "lte",
          value: day,
        }),
      ])?.params,
    ).toEqual([end.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "gt",
          value: day,
        }),
      ])?.params,
    ).toEqual([end.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "gte",
          value: day,
        }),
      ])?.params,
    ).toEqual([start.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "dateRange",
          operator: "lt",
          value: day,
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "lt",
          value: ["2026-10-03"],
        }),
      ]),
    ).toBeUndefined();
  });

  it("leaves an open number or date bound out of between", () => {
    const start = startOfDay(new Date(2026, 9, 1));
    const end = endOfDay(new Date(2026, 9, 7));

    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "range",
          operator: "isBetween",
          value: ["2", "8"],
        }),
      ])?.params,
    ).toEqual([2, 8]);
    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "number",
          operator: "isBetween",
          value: ["", "3"],
        }),
      ])?.params,
    ).toEqual([3]);
    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "range",
          operator: "isBetween",
          value: ["2", ""],
        }),
      ])?.params,
    ).toEqual([2]);
    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "range",
          operator: "isBetween",
          value: ["", ""],
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "range",
          operator: "isBetween",
          value: "2",
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "dateRange",
          operator: "isBetween",
          value: ["2026-10-01", "2026-10-07"],
        }),
      ])?.params,
    ).toEqual([start.toISOString(), end.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "isBetween",
          value: ["", "2026-10-07"],
        }),
      ])?.params,
    ).toEqual([end.toISOString()]);
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "isBetween",
          value: ["nope", "nope"],
        }),
      ]),
    ).toBeUndefined();
  });

  it("counts days, weeks, and months from today", () => {
    const today = new Date();

    const tomorrow = startOfDay(addDays(today, 1));
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "isRelativeToToday",
          value: "1 days",
        }),
      ])?.params,
    ).toEqual([tomorrow.toISOString(), endOfDay(tomorrow).toISOString()]);

    const nextWeek = startOfDay(addDays(today, 7));
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "dateRange",
          operator: "isRelativeToToday",
          value: "1 weeks",
        }),
      ])?.params,
    ).toEqual([
      nextWeek.toISOString(),
      endOfDay(addDays(nextWeek, 6)).toISOString(),
    ]);

    const nextMonth = startOfDay(addDays(today, 30));
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "isRelativeToToday",
          value: "1 months",
        }),
      ])?.params,
    ).toEqual([
      nextMonth.toISOString(),
      endOfDay(addDays(nextMonth, 29)).toISOString(),
    ]);

    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "isRelativeToToday",
          value: "1",
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "date",
          operator: "isRelativeToToday",
          value: "1 years",
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "createdAt",
          variant: "number",
          operator: "isRelativeToToday",
          value: "1 days",
        }),
      ]),
    ).toBeUndefined();
    expect(
      compile([
        columnFilter({
          id: "estimatedHours",
          variant: "number",
          operator: "isRelativeToToday",
          value: ["1 days"],
        }),
      ]),
    ).toBeUndefined();
  });

  it("matches empty and non-empty values", () => {
    const title = compile([
      columnFilter({
        id: "title",
        variant: "text",
        operator: "isEmpty",
        value: "",
      }),
    ])?.sql;
    expect(title).toContain("is null");
    expect(title).toContain("''");

    const archived = compile([
      columnFilter({
        id: "archived",
        variant: "boolean",
        operator: "isEmpty",
        value: "",
      }),
    ])?.sql;
    expect(archived).toContain("is null");
    expect(archived).not.toContain("''");

    expect(
      compile([
        columnFilter({
          id: "title",
          variant: "text",
          operator: "isNotEmpty",
          value: "",
        }),
      ])?.sql.toLowerCase(),
    ).toContain("not");
  });

  it("joins conditions with and or or", () => {
    const filters = [
      columnFilter({
        id: "title",
        variant: "text",
        operator: "eq",
        value: "bug",
      }),
      columnFilter({
        id: "status",
        variant: "multiSelect",
        operator: "inArray",
        value: ["todo"],
        filterId: "status-0",
      }),
    ];

    expect(compile(filters, "and")?.sql.toLowerCase()).toContain("and");
    expect(compile(filters, "or")?.sql.toLowerCase()).toContain("or");
  });

  it("rejects an operator it cannot compile", () => {
    expect(() =>
      compile([
        columnFilter({
          id: "title",
          variant: "text",
          operator: "nope" as ColumnFilterItem["operator"],
          value: "bug",
        }),
      ]),
    ).toThrow("Unsupported operator");
  });
});
