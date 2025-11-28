"use client";

import type { Cell, Row, Table, VisibilityState } from "@tanstack/react-table";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { DataGridCell } from "@/components/data-grid/data-grid-cell";
import { useComposedRefs } from "@/lib/compose-refs";
import {
  flexRender,
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

  // Re-render if row data (original) reference changed
  if (prev.row.original !== next.row.original) {
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

// Memoized cell wrapper component to prevent unnecessary re-renders
interface CellWrapperProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  virtualRowIndex: number;
  colIndex: number;
  focusedCell: CellPosition | null;
  editingCell: CellPosition | null;
  selectionState?: SelectionState;
  isRowSelected: boolean;
  dir: "ltr" | "rtl";
  readOnly: boolean;
  stretchColumns?: boolean;
}

const CellWrapper = React.memo(function CellWrapper<TData>({
  cell,
  table,
  virtualRowIndex,
  colIndex,
  focusedCell,
  editingCell,
  selectionState,
  isRowSelected,
  dir,
  readOnly,
  stretchColumns = false,
}: CellWrapperProps<TData>) {
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
}, (prev, next) => {
  // Memoization comparison for cell wrapper
  if (prev.cell.id !== next.cell.id) return false;
  if (prev.virtualRowIndex !== next.virtualRowIndex) return false;
  if (prev.colIndex !== next.colIndex) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.isRowSelected !== next.isRowSelected) return false;
  if (prev.stretchColumns !== next.stretchColumns) return false;
  
  // Check if focus state changed for this cell
  const prevFocused = prev.focusedCell?.rowIndex === prev.virtualRowIndex &&
    prev.focusedCell?.columnId === prev.cell.column.id;
  const nextFocused = next.focusedCell?.rowIndex === next.virtualRowIndex &&
    next.focusedCell?.columnId === next.cell.column.id;
  if (prevFocused !== nextFocused) return false;
  
  // Check if editing state changed for this cell
  const prevEditing = prev.editingCell?.rowIndex === prev.virtualRowIndex &&
    prev.editingCell?.columnId === prev.cell.column.id;
  const nextEditing = next.editingCell?.rowIndex === next.virtualRowIndex &&
    next.editingCell?.columnId === next.cell.column.id;
  if (prevEditing !== nextEditing) return false;
  
  // Check if selection state changed
  if (prev.selectionState?.selectedCells !== next.selectionState?.selectedCells) return false;
  
  // Check cell value using row.original for stability
  const prevValue = (prev.cell.row.original as Record<string, unknown>)[prev.cell.column.id];
  const nextValue = (next.cell.row.original as Record<string, unknown>)[next.cell.column.id];
  if (prevValue !== nextValue) return false;
  
  return true;
}) as <TData>(props: CellWrapperProps<TData>) => React.ReactElement;

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
  // columnVisibility is used in the memo comparison
  columnVisibility: _columnVisibility,
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

  // Memoize visible cells to avoid recreating cell array on every render
  // Though TanStack returns new Cell wrappers, memoizing the array helps React's reconciliation
  const visibleCells = React.useMemo(() => row.getVisibleCells(), [row]);

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
      {visibleCells.map((cell, colIndex) => (
        <CellWrapper
          key={cell.id}
          cell={cell}
          table={table}
          virtualRowIndex={virtualRowIndex}
          colIndex={colIndex}
          focusedCell={focusedCell}
          editingCell={editingCell}
          selectionState={selectionState}
          isRowSelected={isRowSelected}
          dir={dir}
          readOnly={readOnly}
          stretchColumns={stretchColumns}
        />
      ))}
    </div>
  );
}
