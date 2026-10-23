import type {
  Cell,
  ColumnPinningPosition,
  RowData,
} from "@tanstack/react-table";
import type * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

export type Direction = "ltr" | "rtl";

export type RowHeightValue = "short" | "medium" | "tall" | "extra-tall";

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

export interface CellPosition {
  rowId: string;
  columnId: string;
}

export interface CellUpdate {
  rowId: string;
  columnId: string;
  value: unknown;
}

/** A cell whose value `onDataChange` reports as changed. */
export interface CellChange {
  rowId: string;
  columnId: string;
  previousValue: unknown;
  newValue: unknown;
}

/**
 * What changed the data: an edit or paste in the grid, `table.updateCells`,
 * `table.addRows`, `table.deleteRows`, or an undo or redo.
 */
export type DataChangeReason =
  | "edit"
  | "paste"
  | "update-cells"
  | "add-rows"
  | "delete-rows"
  | "undo"
  | "redo";

export interface DataChangeDetails<TData = unknown> {
  reason: DataChangeReason;
  /** Every cell whose value changed, so consumers don't need to diff the data. */
  changes: CellChange[];
  addedRows: TData[];
  removedRows: TData[];
}

/** Why the grid asks `createRow` for a row. */
export type CreateRowDetails =
  | {
      reason: "add-row-press";
      event?:
        | React.MouseEvent<HTMLDivElement>
        | React.KeyboardEvent<HTMLDivElement>;
    }
  | { reason: "insert-below"; event: KeyboardEvent; afterRowId: string }
  | { reason: "paste"; event?: undefined };

/** Where `addRows` puts the rows: after or before an existing row, or at the end. */
export interface AddRowsOptions {
  afterRowId?: string;
  beforeRowId?: string;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}

/** Several cells of one row, keyed by column ID. */
export interface RowUpdate {
  rowId: string;
  values: Record<string, unknown>;
}

export interface UpdateCellsOptions {
  /**
   * Applies the values once a frame, keeping each cell's latest, and reports them
   * through `onDataChange` once per `batchUpdateDelay`, for live data that updates
   * many times a second. Rows out of view take their values when they come into
   * view or at the next `onDataChange`.
   */
  batch?: boolean;
  /** Records the update for undo. Defaults to true, except for batched updates. */
  history?: boolean;
}

export interface CellPresence extends CellPosition {
  name: string;
  color: string;
}

export interface FileCellData {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

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

export interface DataGridColumnMeta {
  label?: string;
  cell?: CellOpts;
}

export interface ColumnValueReader<TData extends RowData = RowData> {
  (row: { original: TData; index: number }): unknown;
}

export interface ColumnWindowItem {
  index: number;
  start: number;
  end: number;
}

export interface ColumnWindow {
  items: ColumnWindowItem[];
  centerStart: number;
  centerEnd: number;
  startCount: number;
  centerCount: number;
}

export interface DataGridCellProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>;
  columnIndex: number;
  width: number;
  rowHeight: RowHeightValue;
  isEditing: boolean;
  isFocused: boolean;
  isSelected: boolean;
  isSearchMatch: boolean;
  isActiveSearchMatch: boolean;
  presence: CellPresence | null;
  readOnly: boolean;
  pinned: ColumnPinningPosition;
  pinnedOffset: number;
  grow: boolean;
  showStartBorder: boolean;
  showEndBorder: boolean;
}

export interface ClipboardNotice {
  variant: "success" | "error";
  message: string;
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
