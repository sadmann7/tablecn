import { describe, expect, it } from "vitest";
import { parseTsv } from "@/lib/data-grid";

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
