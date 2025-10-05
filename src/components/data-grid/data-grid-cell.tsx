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

  const cellOpts = cell.column.columnDef.meta?.cell;
  const variant = cellOpts?.variant ?? "text";

  switch (variant) {
    case "number":
      return (
        <NumberCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isFocused={isFocused}
          isEditing={isEditing}
          isSelected={isSelected}
        />
      );
    case "select":
      return (
        <SelectCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isFocused={isFocused}
          isEditing={isEditing}
          isSelected={isSelected}
        />
      );
    case "checkbox":
      return (
        <CheckboxCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isFocused={isFocused}
          isEditing={isEditing}
          isSelected={isSelected}
        />
      );
    case "date":
      return (
        <DateCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isFocused={isFocused}
          isEditing={isEditing}
          isSelected={isSelected}
        />
      );
    case "text":
      return (
        <TextCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isFocused={isFocused}
          isEditing={isEditing}
          isSelected={isSelected}
        />
      );
    default:
      return (
        <TextCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isFocused={isFocused}
          isEditing={isEditing}
          isSelected={isSelected}
        />
      );
  }
}
