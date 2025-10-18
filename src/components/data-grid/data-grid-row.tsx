"use client";

import { flexRender, type Row } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { useComposedRefs } from "@/lib/compose-refs";
import { getCommonPinningStyles } from "@/lib/data-table";
import { cn } from "@/lib/utils";
import type { CellPosition } from "@/types/data-grid";

interface DataGridRowProps<TData> extends React.ComponentProps<"div"> {
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
  focusedCell,
  ref,
  className,
  ...props
}: DataGridRowProps<TData>) {
  const rowRef = useComposedRefs(ref, (node) => {
    if (node && typeof virtualRowIndex !== "undefined") {
      rowVirtualizer.measureElement(node);
      rowMapRef.current.set(virtualRowIndex, node);
    }
  });

  return (
    <div
      data-index={virtualRowIndex}
      key={row.id}
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      data-slot="data-grid-row"
      ref={rowRef}
      tabIndex={-1}
      className={cn("absolute flex w-full border-b", className)}
      {...props}
    >
      {row.getVisibleCells().map((cell, colIndex) => {
        const isCellFocused =
          focusedCell?.rowIndex === virtualRowIndex &&
          focusedCell?.columnId === cell.column.id;

        return (
          <div
            key={cell.id}
            role="gridcell"
            aria-colindex={colIndex + 1}
            data-highlighted={isCellFocused ? "" : undefined}
            data-slot="data-grid-cell"
            tabIndex={-1}
            className={cn("flex h-9 grow items-center justify-center", {
              "border-r": cell.column.id !== "select",
            })}
            style={{
              ...getCommonPinningStyles({ column: cell.column }),
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}
    </div>
  );
}
