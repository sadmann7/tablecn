import { describe, expect, expectTypeOf, it } from "vitest";

import { tasksTableConfig } from "@/app/lib/validations";
import {
  applyColumnConfig,
  createDataTableColumnHelper,
  createDataTableConfig,
  getColumnConfigs,
  type InferDataTableQuery,
} from "@/lib/data-table-config";

describe("createDataTableConfig", () => {
  it("applies defaults and keeps plain URL keys without an id", () => {
    const table = createDataTableConfig({
      columns: { title: { variant: "text" } },
    });

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
    const table = createDataTableConfig({
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
      createDataTableConfig({
        // @ts-expect-error a filterable column can't use a built-in key
        columns: { search: { variant: "text" } },
      }),
    ).toThrow('column id "search" is reserved');
  });

  it("filters columns with a variant and sorts unless opted out", () => {
    const table = createDataTableConfig({
      columns: {
        name: { variant: "text" },
        age: { variant: "number", filter: "range", enableSorting: false },
        id: { enableSorting: false },
        createdAt: {},
      },
    });

    expect(table.filterVariants).toEqual({ name: "text", age: "range" });
    expect(
      table.parse("?sort=name.asc,createdAt.desc").sorting.map(({ id }) => id),
    ).toEqual(["name", "createdAt"]);
    expect(table.parse("?sort=age.asc").sorting).toEqual([]);
    expect(table.parse("?sort=id.asc").sorting).toEqual([]);
  });

  it("allows a built-in key for a column without a filter", () => {
    expect(() =>
      createDataTableConfig({ columns: { page: { enableSorting: false } } }),
    ).not.toThrow();
  });

  it("rejects an empty id", () => {
    expect(() =>
      createDataTableConfig({
        id: "",
        columns: { title: { variant: "text" } },
      }),
    ).toThrow("must not be empty");
  });
});

describe("parse", () => {
  it("returns the defaults for an empty URL", () => {
    expect(tasksTableConfig.parse("?page=no")).toEqual({
      page: 1,
      perPage: 10,
      sorting: [{ id: "createdAt", desc: true }],
      filters: [],
      joinOperator: "and",
      globalFilter: "",
    });
  });

  it("joins per-column params in column order and drops empty filters", () => {
    const query = tasksTableConfig.parse(
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
    expect(tasksTableConfig.parse("?joinOperator=xor").joinOperator).toBe(
      "and",
    );
  });

  it("passes the global filter through when it is on", () => {
    const table = createDataTableConfig({ columns: tasksTableConfig.columns });

    expect(table.parse("?search=login%20bug").globalFilter).toBe("login bug");
    expect(tasksTableConfig.parse("?search=login%20bug").globalFilter).toBe("");
  });

  it("reads custom defaults and a record of search params", () => {
    const table = createDataTableConfig({
      columns: tasksTableConfig.columns,
      defaultPageSize: 25,
    });

    expect(table.parse({ page: "2" })).toMatchObject({
      page: 2,
      perPage: 25,
      sorting: [],
    });
  });

  it("reads only the keys of its own id", () => {
    const first = createDataTableConfig({
      id: "a",
      columns: tasksTableConfig.columns,
    });
    const second = createDataTableConfig({
      id: "b",
      columns: tasksTableConfig.columns,
    });
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

  it("reuses one config under different ids", () => {
    const search = "?open.page=2&open.status=todo&closed.page=3&page=9";
    const openTable = createDataTableConfig({
      ...tasksTableConfig,
      id: "open",
    });
    const closedTable = createDataTableConfig({
      ...tasksTableConfig,
      id: "closed",
    });

    expect(openTable.parse(search)).toMatchObject({
      page: 2,
      filters: [expect.objectContaining({ id: "status", value: ["todo"] })],
    });
    expect(closedTable.parse(search)).toMatchObject({
      page: 3,
      sorting: tasksTableConfig.defaultSorting,
      globalFilter: "",
      filters: [],
    });
    expect(tasksTableConfig.parse(search)).toMatchObject({ page: 9 });
  });

  it("ignores out-of-range pages and page sizes", () => {
    const table = createDataTableConfig({ columns: tasksTableConfig.columns });

    for (const search of ["?page=0", "?page=-3", "?page=abc"]) {
      expect(table.parse(search).page).toBe(1);
    }
    for (const search of ["?perPage=0", "?perPage=-5", "?perPage=1000000"]) {
      expect(table.parse(search).perPage).toBe(10);
    }
    expect(table.parse("?perPage=25").perPage).toBe(25);
  });

  it("uses the config's join operator and global filter settings", () => {
    const table = createDataTableConfig({
      columns: tasksTableConfig.columns,
      defaultJoinOperator: "or",
      enableGlobalFilter: false,
      pageSizeOptions: [5, 15],
    });

    expect(table.parse("?search=bug")).toMatchObject({
      joinOperator: "or",
      globalFilter: "",
    });
    expect(table.parse("?perPage=15").perPage).toBe(15);
    expect(table.parse("?perPage=20").perPage).toBe(10);
  });

  it("types filters and sorting by column id", () => {
    type Query = InferDataTableQuery<typeof tasksTableConfig>;

    expectTypeOf<Query["filters"][number]["id"]>().toEqualTypeOf<
      "title" | "status" | "priority" | "estimatedHours" | "createdAt"
    >();
    expectTypeOf<Query["sorting"][number]["id"]>().toEqualTypeOf<
      "title" | "status" | "priority" | "estimatedHours" | "createdAt"
    >();
    expectTypeOf<keyof typeof tasksTableConfig.filterVariants>().toEqualTypeOf<
      "title" | "status" | "priority" | "estimatedHours" | "createdAt"
    >();
    expectTypeOf(tasksTableConfig.urlKeys).toHaveProperty("estimatedHours");
    expectTypeOf(tasksTableConfig.parsers).toHaveProperty("createdAt");
  });
});

interface Task {
  id: string;
  code: string;
  status: "todo" | "done";
  estimatedHours: number;
}

const columnHelperConfig = createDataTableConfig({
  columns: {
    code: { enableSorting: false },
    status: { variant: "multi-select" },
    estimatedHours: { variant: "number", filter: "range" },
  },
});

const columnHelper = createDataTableColumnHelper<
  Task,
  typeof columnHelperConfig
>();

describe("createDataTableColumnHelper", () => {
  it("names the column once", () => {
    expect(
      columnHelper.accessor("estimatedHours", {
        header: "Hours",
        meta: { label: "Est. Hours", unit: "hr", max: 24 },
      }),
    ).toEqual({
      id: "estimatedHours",
      accessorKey: "estimatedHours",
      header: "Hours",
      meta: { label: "Est. Hours", unit: "hr", max: 24 },
    });
  });

  it("types the cell value and the meta by column", () => {
    columnHelper.accessor("status", {
      cell: ({ cell }) => {
        expectTypeOf(cell.getValue()).toEqualTypeOf<"todo" | "done">();
        return null;
      },
      meta: { options: [{ label: "Todo", value: "todo" }] },
    });
    columnHelper.accessor("code", {
      // @ts-expect-error options only exist on select columns
      meta: { options: [] },
    });
    columnHelper.accessor("estimatedHours", {
      // @ts-expect-error the config owns the range filter
      meta: { filter: "range" },
    });
    // @ts-expect-error the config has no id column
    columnHelper.accessor("id", {});
    columnHelper.accessor("status", {
      // @ts-expect-error the config owns the sorting flag
      enableSorting: false,
    });
  });

  it("keeps the rest of the TanStack column helper", () => {
    const columns = columnHelper.columns([
      columnHelper.accessor("code", {}),
      columnHelper.display({ id: "actions" }),
    ]);

    expect(columns.map((column) => column.id)).toEqual(["code", "actions"]);
  });
});

describe("getColumnConfigs", () => {
  it("reads leaf columns, filters, and sorting from the definitions", () => {
    expect(
      getColumnConfigs<Task>([
        {
          id: "details",
          columns: [
            {
              id: "code",
              accessorKey: "code",
              enableColumnFilter: true,
            },
            {
              id: "estimatedHours",
              accessorKey: "estimatedHours",
              enableColumnFilter: true,
              enableSorting: false,
              meta: { variant: "number", filter: "range" },
            },
          ],
        },
        { id: "actions" },
      ]),
    ).toEqual({
      code: { enableSorting: true, variant: "text" },
      estimatedHours: {
        enableSorting: false,
        variant: "number",
        filter: "range",
      },
      actions: { enableSorting: false },
    });
  });
});

describe("applyColumnConfig", () => {
  it("lets the config decide filtering, sorting, and the variant", () => {
    expect(
      applyColumnConfig<Task>(
        {
          id: "code",
          accessorKey: "code",
          enableSorting: true,
          meta: { label: "Code" },
        },
        { code: { enableSorting: false, variant: "text" } },
      ),
    ).toMatchObject({
      enableColumnFilter: true,
      enableSorting: false,
      meta: { label: "Code", variant: "text" },
    });
  });

  it("turns off filtering and sorting for columns outside the config", () => {
    expect(
      applyColumnConfig<Task>(
        {
          id: "details",
          columns: [{ id: "code", accessorKey: "code", enableSorting: true }],
        },
        {},
      ),
    ).toMatchObject({
      columns: [{ enableColumnFilter: false, enableSorting: false }],
    });
  });
});
