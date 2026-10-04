import { describe, expect, it } from "vitest";

import {
  coerceFilterValue,
  createPlainFilter,
  formatFilterDate,
  getActiveFilters,
  getDateFilterLabel,
  getDefaultFilterOperator,
  getFilterDates,
  getFilterDateValue,
  getFilterOperators,
  getIsActiveFilter,
  getIsDateVariant,
  getIsEditableTarget,
  getIsMultiValueVariant,
  getIsPlainFilter,
  getPlainFilterId,
  getPlainFilterOperator,
  getPlainFilterValue,
  getSelectFilterValue,
  normalizeColumnFilter,
  parseFilterDate,
  stringifyFilterValue,
} from "@/lib/data-table-utils";

describe("filter operators", () => {
  it("gives every variant its own operator list and default", () => {
    expect(getFilterOperators("text").map((item) => item.value)).toContain(
      "iLike",
    );
    expect(getFilterOperators("multiSelect")[0]?.value).toBe("inArray");
    expect(getDefaultFilterOperator("text")).toBe("iLike");
    expect(getDefaultFilterOperator("number")).toBe("eq");
    expect(getDefaultFilterOperator("boolean")).toBe("eq");
    expect(getDefaultFilterOperator("date")).toBe("eq");
  });

  it("uses the plain operator a toolbar filter writes", () => {
    expect(getPlainFilterOperator("select")).toBe("inArray");
    expect(getPlainFilterOperator("multiSelect")).toBe("inArray");
    expect(getPlainFilterOperator("range")).toBe("isBetween");
    expect(getPlainFilterOperator("dateRange")).toBe("isBetween");
    expect(getPlainFilterOperator("text")).toBe("iLike");
    expect(getPlainFilterOperator("number")).toBe("eq");
    expect(getIsMultiValueVariant("range")).toBe(true);
    expect(getIsMultiValueVariant("text")).toBe(false);
    expect(getIsDateVariant("dateRange")).toBe(true);
    expect(getIsDateVariant("number")).toBe(false);
  });
});

describe("coerceFilterValue", () => {
  it("reshapes a value to match the operator", () => {
    expect(coerceFilterValue("isEmpty", "kept")).toBe("");
    expect(coerceFilterValue("isNotEmpty", ["kept"])).toBe("");
    expect(coerceFilterValue("inArray", "todo")).toEqual(["todo"]);
    expect(coerceFilterValue("inArray", "")).toEqual([]);
    expect(coerceFilterValue("notInArray", ["todo"])).toEqual(["todo"]);
    expect(coerceFilterValue("isBetween", "2")).toEqual(["2", ""]);
    expect(coerceFilterValue("isBetween", ["2", "8"])).toEqual(["2", "8"]);
    expect(coerceFilterValue("eq", ["", "todo"])).toBe("todo");
    expect(coerceFilterValue("eq", ["", ""])).toBe("");
    expect(coerceFilterValue("eq", "todo")).toBe("todo");
  });
});

describe("editable targets", () => {
  it("recognizes fields and content a user can type into", () => {
    expect(getIsEditableTarget(null)).toBe(false);
    expect(getIsEditableTarget(document.createElement("div"))).toBe(false);

    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(getIsEditableTarget(editable)).toBe(true);
    expect(getIsEditableTarget(document.createElement("input"))).toBe(true);
    expect(getIsEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(getIsEditableTarget(document.createElement("select"))).toBe(true);
  });
});

describe("filter dates", () => {
  it("parses dates, timestamps, and rejects values that are not dates", () => {
    const date = new Date(2026, 9, 3, 9, 30);
    expect(parseFilterDate(date)).toBe(date);
    expect(parseFilterDate(new Date(Number.NaN))).toBeUndefined();
    expect(parseFilterDate(date.getTime())?.getTime()).toBe(date.getTime());
    expect(parseFilterDate("")).toBeUndefined();
    expect(parseFilterDate("   ")).toBeUndefined();
    expect(parseFilterDate(String(date.getTime()))?.getTime()).toBe(
      date.getTime(),
    );
    expect(parseFilterDate("not-a-date")).toBeUndefined();
    expect(parseFilterDate("2026-10-03T15:00:00.000Z")?.toISOString()).toBe(
      "2026-10-03T15:00:00.000Z",
    );
    expect(parseFilterDate("2026-10-03")?.toDateString()).toBe(
      new Date(2026, 9, 3).toDateString(),
    );
    expect(parseFilterDate("2026-13-01")).toBeUndefined();
    expect(parseFilterDate("2026-00-31")).toBeUndefined();
    expect(parseFilterDate("2026-02-30")).toBeUndefined();
  });

  it("formats a calendar day and labels a range", () => {
    const start = new Date(2026, 9, 3);
    const end = new Date(2026, 9, 7);
    expect(formatFilterDate(start)).toBe("2026-10-03");
    expect(getFilterDateValue(start)).toBe("2026-10-03");
    expect(getFilterDateValue(undefined)).toBe("");
    expect(getFilterDates(["2026-10-03", "nope", "2026-10-07"])).toEqual([
      start,
      end,
    ]);

    const between = {
      id: "createdAt",
      filterId: "createdAt-0",
      variant: "dateRange" as const,
      operator: "isBetween" as const,
      value: ["2026-10-03", "2026-10-07"],
    };
    expect(getDateFilterLabel(between)).toBe("Oct 3, 2026 - Oct 7, 2026");
    expect(
      getDateFilterLabel({ ...between, value: ["2026-10-03", "2026-10-03"] }),
    ).toBe("Oct 3, 2026");
    expect(
      getDateFilterLabel({ ...between, operator: "gte", value: "2026-10-03" }),
    ).toBe("Oct 3, 2026");
    expect(getDateFilterLabel({ ...between, value: "nope" })).toBeUndefined();
  });
});

describe("stringifyFilterValue", () => {
  it("stringifies empty, date, object, and primitive values", () => {
    const date = new Date(2026, 9, 3, 9, 30);
    expect(stringifyFilterValue(null)).toBe("");
    expect(stringifyFilterValue(undefined)).toBe("");
    expect(stringifyFilterValue(date)).toBe(date.toISOString());
    expect(stringifyFilterValue({ id: 1 })).toBe('{"id":1}');
    expect(stringifyFilterValue(false)).toBe("false");
  });
});

describe("plain filters", () => {
  it("builds a plain filter and drops an empty one", () => {
    expect(createPlainFilter("title", "text", undefined)).toBeNull();
    expect(createPlainFilter("title", "text", "")).toBeNull();
    expect(createPlainFilter("title", "text", ["Alpha"])).toBeNull();
    expect(createPlainFilter("status", "multiSelect", ["", ""])).toBeNull();
    expect(createPlainFilter("title", "text", "Alpha")).toEqual({
      id: "title",
      variant: "text",
      operator: "iLike",
      value: "Alpha",
      filterId: "title-filter",
    });
    expect(createPlainFilter("status", "multiSelect", "todo")).toMatchObject({
      operator: "inArray",
      value: ["todo"],
      filterId: "status-filter",
    });
    expect(
      createPlainFilter("createdAt", "date", new Date(2026, 9, 3, 9).getTime()),
    ).toMatchObject({ operator: "eq", value: "2026-10-03" });
  });

  it("normalizes a stored filter into a column filter item", () => {
    expect(
      normalizeColumnFilter(
        {
          id: "createdAt",
          operator: "isRelativeToToday",
          value: "1 days",
          filterId: "createdAt-0",
        },
        "date",
      ),
    ).toMatchObject({ operator: "isRelativeToToday", value: "1 days" });
    expect(
      normalizeColumnFilter(
        { id: "createdAt", operator: "eq", value: new Date(2026, 9, 3) },
        "date",
      ),
    ).toMatchObject({ value: "2026-10-03", filterId: "createdAt-filter" });
    expect(
      normalizeColumnFilter({ id: "title", value: "" }, "text"),
    ).toMatchObject({ operator: "iLike", value: "", filterId: "title-filter" });
    expect(
      normalizeColumnFilter({ id: "status", value: undefined }, "multiSelect"),
    ).toMatchObject({ operator: "inArray", value: [] });
  });

  it("reads a plain filter back into the toolbar value", () => {
    const base = {
      id: "status",
      filterId: "status-0",
      operator: "inArray" as const,
    };
    expect(
      getPlainFilterValue({ ...base, variant: "multiSelect", value: ["todo"] }),
    ).toEqual(["todo"]);
    expect(
      getPlainFilterValue({ ...base, variant: "select", value: "todo" }),
    ).toEqual(["todo"]);
    expect(
      getPlainFilterValue({
        ...base,
        id: "hours",
        variant: "range",
        operator: "isBetween",
        value: ["2", ""],
      }),
    ).toEqual([2, undefined]);
    expect(
      getPlainFilterValue({
        id: "createdAt",
        filterId: "createdAt-0",
        variant: "date",
        operator: "eq",
        value: "2026-10-03",
      }),
    ).toBe(new Date(2026, 9, 3).getTime());
    expect(
      getPlainFilterValue({
        id: "createdAt",
        filterId: "createdAt-0",
        variant: "dateRange",
        operator: "isBetween",
        value: ["2026-10-03", "nope"],
      }),
    ).toEqual([new Date(2026, 9, 3).getTime(), undefined]);
    expect(
      getPlainFilterValue({
        id: "title",
        filterId: "title-0",
        variant: "text",
        operator: "iLike",
        value: "Alpha",
      }),
    ).toBe("Alpha");
  });

  it("knows which filters are plain and which still narrow the rows", () => {
    const plain = createPlainFilter("title", "text", "Alpha");
    expect(plain && getIsPlainFilter(plain)).toBe(true);
    expect(
      getIsPlainFilter({
        id: "title",
        filterId: getPlainFilterId("title"),
        variant: "text",
        operator: "eq",
        value: "Alpha",
      }),
    ).toBe(false);
    expect(
      getIsPlainFilter({
        id: "status",
        filterId: "status-0",
        variant: "multiSelect",
        operator: "inArray",
        value: "todo",
      }),
    ).toBe(false);

    const empty = {
      id: "title",
      filterId: "title-0",
      variant: "text" as const,
      operator: "iLike" as const,
      value: "",
    };
    expect(getIsActiveFilter(empty)).toBe(false);
    expect(getIsActiveFilter({ ...empty, operator: "isEmpty" })).toBe(true);
    expect(getIsActiveFilter({ ...empty, value: ["", "2"] })).toBe(true);
    expect(getIsActiveFilter({ ...empty, value: ["", ""] })).toBe(false);
    expect(getActiveFilters([empty, { ...empty, value: "Alpha" }])).toEqual([
      { ...empty, value: "Alpha" },
    ]);
  });
});

describe("select filter values", () => {
  it("returns a list for multi-select and a string for select", () => {
    const filter = {
      id: "status",
      filterId: "status-0",
      operator: "eq" as const,
      value: "todo",
    };
    expect(
      getSelectFilterValue({
        ...filter,
        variant: "multiSelect",
        value: "todo",
      }),
    ).toEqual([]);
    expect(
      getSelectFilterValue({
        ...filter,
        variant: "multiSelect",
        value: ["todo"],
      }),
    ).toEqual(["todo"]);
    expect(getSelectFilterValue({ ...filter, variant: "select" })).toBe("todo");
    expect(
      getSelectFilterValue({ ...filter, variant: "select", value: ["todo"] }),
    ).toBeUndefined();
  });
});
