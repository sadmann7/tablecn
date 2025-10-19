import type { RowHeightValue } from "@/types/data-grid";

export function getRowHeightValue(rowHeight: RowHeightValue): number {
  const rowHeightMap: Record<RowHeightValue, number> = {
    short: 36,
    medium: 56,
    tall: 76,
    "extra-tall": 96,
  };

  return rowHeightMap[rowHeight];
}
