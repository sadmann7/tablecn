import { describe, expect, it } from "vitest";

import { sanitizeEnumFilters } from "@/app/lib/utils";

describe("sanitizeEnumFilters", () => {
  it("keeps valueless filters and drops values outside the enum", () => {
    expect(
      sanitizeEnumFilters([
        {
          id: "status",
          variant: "multi-select",
          operator: "isEmpty",
          value: "",
          filterId: "status-0",
        },
        {
          id: "priority",
          variant: "multi-select",
          operator: "inArray",
          value: ["high", "bogus"],
          filterId: "priority-0",
        },
      ]).map((filter) => [filter.id, filter.operator, filter.value]),
    ).toEqual([
      ["status", "isEmpty", ""],
      ["priority", "inArray", ["high"]],
    ]);
  });
});
