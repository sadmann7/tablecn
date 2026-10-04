import { createLoader } from "nuqs/server";
import { describe, expect, it } from "vitest";

import {
  tasksFilterableColumns,
  tasksSortableColumns,
} from "@/app/lib/validations";
import { matchesFilter } from "@/lib/data-table-filters";
import {
  getColumnFilterParser,
  getDataTableQuery,
  getDataTableSearchParams,
  getSortingStateParser,
  parseColumnFilter,
  serializeColumnFilter,
  sortColumnFiltersBySearch,
} from "@/lib/parsers";

const loadSearch = createLoader(
  getDataTableSearchParams({
    filterableColumns: tasksFilterableColumns,
    sortableColumns: tasksSortableColumns,
    defaultSorting: [{ id: "createdAt", desc: true }],
  }),
);

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

describe("getDataTableQuery", () => {
  it("joins per-column params in column order and drops empty filters", () => {
    const search = loadSearch(
      "?status=not.in.todo&estimatedHours=gte.2&estimatedHours=LTE.8&title=ilike.the&createdAt=2026-01-01,2026-12-31&priority=bogus.xyz&joinOperator=or&title=",
    );
    const query = getDataTableQuery(search, tasksFilterableColumns);

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
      tasksFilterableColumns,
    );

    expect(query.joinOperator).toBe("and");
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
  });
});

describe("getSortingStateParser", () => {
  const parser = getSortingStateParser(tasksSortableColumns);

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
  });
});

describe("matchesFilter", () => {
  it("treats a calendar date as the local day", () => {
    const morning = new Date(2026, 9, 3, 9, 30).getTime();
    const nextDay = new Date(2026, 9, 4, 0, 30).getTime();

    expect(
      matchesFilter(morning, {
        operator: "eq",
        variant: "date",
        value: "2026-10-03",
      }),
    ).toBe(true);
    expect(
      matchesFilter(nextDay, {
        operator: "eq",
        variant: "date",
        value: "2026-10-03",
      }),
    ).toBe(false);
  });

  it("treats a missing number bound as open", () => {
    const atMostThree = {
      operator: "isBetween" as const,
      variant: "range" as const,
      value: ["", "3"],
    };
    const atLeastTwo = {
      operator: "isBetween" as const,
      variant: "range" as const,
      value: ["2", ""],
    };

    expect(matchesFilter(3, atMostThree)).toBe(true);
    expect(matchesFilter(4, atMostThree)).toBe(false);
    expect(matchesFilter(2, atLeastTwo)).toBe(true);
    expect(matchesFilter(1, atLeastTwo)).toBe(false);
  });
});
