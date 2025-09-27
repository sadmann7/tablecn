import type { RowData } from "@tanstack/react-table";
import type { useVirtualizer } from "@tanstack/react-virtual";

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export interface ScrollToOptions {
  rowIndex: number;
  columnId?: string;
}

export type NavigationDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "ctrl+home"
  | "ctrl+end"
  | "pageup"
  | "pagedown";

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
    navigateCell: (direction: NavigationDirection) => void;
    blurCell: () => void;
  }
}
