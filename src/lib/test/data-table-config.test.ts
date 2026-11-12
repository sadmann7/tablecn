import { describe, expect, expectTypeOf, it } from "vitest";

import type { DataTableColumnConfigs } from "@/lib/data-table-types";

import { tasksTableConfig } from "@/app/lib/validations";
import {
  applyColumnConfig,
  createDataTableConfig,
  getUnmatchedConfigIds,
  type InferDataTableQuery,
} from "@/lib/data-table-config";

interface Task {
  id: string;
  code: string;
  status: "todo" | "done";
  estimatedHours: number;
}

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
        columns: { search: { variant: "text" } },
      }),
    ).toThrow('column id "search" is reserved');
  });

  it("rejects unknown column config keys", () => {
    createDataTableConfig({
      columns: {
        hours: {
          variant: "number",
          // @ts-expect-error the widget follows from the variant
          filter: "slider",
        },
        // @ts-expect-error label belongs on the column meta
        title: { variant: "text", label: "Title" },
      },
    });
  });

  it("filters columns with a variant and sorts unless opted out", () => {
    const table = createDataTableConfig({
      columns: {
        name: { variant: "text" },
        age: { variant: "number", enableSorting: false },
        id: { enableSorting: false },
        createdAt: {},
      },
    });

    expect(table.filterVariants).toEqual({ name: "text", age: "number" });
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

  it("drops a relative date filter from an old URL", () => {
    expect(tasksTableConfig.parse("?createdAt=rel.1%20days").filters).toEqual(
      [],
    );
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

  it("checks column keys against the row type", () => {
    createDataTableConfig({
      // @ts-expect-error the typo widens the variant, so the config rejects it too
      columns: {
        code: { variant: "text" },
        // @ts-expect-error the row has no titel field
        titel: { variant: "text" },
      } satisfies DataTableColumnConfigs<Task>,
    });
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
  });
});

interface Owned {
  id: string;
  code: string;
  owner: { name: string; email: string };
}

describe("DataTableColumnConfigs", () => {
  it("configures nested and computed columns by column id", () => {
    const nested = {
      owner_name: { variant: "text" },
    } satisfies DataTableColumnConfigs<Owned>;
    const dotted = {
      // @ts-expect-error nested columns are configured by their derived id
      "owner.name": {},
    } satisfies DataTableColumnConfigs<Owned>;
    const computed = {
      codeLength: {},
    } satisfies DataTableColumnConfigs<Owned, "codeLength">;
    const unlisted = {
      // @ts-expect-error computed ids must be listed
      codeLength: {},
    } satisfies DataTableColumnConfigs<Owned>;

    expect([nested, dotted, computed, unlisted]).toHaveLength(4);
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

describe("getUnmatchedConfigIds", () => {
  it("returns config ids with no leaf column, including inside groups", () => {
    expect(
      getUnmatchedConfigIds<Task>(
        { code: {}, status: { variant: "select" }, titel: { variant: "text" } },
        [
          { id: "details", columns: [{ id: "code", accessorKey: "code" }] },
          { id: "status", accessorKey: "status" },
        ],
      ),
    ).toEqual(["titel"]);
  });
});
