import type { RowData } from "@tanstack/react-table";

export interface CellSelectOption {
  label: string;
  value: string;
}

export type Cell =
  | {
      variant: "text";
      placeholder?: string;
    }
  | {
      variant: "number";
      min?: number;
      max?: number;
      step?: number;
      placeholder?: string;
    }
  | {
      variant: "select";
      options: CellSelectOption[];
      placeholder?: string;
    }
  | {
      variant: "checkbox";
    }
  | {
      variant: "date";
      placeholder?: string;
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
    startEditing?: (rowIndex: number, columnId: string) => void;
    stopEditing?: (opts?: { moveToNextRow?: boolean }) => void;
    blurCell?: () => void;
    navigateCell?: (direction: NavigationDirection) => void;
    getIsCellSelected?: (rowIndex: number, columnId: string) => boolean;
    selectAll?: () => void;
    clearSelection?: () => void;
    isSearchMatch?: (rowIndex: number, columnId: string) => boolean;
    isCurrentSearchMatch?: (rowIndex: number, columnId: string) => boolean;
    searchQuery?: string;
    contextMenu?: ContextMenuState;
    onContextMenuOpenChange?: (open: boolean) => void;
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
