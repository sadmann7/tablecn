"use client";

import type { Cell, Table } from "@tanstack/react-table";
import * as React from "react";

import {
  CheckboxCell,
  DateCell,
  FileCell,
  LongTextCell,
  MultiSelectCell,
  NumberCell,
  SelectCell,
  ShortTextCell,
  UrlCell,
} from "@/components/data-grid/data-grid-cell-variants";

interface DataGridCellProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
}

function DataGridCellImpl<TData>({ cell, table }: DataGridCellProps<TData>) {
  const meta = table.options.meta;
  // cell.row.index is already the index in the current row model (after sorting/filtering)
  const rowIndex = cell.row.index;
  const columnId = cell.column.id;

  const isFocused =
    meta?.focusedCell?.rowIndex === rowIndex &&
    meta?.focusedCell?.columnId === columnId;
  const isEditing =
    meta?.editingCell?.rowIndex === rowIndex &&
    meta?.editingCell?.columnId === columnId;
  const isSelected = meta?.getIsCellSelected?.(rowIndex, columnId) ?? false;
  const readOnly = meta?.readOnly ?? false;

  const cellOpts = cell.column.columnDef.meta?.cell;
  const variant = cellOpts?.variant ?? "text";

  switch (variant) {
    case "short-text":
      return (
        <ShortTextCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
    case "long-text":
      return (
        <LongTextCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
    case "number":
      return (
        <NumberCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
    case "url":
      return (
        <UrlCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
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
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
    case "select":
      return (
        <SelectCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
    case "multi-select":
      return (
        <MultiSelectCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
    case "date":
      return (
        <DateCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
    case "file":
      return (
        <FileCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );

    default:
      return (
        <ShortTextCell
          cell={cell}
          table={table}
          rowIndex={rowIndex}
          columnId={columnId}
          isEditing={isEditing}
          isFocused={isFocused}
          isSelected={isSelected}
          readOnly={readOnly}
        />
      );
  }
}

// Memoize with custom comparison to avoid re-renders from unstable cell.getContext()
export const DataGridCell = React.memo(DataGridCellImpl, (prev, next) => {
  // Re-render if cell value changed
  if (prev.cell.getValue() !== next.cell.getValue()) {
    return false;
  }

  // Re-render if row/column identity changed
  if (prev.cell.row.id !== next.cell.row.id) {
    return false;
  }
  if (prev.cell.column.id !== next.cell.column.id) {
    return false;
  }

  // Re-render if focus/editing state changed for this cell
  const prevMeta = prev.table.options.meta;
  const nextMeta = next.table.options.meta;
  const prevRowIndex = prev.cell.row.index;
  const nextRowIndex = next.cell.row.index;
  const prevColumnId = prev.cell.column.id;
  const nextColumnId = next.cell.column.id;

  const prevIsFocused =
    prevMeta?.focusedCell?.rowIndex === prevRowIndex &&
    prevMeta?.focusedCell?.columnId === prevColumnId;
  const nextIsFocused =
    nextMeta?.focusedCell?.rowIndex === nextRowIndex &&
    nextMeta?.focusedCell?.columnId === nextColumnId;

  if (prevIsFocused !== nextIsFocused) {
    return false;
  }

  const prevIsEditing =
    prevMeta?.editingCell?.rowIndex === prevRowIndex &&
    prevMeta?.editingCell?.columnId === prevColumnId;
  const nextIsEditing =
    nextMeta?.editingCell?.rowIndex === nextRowIndex &&
    nextMeta?.editingCell?.columnId === nextColumnId;

  if (prevIsEditing !== nextIsEditing) {
    return false;
  }

  // Re-render if selection state changed for this cell
  const prevIsSelected =
    prevMeta?.getIsCellSelected?.(prevRowIndex, prevColumnId) ?? false;
  const nextIsSelected =
    nextMeta?.getIsCellSelected?.(nextRowIndex, nextColumnId) ?? false;

  if (prevIsSelected !== nextIsSelected) {
    return false;
  }

  // Re-render if row selection changed
  if (prev.cell.row.getIsSelected() !== next.cell.row.getIsSelected()) {
    return false;
  }

  // Re-render if readOnly changed
  if (prevMeta?.readOnly !== nextMeta?.readOnly) {
    return false;
  }

  // Skip re-render - props are equal
  return true;
}) as typeof DataGridCellImpl;
