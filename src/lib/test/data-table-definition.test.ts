import { describe, expect, expectTypeOf, it } from "vitest";

import { tasksTable } from "@/app/lib/validations";
import {
  defineDataTable,
  getColumnConfigOptions,
  getDataTableUrlKeys,
  type InferDataTableQuery,
} from "@/lib/data-table-definition";

describe("defineDataTable", () => {
  it("applies defaults and keeps plain URL keys without an id", () => {
    const table = defineDataTable({ columns: { title: { variant: "text" } } });

    expect(table.id).toBeUndefined();
    expect(table.defaultSorting).toEqual([]);
    expect(table.defaultPageSize).toBe(10);
    expect(table.urlKeys).toEqual({
      page: "page",
      perPage: "perPage",
      sort: "sort",
      joinOperator: "joinOperator",
      search: "search",
      title: "title",
    });
    expect(Object.isFrozen(table)).toBe(true);
  });

  it("namespaces every URL key with the id", () => {
    const table = defineDataTable({
      id: "tasks",
      columns: { title: { variant: "text" }, code: { enableSorting: false } },
    });

    expect(table.urlKeys).toEqual({
      page: "tasks.page",
      perPage: "tasks.perPage",
      sort: "tasks.sort",
      joinOperator: "tasks.joinOperator",
      search: "tasks.search",
      title: "tasks.title",
    });
  });

  it("rejects a filterable column named after a built-in key", () => {
    expect(() =>
      defineDataTable({
        // @ts-expect-error a filterable column can't use a built-in key
        columns: { search: { variant: "text" } },
      }),
    ).toThrow('column id "search" is reserved');
  });

  it("allows a built-in key for a column without a filter", () => {
    expect(() =>
      defineDataTable({ columns: { page: { enableSorting: false } } }),
    ).not.toThrow();
  });

  it("rejects an empty id", () => {
    expect(() =>
      defineDataTable({ id: "", columns: { title: { variant: "text" } } }),
    ).toThrow("must not be empty");
  });
});

describe("parse", () => {
  it("returns the defaults for an empty URL", () => {
    expect(tasksTable.parse("?page=no")).toEqual({
      page: 1,
      perPage: 10,
      sorting: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
      globalFilter: "",
    });
  });

  it("joins per-column params in column order and drops empty filters", () => {
    const query = tasksTable.parse(
      "?status=not.in.todo&estimatedHours=gte.2&estimatedHours=LTE.8&title=ilike.the&createdAt=2026-01-01,2026-12-31&priority=bogus.xyz&joinOperator=or&title=",
    );

    expect(query.joinOperator).toBe("or");
    expect(
      query.filters.map((filter) => [filter.id, filter.operator, filter.value]),
    ).toEqual([
      ["title", "iLike", "the"],
      ["status", "notInArray", ["todo"]],
      ["priority", "inArray", ["bogus.xyz"]],
      ["estimatedHours", "gte", "2"],
      ["estimatedHours", "lte", "8"],
      ["createdAt", "isBetween", ["2026-01-01", "2026-12-31"]],
    ]);
  });

  it("falls back to and for an unknown join operator", () => {
    expect(tasksTable.parse("?joinOperator=xor").joinOperator).toBe("and");
  });

  it("passes the global filter through", () => {
    expect(tasksTable.parse("?search=login%20bug").globalFilter).toBe(
      "login bug",
    );
  });

  it("reads custom defaults and a record of search params", () => {
    const table = defineDataTable({
      columns: tasksTable.columns,
      defaultPageSize: 25,
    });

    expect(table.parse({ page: "2" })).toMatchObject({
      page: 2,
      perPage: 25,
      sorting: [],
    });
  });

  it("reads only the keys of its own id", () => {
    const first = defineDataTable({ id: "a", columns: tasksTable.columns });
    const second = defineDataTable({ id: "b", columns: tasksTable.columns });
    const search = "?a.page=2&a.status=todo&b.search=bug&page=9&status=done";

    expect(first.parse(search)).toMatchObject({
      page: 2,
      globalFilter: "",
      filters: [expect.objectContaining({ id: "status", value: ["todo"] })],
    });
    expect(second.parse(search)).toMatchObject({
      page: 1,
      globalFilter: "bug",
      filters: [],
    });
  });

  it("types filters and sorting by column id", () => {
    type Query = InferDataTableQuery<typeof tasksTable>;

    expectTypeOf<Query["filters"][number]["id"]>().toEqualTypeOf<
      "title" | "status" | "priority" | "estimatedHours" | "createdAt"
    >();
    expectTypeOf<Query["sorting"][number]["id"]>().toEqualTypeOf<
      "title" | "status" | "priority" | "estimatedHours" | "createdAt"
    >();
  });
});

describe("getColumnConfigOptions", () => {
  it("maps a column config to TanStack column options", () => {
    expect(getColumnConfigOptions(tasksTable.columns.code)).toEqual({
      meta: {},
      enableColumnFilter: false,
      enableSorting: false,
    });
    expect(getColumnConfigOptions(tasksTable.columns.createdAt)).toEqual({
      meta: { variant: "date", filter: "range" },
      enableColumnFilter: true,
      enableSorting: true,
    });
  });
});

describe("getDataTableUrlKeys", () => {
  it("rejects a filterable column named after a built-in key", () => {
    expect(() => getDataTableUrlKeys(["page"])).toThrow(
      'column id "page" is reserved',
    );
  });
});
