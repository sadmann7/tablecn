import type { Cell, RowData } from "@tanstack/react-table";

import type { DataGridFeatures } from "@/lib/data-grid-features";

export type Direction = "ltr" | "rtl";

export type RowHeightValue = "short" | "medium" | "tall" | "extra-tall";

export interface CellSelectOption {
  label: string;
  value: string;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
  count?: number;
}

export type CellOpts =
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
    }
  | {
      variant: "url";
    }
  | {
      variant: "file";
      maxFileSize?: number;
      maxFiles?: number;
      accept?: string;
      multiple?: boolean;
    };

export interface CellUpdate {
  rowId: string;
  columnId: string;
  value: unknown;
}

export interface DataGridColumnMeta {
  label?: string;
  cell?: CellOpts;
}

export interface DataGridTableMeta {
  dataGridRef?: React.RefObject<HTMLElement | null>;
  cellMapRef?: React.RefObject<Map<string, HTMLDivElement>>;
  focusedCell?: CellPosition | null;
  editingCell?: CellPosition | null;
  /** Number of selected cells, `0` when only the focused cell is active. */
  selectedCellCount?: number;
  getIsCellSelected?: (rowId: string, columnId: string) => boolean;
  /** Keys of the selected data cells in display order, or the focused cell when nothing else is selected. */
  getSelectedCellKeys?: () => string[];
  scrollToCell?: (rowId: string, columnId: string) => void;
  onRowSelect?: (rowId: string, checked: boolean, shiftKey: boolean) => void;
  onColumnClick?: (columnId: string) => void;
  onCellClick?: (
    rowId: string,
    columnId: string,
    event?: React.MouseEvent,
  ) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onCellMouseDown?: (
    rowId: string,
    columnId: string,
    event: React.MouseEvent,
  ) => void;
  onCellMouseEnter?: (rowId: string, columnId: string) => void;
  onCellMouseUp?: () => void;
  onCellContextMenu?: (
    rowId: string,
    columnId: string,
    event: React.MouseEvent,
  ) => void;
  onSelectionClear?: () => void;
  onFilesUpload?: (params: {
    files: File[];
    rowId: string;
    columnId: string;
  }) => Promise<FileCellData[]>;
  onFilesDelete?: (params: {
    fileIds: string[];
    rowId: string;
    columnId: string;
  }) => void | Promise<void>;
  contextMenu?: ContextMenuState;
  onContextMenuOpenChange?: (open: boolean) => void;
}

export interface CellPosition {
  rowId: string;
  columnId: string;
}

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
}

export interface PasteDialogState {
  open: boolean;
  rowsNeeded: number;
  clipboardText: string;
}

export type NavigationDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "ctrl+up"
  | "ctrl+down"
  | "ctrl+home"
  | "ctrl+end"
  | "pageup"
  | "pagedown"
  | "pageleft"
  | "pageright"
  | "tab"
  | "shift+tab";

export interface DataGridCellProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>;
  tableMeta: DataGridTableMeta;
  rowId: string;
  columnId: string;
  rowHeight: RowHeightValue;
  isEditing: boolean;
  isFocused: boolean;
  isSelected: boolean;
  isSearchMatch: boolean;
  isActiveSearchMatch: boolean;
  readOnly: boolean;
}

export interface FileCellData {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export type TextFilterOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty";

export type NumberFilterOperator =
  | "equals"
  | "notEquals"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "isBetween"
  | "isEmpty"
  | "isNotEmpty";

export type DateFilterOperator =
  | "equals"
  | "notEquals"
  | "before"
  | "after"
  | "onOrBefore"
  | "onOrAfter"
  | "isBetween"
  | "isEmpty"
  | "isNotEmpty";

export type SelectFilterOperator =
  | "is"
  | "isNot"
  | "isAnyOf"
  | "isNoneOf"
  | "isEmpty"
  | "isNotEmpty";

export type BooleanFilterOperator = "isTrue" | "isFalse";

export type FilterOperator =
  | TextFilterOperator
  | NumberFilterOperator
  | DateFilterOperator
  | SelectFilterOperator
  | BooleanFilterOperator;

export interface FilterValue {
  operator: FilterOperator;
  value?: string | number | string[];
  endValue?: string | number;
}
