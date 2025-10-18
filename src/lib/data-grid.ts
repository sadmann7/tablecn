import type { RowHeightValue } from "@/types/data-grid";

export function getRowHeightValue(rowHeight: RowHeightValue): number {
  switch (rowHeight) {
    case "short":
      return 36; // 1 line of text
    case "medium":
      return 56; // 2 lines of text
    case "tall":
      return 76; // 3 lines of text
    case "extra-tall":
      return 96; // 4 lines of text
    default:
      return 36;
  }
}

export function getRowHeightPadding(rowHeight: RowHeightValue): string {
  switch (rowHeight) {
    case "short":
      return "6px 12px";
    case "medium":
      return "8px 12px";
    case "tall":
      return "8px 12px";
    case "extra-tall":
      return "8px 12px";
    default:
      return "6px 12px";
  }
}
