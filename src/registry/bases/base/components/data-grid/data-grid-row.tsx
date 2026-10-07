"use client";

import type { VirtualItem } from "@tanstack/react-virtual";

import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import {
  type Cell,
  type CellSelectionBounds,
  type ColumnPinningState,
  type ColumnVisibilityState,
  type Row,
  type RowData,
  Subscribe,
  type Table,
  type TableState,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { Direction, RowHeightValue } from "@/lib/data-grid-types";

import {
  flexRender,
  getColumnBorderVisibility,
  getColumnPinningStyle,
  getRowCellSelectionKey,
  getRowHeightValue,
} from "@/lib/data-grid-utils";
import { DataGridCell } from "@/registry/bases/base/components/data-grid/data-grid-cell";

const EMPTY_CELL_SELECTION_BOUNDS: Array<CellSelectionBounds> = [];

interface DataGridRowProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  row: Row<DataGridFeatures, TData>;
  virtualItem: VirtualItem;
  measureElement: (node: Element | null) => void;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
  rowHeight: RowHeightValue;
  columnVisibility: ColumnVisibilityState;
  columnPinning: ColumnPinningState;
  dir: Direction;
  readOnlyColumnIds: Set<string>;
  stretchColumns: boolean;
  adjustLayout: boolean;
}

export const DataGridRow = React.memo(DataGridRowImpl, (prev, next) => {
  // Re-render if row identity changed
  if (prev.row.id !== next.row.id) {
    return false;
  }

  // Re-render if the row moved, since the row map and aria-rowindex are positional
  if (prev.virtualItem.index !== next.virtualItem.index) {
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

  // Re-render if column visibility changed
  if (prev.columnVisibility !== next.columnVisibility) {
    return false;
  }

  // Re-render if row height changed
  if (prev.rowHeight !== next.rowHeight) {
    return false;
  }

  // Re-render if column pinning state changed
  if (prev.columnPinning !== next.columnPinning) {
    return false;
  }

  // Re-render if table or column editing permissions changed
  if (prev.readOnlyColumnIds !== next.readOnlyColumnIds) {
    return false;
  }

  // Re-render if direction changed
  if (prev.dir !== next.dir) {
    return false;
  }

  // Re-render if adjustLayout state changed
  if (prev.adjustLayout !== next.adjustLayout) {
    return false;
  }

  // Re-render if stretchColumns changed
  if (prev.stretchColumns !== next.stretchColumns) {
    return false;
  }

  // Skip re-render - props are equal
  return true;
}) as typeof DataGridRowImpl;

function DataGridRowImpl<TData extends RowData>({
  row,
  virtualItem,
  ...props
}: DataGridRowProps<TData>) {
  const table = row.table;
  const rowId = row.id;
  const rowIndex = virtualItem.index;

  return (
    <Subscribe
      source={table.store}
      selector={(state) => selectRowState(table, state, rowId, rowIndex)}
    >
      {(rowState) => (
        <DataGridRowContent
          row={row}
          virtualItem={virtualItem}
          rowState={rowState}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataGridRowContentProps<
  TData extends RowData,
> extends DataGridRowProps<TData> {
  rowState: RowState;
}

function DataGridRowContent<TData extends RowData>({
  row,
  virtualItem,
  measureElement,
  rowMapRef,
  rowHeight,
  columnVisibility,
  columnPinning,
  rowState,
  dir,
  readOnlyColumnIds,
  stretchColumns,
  adjustLayout,
  className,
  style,
  ref,
  ...props
}: DataGridRowContentProps<TData>) {
  const virtualRowIndex = virtualItem.index;
  const rowId = row.id;
  const {
    focusedColumnId,
    editingColumnId,
    cellSelectionKey,
    searchMatchColumns,
    activeSearchColumnId,
    isRowSelected,
  } = rowState;

  const onRowChange = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof virtualRowIndex === "undefined") return;

      if (node) {
        measureElement(node);
        rowMapRef.current?.set(virtualRowIndex, node);
      } else {
        rowMapRef.current?.delete(virtualRowIndex);
      }
    },
    [virtualRowIndex, measureElement, rowMapRef],
  );

  const rowRef = useMergedRefs(ref, onRowChange);

  // Memoize visible cells to avoid recreating cell array on every render
  // Though TanStack returns new Cell wrappers, memoizing the array helps React's reconciliation
  const visibleCells = React.useMemo(
    () => row.getVisibleCells(),
    [row, columnVisibility, columnPinning],
  );

  return (
    <div
      key={row.id}
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      aria-selected={isRowSelected}
      data-index={virtualRowIndex}
      data-slot="grid-row"
      tabIndex={-1}
      {...props}
      ref={rowRef}
      className={cn(
        "absolute flex w-full border-b [content-visibility:auto]",
        !adjustLayout && "will-change-transform",
        className,
      )}
      style={{
        height: `${getRowHeightValue(rowHeight)}px`,
        ...(adjustLayout
          ? { top: `${virtualItem.start}px` }
          : { transform: `translateY(${virtualItem.start}px)` }),
        ...style,
      }}
    >
      {visibleCells.map((cell, colIndex) => {
        const columnId = cell.column.id;

        const isCellFocused = focusedColumnId === columnId;
        const isCellEditing = editingColumnId === columnId;
        const isCellSelected = cellSelectionKey !== "" && cell.getIsSelected();
        const isUtilityCell =
          typeof cell.column.columnDef.header === "function";

        const isSearchMatch = searchMatchColumns?.has(columnId) ?? false;
        const isActiveSearchMatch = activeSearchColumnId === columnId;

        const nextCell = visibleCells[colIndex + 1];
        const isLastColumn = colIndex === visibleCells.length - 1;
        const { showEndBorder, showStartBorder } = getColumnBorderVisibility({
          column: cell.column,
          nextColumn: nextCell?.column,
          isLastColumn,
        });

        return (
          <div
            key={cell.id}
            role="gridcell"
            aria-colindex={colIndex + 1}
            aria-selected={isUtilityCell ? undefined : isCellSelected}
            data-slot="grid-cell"
            data-column-id={columnId}
            data-highlighted={isCellFocused ? "" : undefined}
            tabIndex={-1}
            className={cn({
              grow: stretchColumns && columnId !== "select",
              "border-e": showEndBorder && columnId !== "select",
              "border-s": showStartBorder && columnId !== "select",
            })}
            style={{
              ...getColumnPinningStyle({ column: cell.column, dir }),
              width: `calc(var(--col-${columnId}-size) * 1px)`,
            }}
          >
            {isUtilityCell ? (
              <DataGridUtilityCell
                cell={cell}
                rowId={rowId}
                columnId={columnId}
                isFocused={isCellFocused}
                isRowSelected={isRowSelected}
              />
            ) : (
              <DataGridCell
                cell={cell}
                rowId={rowId}
                columnId={columnId}
                rowHeight={rowHeight}
                isFocused={isCellFocused}
                isEditing={isCellEditing}
                isSelected={isCellSelected}
                isSearchMatch={isSearchMatch}
                isActiveSearchMatch={isActiveSearchMatch}
                readOnly={readOnlyColumnIds.has(columnId)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DataGridUtilityCellProps<TData extends RowData> {
  cell: Cell<DataGridFeatures, TData>;
  rowId: string;
  columnId: string;
  isFocused: boolean;
  isRowSelected: boolean;
}

function DataGridUtilityCell<TData extends RowData>({
  cell,
  rowId,
  columnId,
  isFocused,
  isRowSelected,
}: DataGridUtilityCellProps<TData>) {
  return (
    <div
      data-slot="grid-utility-cell"
      data-row-id={rowId}
      data-column-id={columnId}
      data-focused={isFocused ? "" : undefined}
      tabIndex={-1}
      className={cn("size-full px-3 py-1.5 outline-none", {
        "bg-primary/10": isRowSelected,
        "ring-1 ring-ring ring-inset": isFocused,
      })}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
}

interface RowState {
  focusedColumnId: string | null;
  editingColumnId: string | null;
  /** Selected column spans for this row, `""` when none of its cells are selected. */
  cellSelectionKey: string;
  searchMatchColumns: Set<string> | null;
  activeSearchColumnId: string | null;
  isRowSelected: boolean;
}

// Only primitives and memoized references, so the shallow compare skips rows whose slice didn't change
function selectRowState<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  state: TableState<DataGridFeatures>,
  rowId: string,
  rowIndex: number,
): RowState {
  const activeRange = state.cellSelection[state.cellSelection.length - 1];
  const editingCell = state.editingCell;
  const activeSearchMatch = table.getActiveSearchMatch();
  const cellSelectionBounds =
    table.options.enableSingleCellSelection || table.getHasCellRangeSelection()
      ? table.getCellSelectionBounds()
      : EMPTY_CELL_SELECTION_BOUNDS;

  return {
    focusedColumnId:
      activeRange?.anchorRowId === rowId ? activeRange.anchorColumnId : null,
    editingColumnId: editingCell?.rowId === rowId ? editingCell.columnId : null,
    cellSelectionKey: getRowCellSelectionKey(cellSelectionBounds, rowIndex),
    searchMatchColumns: table.getSearchMatchesByRowId().get(rowId) ?? null,
    activeSearchColumnId:
      activeSearchMatch?.rowId === rowId ? activeSearchMatch.columnId : null,
    isRowSelected: !!state.rowSelection[rowId],
  };
}
