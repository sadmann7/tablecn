"use client";

import type { Cell, Table } from "@tanstack/react-table";
import * as React from "react";

import {
  CheckboxCell,
  DateCell,
  NumberCell,
  SelectCell,
  TextCell,
} from "@/components/data-grid/data-grid-cell-variants";

interface DataGridCellProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
}

export function DataGridCell<TData>({ cell, table }: DataGridCellProps<TData>) {
  const meta = table.options.meta;
  const originalRowIndex = cell.row.index;

  const rows = table.getRowModel().rows;
  const displayRowIndex = rows.findIndex(
    (row) => row.original === cell.row.original,
  );
  const rowIndex = displayRowIndex >= 0 ? displayRowIndex : originalRowIndex;
  const columnId = cell.column.id;

  const isFocused =
    meta?.focusedCell?.rowIndex === rowIndex &&
    meta?.focusedCell?.columnId === columnId;
  const isEditing =
    meta?.editingCell?.rowIndex === rowIndex &&
    meta?.editingCell?.columnId === columnId;
  const isSelected = meta?.getIsCellSelected?.(rowIndex, columnId) ?? false;
  const hasMultipleSelection =
    (meta?.selectionState?.selectedCells?.size ?? 0) > 1;

  const cellVariant = cell.column.columnDef.meta?.cellVariant;
  const variantType = cellVariant?.type || "text";

  const cellProps = {
    cell,
    table,
    rowIndex,
    columnId,
    isFocused,
    isEditing,
    isSelected,
    hasMultipleSelection,
  };

  switch (variantType) {
    case "number":
      return <NumberCell {...cellProps} />;
    case "select":
      return <SelectCell {...cellProps} />;
    case "checkbox":
      return <CheckboxCell {...cellProps} />;
    case "date":
      return <DateCell {...cellProps} />;
    case "text":
    default:
      return <TextCell {...cellProps} />;
  }
}
