import type { Row } from "@tanstack/react-table";

import { describe, expect, it } from "vitest";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { FilterValue } from "@/lib/data-grid-types";

import { getFilterFn } from "@/lib/data-grid-filters";

const filterFn = getFilterFn<Record<string, unknown>>();

function matches(cellValue: unknown, filter: FilterValue) {
  const row = { getValue: () => cellValue } as unknown as Row<
    DataGridFeatures,
    Record<string, unknown>
  >;
  return filterFn(row, "column", filter, () => {});
}

describe("getFilterFn", () => {
  it("should match text operators case-insensitively", () => {
    expect(matches("Engineering", { operator: "contains", value: "GIN" })).toBe(
      true,
    );
    expect(
      matches("Engineering", { operator: "notContains", value: "gin" }),
    ).toBe(false);
    expect(matches("Sales", { operator: "equals", value: "sales" })).toBe(true);
    expect(matches("Sales", { operator: "notEquals", value: "sales" })).toBe(
      false,
    );
    expect(matches("Sales", { operator: "startsWith", value: "sa" })).toBe(
      true,
    );
    expect(matches("Sales", { operator: "endsWith", value: "LES" })).toBe(true);
  });

  it("should compare numbers", () => {
    expect(matches(41, { operator: "greaterThan", value: 40 })).toBe(true);
    expect(matches(40, { operator: "greaterThanOrEqual", value: 40 })).toBe(
      true,
    );
    expect(matches(40, { operator: "lessThan", value: 40 })).toBe(false);
    expect(matches(40, { operator: "lessThanOrEqual", value: 40 })).toBe(true);
    expect(matches(40, { operator: "equals", value: 40 })).toBe(true);
    expect(
      matches(80, { operator: "isBetween", value: 60, endValue: 120 }),
    ).toBe(true);
    expect(
      matches(130, { operator: "isBetween", value: 60, endValue: 120 }),
    ).toBe(false);
  });

  it("should compare dates only for date operators", () => {
    expect(
      matches("2021-03-04", { operator: "after", value: "2021-01-01" }),
    ).toBe(true);
    expect(
      matches("2021-03-04", { operator: "onOrBefore", value: "2021-03-04" }),
    ).toBe(true);
    expect(
      matches("2021-03-04", {
        operator: "isBetween",
        value: "2021-01-01",
        endValue: "2021-12-31",
      }),
    ).toBe(true);
    expect(
      matches(new Date("2021-03-04T10:00:00"), {
        operator: "equals",
        value: "2021-03-04T18:00:00",
      }),
    ).toBe(true);
    expect(matches("not a date", { operator: "before", value: "2021" })).toBe(
      true,
    );
  });

  it("should match select and multi-select options", () => {
    expect(matches("Remote", { operator: "is", value: "Remote" })).toBe(true);
    expect(matches("Remote", { operator: "isNot", value: "Remote" })).toBe(
      false,
    );
    expect(matches(["React", "SQL"], { operator: "is", value: "SQL" })).toBe(
      true,
    );
    expect(
      matches(["Python"], { operator: "isAnyOf", value: ["React", "SQL"] }),
    ).toBe(false);
    expect(
      matches("HR", { operator: "isNoneOf", value: ["Sales", "HR"] }),
    ).toBe(false);
  });

  it("should handle empty values and booleans", () => {
    expect(matches([], { operator: "isEmpty" })).toBe(true);
    expect(matches("x", { operator: "isNotEmpty" })).toBe(true);
    expect(matches(true, { operator: "isTrue" })).toBe(true);
    expect(matches(undefined, { operator: "isFalse" })).toBe(true);
    expect(matches("anything", { operator: "contains", value: "" })).toBe(true);
  });

  it("should use the latest values when a filter object is replaced", () => {
    expect(matches("Sales", { operator: "contains", value: "sal" })).toBe(true);
    expect(matches("Sales", { operator: "contains", value: "hr" })).toBe(false);
  });
});
