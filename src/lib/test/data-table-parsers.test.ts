import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import { tasksColumnConfigs, tasksDefaultSorting } from "@/app/lib/validations";
import {
  getColumnFilters,
  getColumnFiltersKey,
  getColumnFilterParser,
  getColumnOptions,
  getDataTableQuery,
  getDataTableSearchParams,
  getFilterableColumns,
  getSortableColumns,
  getSortingStateParser,
  parseColumnFilter,
  serializeColumnFilter,
  sortColumnFiltersBySearch,
} from "@/lib/data-table-parsers";

const loadSearch = createLoader(
  getDataTableSearchParams({
    columnConfigs: tasksColumnConfigs,
    defaultSorting: tasksDefaultSorting,
  }),
);

describe("column config", () => {
  const columnConfigs = {
    name: { variant: "text" },
    age: { variant: "range", isSortable: false },
    id: { isSortable: false },
    createdAt: {},
  } as const;

  it("filters columns with a variant and sorts unless opted out", () => {
    expect(getFilterableColumns(columnConfigs)).toEqual({
      name: "text",
      age: "range",
    });
    expect(getSortableColumns(columnConfigs)).toEqual(["name", "createdAt"]);
  });

  it("maps a column config to TanStack column options", () => {
    expect(getColumnOptions(columnConfigs.age)).toEqual({
      enableColumnFilter: true,
      enableSorting: false,
    });
    expect(getColumnOptions(columnConfigs.createdAt)).toEqual({
      enableColumnFilter: false,
      enableSorting: true,
    });
  });
});

describe("parseColumnFilter", () => {
  it("uses the variant default when the param has no operator", () => {
    expect(
      parseColumnFilter("status", "multiSelect", "todo,done"),
    ).toMatchObject({ operator: "inArray", value: ["todo", "done"] });
    expect(parseColumnFilter("title", "text", "the")).toMatchObject({
      operator: "iLike",
      value: "the",
    });
    expect(parseColumnFilter("estimatedHours", "range", "2,8")).toMatchObject({
      operator: "isBetween",
      value: ["2", "8"],
    });
  });

  it("reads short operator names, internal names, and any case", () => {
    expect(
      parseColumnFilter("status", "multiSelect", "not.in.todo"),
    ).toMatchObject({ operator: "notInArray", value: ["todo"] });
    expect(
      parseColumnFilter("status", "multiSelect", "notInArray.todo"),
    ).toMatchObject({ operator: "notInArray", value: ["todo"] });
    expect(parseColumnFilter("estimatedHours", "range", "LTE.8")).toMatchObject(
      { operator: "lte", value: "8" },
    );
    expect(parseColumnFilter("title", "text", "is.empty")).toMatchObject({
      operator: "isEmpty",
      value: "",
    });
    expect(parseColumnFilter("title", "text", "not.is.empty")).toMatchObject({
      operator: "isNotEmpty",
      value: "",
    });
  });

  it("keeps a lookalike operator as text when the variant does not support it", () => {
    expect(parseColumnFilter("title", "text", "in")).toMatchObject({
      operator: "iLike",
      value: "in",
    });
    expect(parseColumnFilter("title", "text", "in.progress")).toMatchObject({
      operator: "iLike",
      value: "in.progress",
    });
    expect(
      parseColumnFilter("priority", "multiSelect", "bogus.xyz"),
    ).toMatchObject({ operator: "inArray", value: ["bogus.xyz"] });
  });

  it("keeps open bounds and quotes items that contain commas", () => {
    expect(parseColumnFilter("estimatedHours", "range", ",3")).toMatchObject({
      value: ["", "3"],
    });
    expect(parseColumnFilter("estimatedHours", "range", "2,")).toMatchObject({
      value: ["2", ""],
    });
    expect(
      parseColumnFilter("status", "multiSelect", '"to,do",done'),
    ).toMatchObject({ value: ["to,do", "done"] });
    expect(
      parseColumnFilter("status", "multiSelect", '" todo "'),
    ).toMatchObject({
      value: [" todo "],
    });
  });

  it("stores dates as calendar days", () => {
    expect(
      parseColumnFilter("createdAt", "dateRange", "2026-10-01,2026-10-07"),
    ).toMatchObject({
      operator: "isBetween",
      value: ["2026-10-01", "2026-10-07"],
    });
    expect(
      parseColumnFilter("createdAt", "dateRange", "lte.2026-06-30"),
    ).toMatchObject({ operator: "lte", value: "2026-06-30" });
  });

  it("parses quoted quotes, empty list items, and a single between bound", () => {
    expect(
      parseColumnFilter("status", "multiSelect", '"say ""hi""",done'),
    ).toMatchObject({ value: ['say "hi"', "done"] });
    expect(
      parseColumnFilter("status", "multiSelect", "todo,,done"),
    ).toMatchObject({ value: ["todo", "done"] });
    expect(
      parseColumnFilter("estimatedHours", "range", "between.5"),
    ).toMatchObject({ operator: "isBetween", value: ["5", ""] });
  });

  it("drops filters without a value when parsing", () => {
    const parser = getColumnFilterParser("title", "text");

    expect(
      parser
        .parse(["ilike.", "the", "is.empty"])
        ?.map((filter) => [filter.operator, filter.value]),
    ).toEqual([
      ["iLike", "the"],
      ["isEmpty", ""],
    ]);
  });
});

describe("serializeColumnFilter", () => {
  it("leaves out the default operator and writes the others", () => {
    expect(
      serializeColumnFilter(
        parseColumnFilter("status", "multiSelect", "todo,done"),
      ),
    ).toBe("todo,done");
    expect(
      serializeColumnFilter(
        parseColumnFilter("status", "multiSelect", "not.in.todo"),
      ),
    ).toBe("not.in.todo");
    expect(
      serializeColumnFilter(
        parseColumnFilter("estimatedHours", "range", "gte.1.5"),
      ),
    ).toBe("gte.1.5");
    expect(
      serializeColumnFilter(parseColumnFilter("title", "text", "is.empty")),
    ).toBe("is.empty");
    expect(
      serializeColumnFilter(
        parseColumnFilter("status", "multiSelect", '"to,do",done'),
      ),
    ).toBe('"to,do",done');
    expect(
      serializeColumnFilter(
        parseColumnFilter("title", "text", "ilike.eq.hello"),
      ),
    ).toBe("ilike.eq.hello");
    expect(
      serializeColumnFilter(
        parseColumnFilter("status", "multiSelect", '"say ""hi""",done'),
      ),
    ).toBe('"say ""hi""",done');
  });

  it("serializes a column parser as one param per filter", () => {
    const parser = getColumnFilterParser("estimatedHours", "range");

    expect(
      parser.serialize([
        parseColumnFilter("estimatedHours", "range", "gte.2"),
        parseColumnFilter("estimatedHours", "range", "lte.8"),
      ]),
    ).toEqual(["gte.2", "lte.8"]);
  });
});

describe("getDataTableQuery", () => {
  it("joins per-column params in column order and drops empty filters", () => {
    const search = loadSearch(
      "?status=not.in.todo&estimatedHours=gte.2&estimatedHours=LTE.8&title=ilike.the&createdAt=2026-01-01,2026-12-31&priority=bogus.xyz&joinOperator=or&title=",
    );
    const query = getDataTableQuery(search, tasksColumnConfigs);

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

  it("defaults the join operator to and", () => {
    const query = getDataTableQuery(
      loadSearch("?status=todo"),
      tasksColumnConfigs,
    );

    expect(query.joinOperator).toBe("and");
    expect(loadSearch("?joinOperator=xor").joinOperator).toBe("and");
  });
});

describe("getDataTableSearchParams", () => {
  it("defaults page, page size, and sorting", () => {
    const search = loadSearch("?page=no");

    expect(search.page).toBe(1);
    expect(search.perPage).toBe(10);
    expect(search.sort).toEqual(tasksDefaultSorting);

    const custom = createLoader(
      getDataTableSearchParams({
        columnConfigs: tasksColumnConfigs,
        defaultPerPage: 25,
        defaultSorting: [],
      }),
    )("?page=2&perPage=5");

    expect(custom.page).toBe(2);
    expect(custom.perPage).toBe(5);
    expect(custom.sort).toEqual([]);
  });
});

describe("getColumnFilters", () => {
  it("numbers filters per column and builds a stable key", () => {
    const title = parseColumnFilter("title", "text", "the");
    const status = parseColumnFilter("status", "multiSelect", "todo");
    const filters = getColumnFilters(["title", "status"] as const, (id) =>
      id === "title" ? [title, title] : [status],
    );

    expect(filters.map((filter) => filter.filterId)).toEqual([
      "title-0",
      "title-1",
      "status-0",
    ]);
    expect(getColumnFiltersKey([status, title])).toBe("status=todo&title=the");
    expect(getColumnFiltersKey([])).toBe("");
  });
});

describe("sortColumnFiltersBySearch", () => {
  it("orders filters by the first time their column appears in the URL", () => {
    const filters = [
      parseColumnFilter("title", "text", "the"),
      parseColumnFilter("status", "multiSelect", "todo"),
      parseColumnFilter("createdAt", "dateRange", "2026-10-01,2026-10-07"),
    ];

    expect(
      sortColumnFiltersBySearch(
        filters,
        "?createdAt=2026-10-01,2026-10-07&status=todo&title=the",
      ).map((filter) => filter.id),
    ).toEqual(["createdAt", "status", "title"]);
    expect(
      sortColumnFiltersBySearch(
        filters,
        new URLSearchParams("status=todo"),
      ).map((filter) => filter.id),
    ).toEqual(["status", "title", "createdAt"]);
  });
});

describe("getSortingStateParser", () => {
  const parser = getSortingStateParser(getSortableColumns(tasksColumnConfigs));

  it("reads the compact form and rejects unknown columns", () => {
    expect(parser.parse("createdAt.desc,title.asc")).toEqual([
      { id: "createdAt", desc: true },
      { id: "title", desc: false },
    ]);
    expect(parser.parse("missing.desc")).toBeNull();
  });

  it("writes compact sort and falls back to JSON when that cannot round-trip", () => {
    expect(
      parser.serialize([
        { id: "createdAt", desc: true },
        { id: "title", desc: false },
      ]),
    ).toBe("createdAt.desc,title.asc");
    const commaParser = getSortingStateParser(["a,b"] as const);
    expect(commaParser.serialize([{ id: "a,b", desc: true }])).toBe(
      JSON.stringify([{ id: "a,b", desc: true }]),
    );
    expect(
      getSortingStateParser().serialize([{ id: "[title]", desc: false }]),
    ).toBe(JSON.stringify([{ id: "[title]", desc: false }]));
    expect(parser.serialize([])).toBe("[]");
  });

  it("reads JSON sorting and rejects a broken list", () => {
    expect(parser.parse('[{"id":"title","desc":true}]')).toEqual([
      { id: "title", desc: true },
    ]);
    expect(parser.parse("[]")).toEqual([]);
    expect(parser.parse("[")).toBeNull();
    expect(parser.parse("title")).toBeNull();
    expect(parser.parse(".desc")).toBeNull();
    expect(getSortingStateParser().parse("missing.desc")).toEqual([
      { id: "missing", desc: true },
    ]);
    expect(
      getSortingStateParser(new Set(["title"])).parse("title.asc"),
    ).toEqual([{ id: "title", desc: false }]);
    expect(getSortingStateParser(new Set(["title"])).parse("missing.asc")).toBe(
      null,
    );
  });

  it("treats the same sort list as equal", () => {
    const sorting = [{ id: "title" as const, desc: true }];
    expect(parser.eq(sorting, [{ id: "title", desc: true }])).toBe(true);
    expect(parser.eq(sorting, [{ id: "title", desc: false }])).toBe(false);
    expect(parser.eq(sorting, [])).toBe(false);
  });
});
