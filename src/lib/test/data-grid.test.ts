import { describe, expect, it } from "vitest";

import {
  getCellKey,
  getIsInPopover,
  getTabTargetCell,
  getVisibleColumnIds,
  parseCellKey,
  parseTsv,
} from "@/lib/data-grid-utils";

describe("getCellKey", () => {
  it("round-trips row and column ids", () => {
    expect(parseCellKey(getCellKey("row-1", "name"))).toEqual({
      rowId: "row-1",
      columnId: "name",
    });
  });

  it("keeps ids that contain colons or spaces intact", () => {
    expect(parseCellKey(getCellKey("org:42:user 7", "a:b"))).toEqual({
      rowId: "org:42:user 7",
      columnId: "a:b",
    });
  });

  it("returns empty ids for malformed keys", () => {
    expect(parseCellKey("0:name")).toEqual({ rowId: "", columnId: "" });
  });
});

describe("getVisibleColumnIds", () => {
  const columnIds = ["select", "name", "age", "email", "actions"];

  it("keeps definition order by default", () => {
    expect(getVisibleColumnIds({ columnIds })).toEqual(columnIds);
  });

  it("drops hidden columns", () => {
    expect(
      getVisibleColumnIds({ columnIds, columnVisibility: { age: false } }),
    ).toEqual(["select", "name", "email", "actions"]);
  });

  it("applies column order and appends unordered columns", () => {
    expect(
      getVisibleColumnIds({
        columnIds,
        columnOrder: ["email", "missing", "name"],
      }),
    ).toEqual(["email", "name", "select", "age", "actions"]);
  });

  it("moves pinned columns to the start and end", () => {
    expect(
      getVisibleColumnIds({
        columnIds,
        columnPinning: { start: ["select", "email"], end: ["name"] },
      }),
    ).toEqual(["select", "email", "age", "actions", "name"]);
  });

  it("ignores hidden pinned columns", () => {
    expect(
      getVisibleColumnIds({
        columnIds,
        columnVisibility: { email: false },
        columnPinning: { start: ["email"], end: [] },
      }),
    ).toEqual(["select", "name", "age", "actions"]);
  });
});

describe("getTabTargetCell", () => {
  const columnIds = ["name", "age", "email"];

  it("should move to the next column in the same row", () => {
    expect(
      getTabTargetCell({
        rowIndex: 1,
        columnId: "name",
        columnIds,
        rowCount: 3,
        isBackward: false,
      }),
    ).toEqual({ rowIndex: 1, columnId: "age" });
  });

  it("should wrap to the first column of the next row", () => {
    expect(
      getTabTargetCell({
        rowIndex: 1,
        columnId: "email",
        columnIds,
        rowCount: 3,
        isBackward: false,
      }),
    ).toEqual({ rowIndex: 2, columnId: "name" });
  });

  it("should wrap to the last column of the previous row on shift+tab", () => {
    expect(
      getTabTargetCell({
        rowIndex: 1,
        columnId: "name",
        columnIds,
        rowCount: 3,
        isBackward: true,
      }),
    ).toEqual({ rowIndex: 0, columnId: "email" });
  });

  it("should return null at the grid edges so focus can leave the grid", () => {
    expect(
      getTabTargetCell({
        rowIndex: 2,
        columnId: "email",
        columnIds,
        rowCount: 3,
        isBackward: false,
      }),
    ).toBeNull();
    expect(
      getTabTargetCell({
        rowIndex: 0,
        columnId: "name",
        columnIds,
        rowCount: 3,
        isBackward: true,
      }),
    ).toBeNull();
  });

  it("should return null for an unknown column", () => {
    expect(
      getTabTargetCell({
        rowIndex: 0,
        columnId: "missing",
        columnIds,
        rowCount: 3,
        isBackward: false,
      }),
    ).toBeNull();
  });

  describe("with utility columns", () => {
    const allColumnIds = ["select", "name", "age", "actions"];
    function getIsColumnTabbable(columnId: string) {
      return columnId !== "select" && columnId !== "actions";
    }

    it("should skip utility columns when wrapping", () => {
      expect(
        getTabTargetCell({
          rowIndex: 0,
          columnId: "age",
          columnIds: allColumnIds,
          rowCount: 3,
          isBackward: false,
          getIsColumnTabbable,
        }),
      ).toEqual({ rowIndex: 1, columnId: "name" });
      expect(
        getTabTargetCell({
          rowIndex: 1,
          columnId: "name",
          columnIds: allColumnIds,
          rowCount: 3,
          isBackward: true,
          getIsColumnTabbable,
        }),
      ).toEqual({ rowIndex: 0, columnId: "age" });
    });

    it("should leave a utility column for the nearest data cell", () => {
      expect(
        getTabTargetCell({
          rowIndex: 1,
          columnId: "select",
          columnIds: allColumnIds,
          rowCount: 3,
          isBackward: false,
          getIsColumnTabbable,
        }),
      ).toEqual({ rowIndex: 1, columnId: "name" });
      expect(
        getTabTargetCell({
          rowIndex: 1,
          columnId: "actions",
          columnIds: allColumnIds,
          rowCount: 3,
          isBackward: true,
          getIsColumnTabbable,
        }),
      ).toEqual({ rowIndex: 1, columnId: "age" });
    });

    it("should return null when no column is tabbable", () => {
      expect(
        getTabTargetCell({
          rowIndex: 0,
          columnId: "select",
          columnIds: ["select", "actions"],
          rowCount: 3,
          isBackward: false,
          getIsColumnTabbable,
        }),
      ).toBeNull();
    });
  });
});

describe("parseTsv", () => {
  describe("basic parsing", () => {
    it("should parse simple single-row TSV", () => {
      expect(parseTsv("Alice\tKickflip\t95", 3)).toEqual([
        ["Alice", "Kickflip", "95"],
      ]);
    });

    it("should parse multiple rows", () => {
      expect(parseTsv("Alice\tKickflip\t95\nBob\tOllie\t88", 3)).toEqual([
        ["Alice", "Kickflip", "95"],
        ["Bob", "Ollie", "88"],
      ]);
    });

    it("should handle single-column paste", () => {
      expect(parseTsv("Alice\nBob\nCharlie", 1)).toEqual([
        ["Alice"],
        ["Bob"],
        ["Charlie"],
      ]);
    });

    it("should skip empty rows", () => {
      expect(parseTsv("Alice\tKickflip\t95\n\nBob\tOllie\t88", 3)).toEqual([
        ["Alice", "Kickflip", "95"],
        ["Bob", "Ollie", "88"],
      ]);
    });
  });

  describe("quoted fields (standard TSV)", () => {
    it("should handle quoted multiline content", () => {
      const text =
        'Alice\tKickflip\t95\nBob\t"Trick with\nmultiple\nlines"\t98';
      expect(parseTsv(text, 3)).toEqual([
        ["Alice", "Kickflip", "95"],
        ["Bob", "Trick with\nmultiple\nlines", "98"],
      ]);
    });

    it("should handle escaped quotes", () => {
      const text = '"She said ""hello"""\t42';
      expect(parseTsv(text, 2)).toEqual([['She said "hello"', "42"]]);
    });

    it("should handle Windows line endings", () => {
      const text = '"Line 1\r\nLine 2"\tvalue';
      expect(parseTsv(text, 2)).toEqual([["Line 1\r\nLine 2", "value"]]);
    });

    it("should handle mixed quoted and unquoted fields", () => {
      const text = 'plain\t"quoted\nfield"\t123';
      expect(parseTsv(text, 3)).toEqual([["plain", "quoted\nfield", "123"]]);
    });
  });

  describe("unquoted multiline (tab counting)", () => {
    it("should handle multiline in last column", () => {
      const text = "Alice\tKickflip\t95\nBob\tTrick with\nmultiple\nlines\t98";
      expect(parseTsv(text, 3)).toEqual([
        ["Alice", "Kickflip", "95"],
        ["Bob", "Trick with\nmultiple\nlines", "98"],
      ]);
    });

    it("should handle multiline in middle column", () => {
      const text =
        "Alice\tShort note\t95\nBob\tLine 1\nLine 2\nLine 3\t88\nCharlie\tSimple\t77";
      expect(parseTsv(text, 3)).toEqual([
        ["Alice", "Short note", "95"],
        ["Bob", "Line 1\nLine 2\nLine 3", "88"],
        ["Charlie", "Simple", "77"],
      ]);
    });

    it("should handle multiple rows with multiline in middle columns", () => {
      const text = [
        "Alice\tShort\t1",
        "Bob\tMulti",
        "line",
        "content\t2",
        "Charlie\tAnother",
        "multi\t3",
        "Dave\tPlain\t4",
      ].join("\n");
      expect(parseTsv(text, 3)).toEqual([
        ["Alice", "Short", "1"],
        ["Bob", "Multi\nline\ncontent", "2"],
        ["Charlie", "Another\nmulti", "3"],
        ["Dave", "Plain", "4"],
      ]);
    });
  });

  describe("data with JSON values (no false positives)", () => {
    it("should use tab counting when quotes are inside field values not delimiters", () => {
      const text = 'Alice\t["React","Node.js"]\t95\nBob\t["Python"]\t88';
      expect(parseTsv(text, 3)).toEqual([
        ["Alice", '["React","Node.js"]', "95"],
        ["Bob", '["Python"]', "88"],
      ]);
    });

    it("should handle JSON values with unquoted multiline", () => {
      const text = [
        'Alice\tShort note\t["React"]\t1',
        "Bob\tLine 1",
        'Line 2\t["Python"]\t2',
        'Charlie\tPlain\t["SQL"]\t3',
      ].join("\n");
      expect(parseTsv(text, 4)).toEqual([
        ["Alice", "Short note", '["React"]', "1"],
        ["Bob", "Line 1\nLine 2", '["Python"]', "2"],
        ["Charlie", "Plain", '["SQL"]', "3"],
      ]);
    });
  });

  describe("edge cases", () => {
    it("should return empty array for empty string", () => {
      expect(parseTsv("", 0)).toEqual([]);
    });

    it("should handle single cell", () => {
      expect(parseTsv("hello", 1)).toEqual([["hello"]]);
    });

    it("should fallback to simple split when no tabs detected", () => {
      expect(parseTsv("line1\nline2\nline3", 1)).toEqual([
        ["line1"],
        ["line2"],
        ["line3"],
      ]);
    });
  });
});

describe("getIsInPopover", () => {
  it.each([
    "dropdown-menu-content",
    "popover-content",
    "select-content",
    "faceted-content",
  ])("treats elements inside %s as inside a popover", (slot) => {
    const popup = document.createElement("div");
    popup.dataset.slot = slot;
    const option = document.createElement("button");
    popup.append(option);

    expect(getIsInPopover(option)).toBe(true);
  });

  it("ignores elements outside a popover", () => {
    const toolbar = document.createElement("div");
    toolbar.dataset.slot = "button-group";
    const button = document.createElement("button");
    toolbar.append(button);

    expect(getIsInPopover(button)).toBe(false);
    expect(getIsInPopover(null)).toBe(false);
  });
});
