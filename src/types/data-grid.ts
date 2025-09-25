import type { RowData } from "@tanstack/react-table";

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export interface ScrollToOptions {
  rowIndex: number;
  columnId?: string;
}

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: TData is used in the TableMeta interface
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    focusedCell: CellPosition | null;
    editingCell: CellPosition | null;
    onCellClick: (rowIndex: number, columnId: string) => void;
    onCellDoubleClick: (rowIndex: number, columnId: string) => void;
    startEditing: (rowIndex: number, columnId: string) => void;
    stopEditing: () => void;
    navigateCell: (direction: "up" | "down" | "left" | "right") => void;
    blurCell: () => void;
  }
}
