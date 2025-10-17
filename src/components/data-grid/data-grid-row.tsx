"use client";

import { flexRender, type Row } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";

import { getCommonPinningStyles } from "@/lib/data-table";
import type { CellPosition } from "@/types/data-grid";

interface DataGridRowProps<TData> {
  row: Row<TData>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualRowIndex: number;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
  focusedCell: CellPosition | null;
}

export const DataGridRow = React.memo(DataGridRowImpl, (prev, next) => {
  if (prev.row.id !== next.row.id) {
    return false;
  }

  const prevRowIndex = prev.virtualRowIndex;
  const nextRowIndex = next.virtualRowIndex;

  const prevHasFocus = prev.focusedCell?.rowIndex === prevRowIndex;
  const nextHasFocus = next.focusedCell?.rowIndex === nextRowIndex;

  if (prevHasFocus !== nextHasFocus) {
    return false;
  }

  if (nextHasFocus && prevHasFocus) {
    const prevFocusedCol = prev.focusedCell?.columnId;
    const nextFocusedCol = next.focusedCell?.columnId;
    if (prevFocusedCol !== nextFocusedCol) {
      return false;
    }
  }

  if (next.rowVirtualizer.isScrolling) {
    return true;
  }

  return false;
}) as typeof DataGridRowImpl;

function DataGridRowImpl<TData>({
  row,
  virtualRowIndex,
  rowVirtualizer,
  rowMapRef,
  focusedCell: _focusedCell, // Used only in memo comparison
}: DataGridRowProps<TData>) {
  return (
    <div
      data-index={virtualRowIndex}
      ref={(node) => {
        if (node && typeof virtualRowIndex !== "undefined") {
          rowVirtualizer.measureElement(node);
          rowMapRef.current.set(virtualRowIndex, node);
        }
      }}
      key={row.id}
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      data-slot="data-grid-row"
      tabIndex={-1}
      className="absolute flex w-full border-b"
    >
      {row.getVisibleCells().map((cell, colIndex) => (
        <div
          key={cell.id}
          role="gridcell"
          aria-colindex={colIndex + 1}
          data-slot="data-grid-cell"
          tabIndex={-1}
          className="flex h-9 grow items-center justify-center border-r"
          style={{
            ...getCommonPinningStyles({ column: cell.column }),
          }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  );
}
