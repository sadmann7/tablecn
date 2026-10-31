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

export interface ColumnSelectOption {
  label: string;
  value: string;
  count?: number;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
}

export type PlainColumnVariant = "text" | "long-text" | "url" | "date";

export interface ColumnVariantOptions {
  number: {
    min?: number;
    max?: number;
    step?: number;
    format?: Intl.NumberFormatOptions;
  };
  boolean: {
    control?: "checkbox" | "switch";
  };
  select: {
    options: ColumnSelectOption[];
  };
  "multi-select": {
    options: ColumnSelectOption[];
  };
  file: {
    maxFileSize?: number;
    maxFiles?: number;
    accept?: string;
    multiple?: boolean;
  };
}

export type ColumnVariant = PlainColumnVariant | keyof ColumnVariantOptions;

export type ColumnVariantMeta =
  | { variant?: PlainColumnVariant }
  | {
      [TVariant in keyof ColumnVariantOptions]: {
        variant: TVariant;
      } & ColumnVariantOptions[TVariant];
    }[keyof ColumnVariantOptions];

export type DataGridColumnMeta = {
  label?: string;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
  writeCell?: (element: HTMLElement, value: unknown) => void;
} & ColumnVariantMeta;

export interface FileCellData {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface CellPosition {
  rowId: string;
  columnId: string;
}

export interface CellPresence extends CellPosition {
  name: string;
  color: string;
}

export interface EditingCell extends CellPosition {
  pendingChar?: string;
}

export interface StartEditingOptions {
  pendingChar?: string;
}

export interface StopEditingOptions {
  direction?: NavigationDirection;
  moveToNextRow?: boolean;
}

export interface CellUpdate {
  rowId: string;
  columnId: string;
  value: unknown;
}

export interface RowUpdate {
  rowId: string;
  values: Record<string, unknown>;
}

export interface UpdateCellsOptions {
  batch?: boolean;
  history?: boolean;
}

export interface CellChange {
  rowId: string;
  columnId: string;
  previousValue: unknown;
  newValue: unknown;
}

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
  changes: CellChange[];
  addedRows: TData[];
  removedRows: TData[];
}

export interface AddRowsOptions {
  afterRowId?: string;
  beforeRowId?: string;
}

export type CreateRowDetails =
  | {
      reason: "add-row-press";
      event?:
        | React.MouseEvent<HTMLDivElement>
        | React.KeyboardEvent<HTMLDivElement>;
    }
  | { reason: "insert-below"; event: KeyboardEvent; afterRowId: string }
  | { reason: "paste"; event?: undefined };

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
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
