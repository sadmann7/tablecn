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
  rowIndex: number;
  columnId: string;
  isFocused: boolean;
  isEditing: boolean;
  isSelected: boolean;
  readOnly: boolean;
}

// Memoize with stable props - this works because we now receive primitive
// boolean props instead of reading from unstable table.options.meta
export const DataGridCell = React.memo(DataGridCellImpl, (prev, next) => {
  // Fast path: check stable primitive props first
  if (prev.isFocused !== next.isFocused) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.columnId !== next.columnId) return false;

  // Check cell value using row.original instead of getValue() for stability
  // getValue() is unstable and recreates on every render, breaking memoization
  const prevValue = (prev.cell.row.original as Record<string, unknown>)[
    prev.columnId
  ];
  const nextValue = (next.cell.row.original as Record<string, unknown>)[
    next.columnId
  ];
  if (prevValue !== nextValue) {
    return false;
  }

  // Check cell/row identity
  if (prev.cell.row.id !== next.cell.row.id) return false;

  return true;
}) as typeof DataGridCellImpl;

function DataGridCellImpl<TData>({
  cell,
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
  readOnly,
}: DataGridCellProps<TData>) {
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
