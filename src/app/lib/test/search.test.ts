import { describe, expect, it } from "vitest";

import type { Task } from "@/db/schema";

import {
  getValidTimeZone,
  matchesTaskSearch,
  parseTaskSearch,
} from "../search";

const now = new Date("2026-11-08T03:30:00Z");

describe("parseTaskSearch", () => {
  it("keeps plain text as text", () => {
    expect(parseTaskSearch("login bug", "UTC", now)).toEqual({
      text: "login bug",
      dateRange: null,
    });
  });

  it("splits a date out of the text", () => {
    expect(parseTaskSearch("bug oct 26", "UTC", now)).toEqual({
      text: "bug",
      dateRange: ["2026-10-26", "2026-10-26"],
    });
  });

  it("reads a date range", () => {
    expect(
      parseTaskSearch("from oct 1 to oct 15", "UTC", now).dateRange,
    ).toEqual(["2026-10-01", "2026-10-15"]);
  });

  it("resolves relative dates in the given time zone", () => {
    expect(parseTaskSearch("today", "UTC", now).dateRange).toEqual([
      "2026-11-08",
      "2026-11-08",
    ]);
    expect(parseTaskSearch("today", "America/New_York", now).dateRange).toEqual(
      ["2026-11-07", "2026-11-07"],
    );
  });
});

describe("matchesTaskSearch", () => {
  it("matches the date and the text together", () => {
    const task = createTask({});

    expect(
      matchesTaskSearch(task, parseTaskSearch("bug oct 26", "UTC", now), "UTC"),
    ).toBe(true);
    expect(
      matchesTaskSearch(
        task,
        parseTaskSearch("feature oct 26", "UTC", now),
        "UTC",
      ),
    ).toBe(false);
    expect(
      matchesTaskSearch(task, parseTaskSearch("bug oct 27", "UTC", now), "UTC"),
    ).toBe(false);
  });

  it("compares the created day in the given time zone", () => {
    const task = createTask({ createdAt: new Date("2026-10-27T02:00:00Z") });
    const search = parseTaskSearch("oct 26", "America/New_York", now);

    expect(matchesTaskSearch(task, search, "America/New_York")).toBe(true);
    expect(matchesTaskSearch(task, search, "UTC")).toBe(false);
  });

  it("searches every text and number column", () => {
    const task = createTask({});

    for (const value of ["task-1", "login", "todo", "high", "bug", "4"]) {
      expect(
        matchesTaskSearch(task, parseTaskSearch(value, "UTC", now), "UTC"),
      ).toBe(true);
    }
  });
});

describe("getValidTimeZone", () => {
  it("falls back to UTC for a missing or unknown time zone", () => {
    expect(getValidTimeZone(undefined)).toBe("UTC");
    expect(getValidTimeZone("Not/AZone")).toBe("UTC");
    expect(getValidTimeZone("Asia/Dhaka")).toBe("Asia/Dhaka");
  });
});

function createTask(overrides: Partial<Task>): Task {
  return {
    id: "1",
    code: "TASK-1",
    title: "Fix the login bug",
    status: "todo",
    priority: "high",
    label: "bug",
    estimatedHours: 4,
    archived: false,
    createdAt: new Date("2026-10-26T15:00:00Z"),
    updatedAt: null,
    ...overrides,
  };
}
