import type { RowData } from "@tanstack/react-table";

export type RowHeightValue = "short" | "medium" | "tall" | "extra-tall";

export interface CellSelectOption {
  label: string;
  value: string;
}

export type Cell =
  | {
      variant: "short-text";
    }
  | {
      variant: "long-text";
    }
  | {
      variant: "number";
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      variant: "select";
      options: CellSelectOption[];
    }
  | {
      variant: "multi-select";
      options: CellSelectOption[];
    }
  | {
      variant: "checkbox";
    }
  | {
      variant: "date";
    };

export interface UpdateCell {
  rowIndex: number;
  columnId: string;
  value: unknown;
}

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: TData and TValue are used in the ColumnMeta interface
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    cell?: Cell;
  }

  // biome-ignore lint/correctness/noUnusedVariables: TData is used in the TableMeta interface
  interface TableMeta<TData extends RowData> {
    dataGridRef?: React.RefObject<HTMLElement | null>;
    updateData?: (props: UpdateCell | Array<UpdateCell>) => void;
    focusedCell?: CellPosition | null;
    editingCell?: CellPosition | null;
    selectionState?: SelectionState;
    onColumnClick?: (columnId: string) => void;
    onCellClick?: (
      rowIndex: number,
      columnId: string,
      event?: React.MouseEvent,
    ) => void;
    onCellDoubleClick?: (rowIndex: number, columnId: string) => void;
    onCellMouseDown?: (
      rowIndex: number,
      columnId: string,
      event: React.MouseEvent,
    ) => void;
    onCellMouseEnter?: (
      rowIndex: number,
      columnId: string,
      event: React.MouseEvent,
    ) => void;
    onCellMouseUp?: () => void;
    onCellContextMenu?: (
      rowIndex: number,
      columnId: string,
      event: React.MouseEvent,
    ) => void;
    onCellEditingStart?: (rowIndex: number, columnId: string) => void;
    onCellEditingStop?: (opts?: { moveToNextRow?: boolean }) => void;
    getIsCellSelected?: (rowIndex: number, columnId: string) => boolean;
    getIsSearchMatch?: (rowIndex: number, columnId: string) => boolean;
    getIsCurrentSearchMatch?: (rowIndex: number, columnId: string) => boolean;
    contextMenu?: ContextMenuState;
    onContextMenuOpenChange?: (open: boolean) => void;
    rowHeight?: RowHeightValue;
    onRowHeightChange?: (value: RowHeightValue) => void;
    onRowSelect?: (
      rowIndex: number,
      checked: boolean,
      shiftKey: boolean,
    ) => void;
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

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
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

export interface SearchState {
  searchOpen: boolean;
  searchQuery: string;
  searchMatches: CellPosition[];
  matchIndex: number;
  onSearchOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
  navigateToNextMatch: () => void;
  navigateToPrevMatch: () => void;
  setSearchQuery: (query: string) => void;
}
