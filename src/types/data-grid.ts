import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: TData and TValue are used in the ColumnMeta interface
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
  }

  // biome-ignore lint/correctness/noUnusedVariables: TData is used in the TableMeta interface
  interface TableMeta<TData extends RowData> {
    updateData?: (rowIndex: number, columnId: string, value: unknown) => void;
    focusedCell?: CellPosition | null;
    editingCell?: CellPosition | null;
    selectionState?: SelectionState;
    onCellClick?: (
      rowIndex: number,
      columnId: string,
      event?: React.MouseEvent
    ) => void;
    onCellDoubleClick?: (rowIndex: number, columnId: string) => void;
    onCellMouseDown?: (
      rowIndex: number,
      columnId: string,
      event: React.MouseEvent
    ) => void;
    onCellMouseEnter?: (
      rowIndex: number,
      columnId: string,
      event: React.MouseEvent
    ) => void;
    onCellMouseUp?: () => void;
    startEditing?: (rowIndex: number, columnId: string) => void;
    stopEditing?: () => void;
    blurCell?: () => void;
    navigateCell?: (direction: NavigationDirection) => void;
    getIsCellSelected?: (rowIndex: number, columnId: string) => boolean;
    selectAll?: () => void;
    clearSelection?: () => void;
  }
}

export interface CellPosition {
  rowIndex: number;
  columnId: string;
}

export interface CellRange {
  start: CellPosition;
  end: CellPosition;
}

export interface SelectionState {
  selectedCells: Set<string>;
  selectionRange: CellRange | null;
  isSelecting: boolean;
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
