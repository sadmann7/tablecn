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
import { flexRender, getCommonPinningStyles } from "@/lib/data-grid";
import { cn } from "@/lib/utils";

interface DataGridCellProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  rowIndex: number;
  columnId: string;
  colIndex: number;
  isFocused: boolean;
  isEditing: boolean;
  isSelected: boolean;
  isRowSelected: boolean;
  readOnly: boolean;
  dir: "ltr" | "rtl";
  stretchColumns?: boolean;
}

// Memoize with stable props - this works because we now receive primitive
// boolean props instead of reading from unstable table.options.meta
export const DataGridCell = React.memo(DataGridCellImpl, (prev, next) => {
  // Fast path: check stable primitive props first
  if (prev.isFocused !== next.isFocused) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isRowSelected !== next.isRowSelected) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.columnId !== next.columnId) return false;
  if (prev.colIndex !== next.colIndex) return false;
  if (prev.dir !== next.dir) return false;
  if (prev.stretchColumns !== next.stretchColumns) return false;

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
  colIndex,
  isFocused,
  isEditing,
  isSelected,
  isRowSelected,
  readOnly,
  dir,
  stretchColumns = false,
}: DataGridCellProps<TData>) {
  const cellOpts = cell.column.columnDef.meta?.cell;
  const variant = cellOpts?.variant ?? "text";

  // Render cell content based on variant or custom render function
  const cellContent = (() => {
    // Check if it's a custom cell with header function (custom render)
    if (typeof cell.column.columnDef.header === "function") {
      return (
        <div
          className={cn("size-full px-3 py-1.5", {
            "bg-primary/10": isRowSelected,
          })}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      );
    }

    // Standard cell variants
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
  })();

  // Wrap cell content with container div
  return (
    <div
      role="gridcell"
      aria-colindex={colIndex + 1}
      data-highlighted={isFocused ? "" : undefined}
      data-slot="grid-cell"
      tabIndex={-1}
      className={cn({
        grow: stretchColumns && columnId !== "select",
        "border-e": columnId !== "select",
      })}
      style={{
        ...getCommonPinningStyles({ column: cell.column, dir }),
        width: `calc(var(--col-${columnId}-size) * 1px)`,
      }}
    >
      {cellContent}
    </div>
  );
}
