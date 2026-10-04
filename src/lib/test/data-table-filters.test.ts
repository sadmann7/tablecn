import { describe, expect, it, vi } from "vitest";

import type { FilterOperator, FilterVariant } from "@/lib/data-table-types";

import { matchesFilter } from "@/lib/data-table-filters";

function match(
  cell: unknown,
  operator: FilterOperator,
  variant: FilterVariant,
  value: string | string[],
) {
  return matchesFilter(cell, { operator, variant, value });
}

describe("matchesFilter", () => {
  it("matches text by inclusion, and skips a filter with no text", () => {
    expect(match("Alpha", "iLike", "text", "alp")).toBe(true);
    expect(match("Alpha", "iLike", "text", "bet")).toBe(false);
    expect(match("Alpha", "notILike", "text", "bet")).toBe(true);
    expect(match("Alpha", "notILike", "text", "alp")).toBe(false);
    expect(match("Alpha", "iLike", "text", ["alp"])).toBe(true);
    expect(match("Alpha", "notILike", "text", ["alp"])).toBe(true);
  });

  it("compares booleans, numbers, and text for equality", () => {
    expect(match(true, "eq", "boolean", "true")).toBe(true);
    expect(match("true", "eq", "boolean", "true")).toBe(true);
    expect(match(false, "eq", "boolean", "true")).toBe(false);
    expect(match("false", "ne", "boolean", "true")).toBe(true);
    expect(match(false, "ne", "boolean", "false")).toBe(false);

    expect(match(2, "eq", "number", "2")).toBe(true);
    expect(match("2", "ne", "range", "3")).toBe(true);
    expect(match("", "eq", "number", "")).toBe(false);

    expect(match("todo", "eq", "select", "todo")).toBe(true);
    expect(match("todo", "ne", "select", "done")).toBe(true);
    expect(match(null, "eq", "text", "")).toBe(true);
  });

  it("matches list membership when the filter value is a list", () => {
    expect(match("todo", "inArray", "multiSelect", ["todo", "done"])).toBe(
      true,
    );
    expect(match("canceled", "inArray", "multiSelect", ["todo"])).toBe(false);
    expect(match("todo", "inArray", "multiSelect", "todo")).toBe(true);
    expect(match("todo", "notInArray", "multiSelect", ["done"])).toBe(true);
    expect(match("done", "notInArray", "multiSelect", ["done"])).toBe(false);
    expect(match("done", "notInArray", "multiSelect", "done")).toBe(true);
  });

  it("compares numbers and rejects a value that is not numeric", () => {
    expect(match(2, "lt", "number", "3")).toBe(true);
    expect(match(3, "lt", "number", "3")).toBe(false);
    expect(match(3, "lte", "range", "3")).toBe(true);
    expect(match(4, "gt", "number", "3")).toBe(true);
    expect(match(3, "gte", "number", "3")).toBe(true);
    expect(match("nope", "gt", "number", "3")).toBe(false);
    expect(match(1, "lt", "number", ["1", "2"])).toBe(true);
  });

  it("treats a between filter with a missing side as open", () => {
    const day = new Date(2026, 9, 3, 12).getTime();
    const later = new Date(2026, 9, 8, 12).getTime();

    expect(match(2, "isBetween", "range", "2")).toBe(true);
    expect(match(2, "isBetween", "range", ["", ""])).toBe(true);
    expect(match(4, "isBetween", "range", ["2", "8"])).toBe(true);
    expect(match(1, "isBetween", "range", ["2", "8"])).toBe(false);
    expect(match("nope", "isBetween", "number", ["2", "8"])).toBe(false);
    expect(match(day, "isBetween", "date", ["2026-10-03", ""])).toBe(true);
    expect(
      match(later, "isBetween", "dateRange", ["2026-10-01", "2026-10-07"]),
    ).toBe(false);
    expect(match(day, "isBetween", "date", ["", "2026-10-03"])).toBe(true);
  });

  it("matches a day, week, or month counted from today", () => {
    // June 15 sits clear of daylight-saving transitions, so each 24h
    // step is a different calendar day.
    vi.useFakeTimers({ now: new Date(2026, 5, 15, 12), toFake: ["Date"] });

    try {
      const dayMs = 24 * 60 * 60 * 1000;
      const now = Date.now();

      function atNoon(dayOffset: number) {
        const date = new Date(now + dayOffset * dayMs);
        date.setHours(12, 0, 0, 0);
        return date.getTime();
      }

      expect(match(atNoon(0), "isRelativeToToday", "date", "0 days")).toBe(
        true,
      );
      expect(match(atNoon(1), "isRelativeToToday", "date", "0 days")).toBe(
        false,
      );
      expect(match(atNoon(-1), "isRelativeToToday", "date", "-1 days")).toBe(
        true,
      );
      expect(match(atNoon(7), "isRelativeToToday", "date", "1 weeks")).toBe(
        true,
      );
      expect(match(atNoon(6), "isRelativeToToday", "date", "1 weeks")).toBe(
        false,
      );
      expect(match(atNoon(13), "isRelativeToToday", "date", "1 weeks")).toBe(
        true,
      );
      expect(match(atNoon(14), "isRelativeToToday", "date", "1 weeks")).toBe(
        false,
      );
      expect(
        match(atNoon(30), "isRelativeToToday", "dateRange", "1 months"),
      ).toBe(true);
      expect(match(atNoon(29), "isRelativeToToday", "date", "1 months")).toBe(
        false,
      );
      expect(match(atNoon(59), "isRelativeToToday", "date", "1 months")).toBe(
        true,
      );
      expect(match(atNoon(60), "isRelativeToToday", "date", "1 months")).toBe(
        false,
      );
      expect(match("nope", "isRelativeToToday", "date", "0 days")).toBe(false);
      expect(match(atNoon(0), "isRelativeToToday", "date", ["0 days"])).toBe(
        true,
      );
      expect(match(atNoon(0), "isRelativeToToday", "date", "days")).toBe(true);
      expect(match(atNoon(0), "isRelativeToToday", "date", "1 years")).toBe(
        true,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats null, an empty string, and an empty list as empty", () => {
    for (const value of [null, undefined, "", []]) {
      expect(match(value, "isEmpty", "text", "")).toBe(true);
      expect(match(value, "isNotEmpty", "text", "")).toBe(false);
    }
    expect(match(0, "isEmpty", "number", "")).toBe(false);
    expect(match(false, "isNotEmpty", "boolean", "")).toBe(true);
    expect(match("todo", "nope" as FilterOperator, "text", "todo")).toBe(true);
  });
});
