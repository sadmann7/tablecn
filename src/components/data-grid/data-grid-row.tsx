"use client";

import {
  flexRender,
  type Row,
  type Table,
  type VisibilityState,
} from "@tanstack/react-table";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { DataGridCell } from "@/components/data-grid/data-grid-cell";
import { useComposedRefs } from "@/lib/compose-refs";
import {
  getCellKey,
  getCommonPinningStyles,
  getRowHeightValue,
} from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type {
  CellPosition,
  RowHeightValue,
  SelectionState,
} from "@/types/data-grid";

interface DataGridRowProps<TData> extends React.ComponentProps<"div"> {
  row: Row<TData>;
  table: Table<TData>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItem: VirtualItem;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
  rowHeight: RowHeightValue;
  focusedCell: CellPosition | null;
  editingCell: CellPosition | null;
  selectionState?: SelectionState;
  columnVisibility?: VisibilityState;
  dir: "ltr" | "rtl";
  readOnly: boolean;
  stretchColumns?: boolean;
}

export const DataGridRow = React.memo(DataGridRowImpl, (prev, next) => {
  // Re-render if row identity changed
  if (prev.row.id !== next.row.id) {
    return false;
  }

  // Re-render if virtual position changed (handles transform updates)
  if (prev.virtualItem.start !== next.virtualItem.start) {
    return false;
  }

  const prevRowIndex = prev.virtualItem.index;
  const nextRowIndex = next.virtualItem.index;

  // Re-render if focus state changed for this row
  const prevHasFocus = prev.focusedCell?.rowIndex === prevRowIndex;
  const nextHasFocus = next.focusedCell?.rowIndex === nextRowIndex;

  if (prevHasFocus !== nextHasFocus) {
    return false;
  }

  // Re-render if focused column changed within this row
  if (nextHasFocus && prevHasFocus) {
    if (prev.focusedCell?.columnId !== next.focusedCell?.columnId) {
      return false;
    }
  }

  // Re-render if editing state changed for this row
  const prevHasEditing = prev.editingCell?.rowIndex === prevRowIndex;
  const nextHasEditing = next.editingCell?.rowIndex === nextRowIndex;

  if (prevHasEditing !== nextHasEditing) {
    return false;
  }

  // Re-render if editing column changed within this row
  if (nextHasEditing && prevHasEditing) {
    if (prev.editingCell?.columnId !== next.editingCell?.columnId) {
      return false;
    }
  }

  // Re-render if selection state changed (different Set reference means selection changed)
  if (
    prev.selectionState?.selectedCells !== next.selectionState?.selectedCells
  ) {
    return false;
  }

  // Re-render if column visibility changed
  if (prev.columnVisibility !== next.columnVisibility) {
    return false;
  }

  // Re-render if row height changed
  if (prev.rowHeight !== next.rowHeight) {
    return false;
  }

  // Re-render if readOnly changed
  if (prev.readOnly !== next.readOnly) {
    return false;
  }

  // Skip re-render - props are equal
  return true;
}) as typeof DataGridRowImpl;

function DataGridRowImpl<TData>({
  row,
  table,
  virtualItem,
  rowVirtualizer,
  rowMapRef,
  rowHeight,
  focusedCell,
  editingCell,
  selectionState,
  dir,
  readOnly,
  stretchColumns = false,
  className,
  style,
  ref,
  ...props
}: DataGridRowProps<TData>) {
  const virtualRowIndex = virtualItem.index;

  const onRowChange = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof virtualRowIndex === "undefined") return;

      if (node) {
        rowVirtualizer.measureElement(node);
        rowMapRef.current?.set(virtualRowIndex, node);
      } else {
        rowMapRef.current?.delete(virtualRowIndex);
      }
    },
    [virtualRowIndex, rowVirtualizer, rowMapRef],
  );

  const rowRef = useComposedRefs(ref, onRowChange);

  const isRowSelected = row.getIsSelected();

  return (
    <div
      key={row.id}
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      aria-selected={isRowSelected}
      data-index={virtualRowIndex}
      data-slot="grid-row"
      ref={rowRef}
      tabIndex={-1}
      className={cn(
        "absolute flex w-full border-b will-change-transform",
        className,
      )}
      style={{
        height: `${getRowHeightValue(rowHeight)}px`,
        transform: `translateY(${virtualItem.start}px)`,
        ...style,
      }}
      {...props}
    >
      {row.getVisibleCells().map((cell, colIndex) => {
        const columnId = cell.column.id;
        const isCellFocused =
          focusedCell?.rowIndex === virtualRowIndex &&
          focusedCell?.columnId === columnId;
        const isCellEditing =
          editingCell?.rowIndex === virtualRowIndex &&
          editingCell?.columnId === columnId;
        const isCellSelected =
          selectionState?.selectedCells.has(
            getCellKey(virtualRowIndex, columnId),
          ) ?? false;

        return (
          <div
            key={cell.id}
            role="gridcell"
            aria-colindex={colIndex + 1}
            data-highlighted={isCellFocused ? "" : undefined}
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
            {typeof cell.column.columnDef.header === "function" ? (
              <div
                className={cn("size-full px-3 py-1.5", {
                  "bg-primary/10": isRowSelected,
                })}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ) : (
              <DataGridCell
                cell={cell}
                table={table}
                rowIndex={virtualRowIndex}
                columnId={columnId}
                isFocused={isCellFocused}
                isEditing={isCellEditing}
                isSelected={isCellSelected}
                readOnly={readOnly}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
