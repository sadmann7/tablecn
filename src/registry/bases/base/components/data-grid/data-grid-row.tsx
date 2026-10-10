"use client";

import type { VirtualItem } from "@tanstack/react-virtual";

import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import {
  type Cell,
  type CellSelectionBounds,
  type Row,
  type RowData,
  Subscribe,
  type Table,
  type TableState,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type {
  CellPresence,
  Direction,
  RowHeightValue,
} from "@/lib/data-grid-types";

import {
  flexRender,
  getColumnBorderVisibility,
  getColumnPinningStyle,
  getRowCellSelectionKey,
  getRowHeightValue,
} from "@/lib/data-grid-utils";
import { DataGridCell } from "@/registry/bases/base/components/data-grid/data-grid-cell";

const EMPTY_CELL_SELECTION_BOUNDS: Array<CellSelectionBounds> = [];

interface DataGridRowContextValue {
  dir: Direction;
  stretchColumns: boolean;
  adjustLayout: boolean;
  readOnlyColumnIds: Set<string>;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
  measureElement: (node: Element | null) => void;
}

export const DataGridRowContext =
  React.createContext<DataGridRowContextValue | null>(null);

function useDataGridRowContext() {
  const context = React.use(DataGridRowContext);
  if (!context) {
    throw new Error("DataGridRow must be rendered within DataGrid");
  }
  return context;
}

interface DataGridRowProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  row: Row<DataGridFeatures, TData>;
  virtualItem: VirtualItem;
}

// Grid layout comes from context and table state comes from the row's subscription
export const DataGridRow = React.memo(
  DataGridRowImpl,
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.row.original === next.row.original &&
    prev.virtualItem.index === next.virtualItem.index &&
    prev.virtualItem.start === next.virtualItem.start,
) as typeof DataGridRowImpl;

function DataGridRowImpl<TData extends RowData>({
  row,
  virtualItem,
  ...props
}: DataGridRowProps<TData>) {
  const table = row.table;
  const rowIndex = virtualItem.index;

  return (
    <Subscribe
      source={table.store}
      selector={(state) => selectRowState(table, state, row, rowIndex)}
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
  rowState: RowState<TData>;
}

function DataGridRowContent<TData extends RowData>({
  row,
  virtualItem,
  rowState,
  className,
  style,
  ref,
  ...props
}: DataGridRowContentProps<TData>) {
  const {
    dir,
    stretchColumns,
    adjustLayout,
    readOnlyColumnIds,
    rowMapRef,
    measureElement,
  } = useDataGridRowContext();
  const virtualRowIndex = virtualItem.index;
  const {
    visibleCells,
    rowHeight,
    focusedColumnId,
    editingColumnId,
    cellSelectionKey,
    searchMatchColumns,
    activeSearchColumnId,
    presenceColumns,
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

  return (
    <div
      key={row.id}
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      aria-selected={isRowSelected}
      data-index={virtualRowIndex}
      data-slot="data-grid-row"
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
      {visibleCells.map((cell, columnIndex) => {
        const columnId = cell.column.id;

        const isCellFocused = focusedColumnId === columnId;
        const isCellEditing = editingColumnId === columnId;
        const isCellSelected = cellSelectionKey !== "" && cell.getIsSelected();
        const isUtilityCell =
          typeof cell.column.columnDef.header === "function";

        const isSearchMatch = searchMatchColumns?.has(columnId) ?? false;
        const isActiveSearchMatch = activeSearchColumnId === columnId;

        const nextCell = visibleCells[columnIndex + 1];
        const isLastColumn = columnIndex === visibleCells.length - 1;
        const { showEndBorder, showStartBorder } = getColumnBorderVisibility({
          column: cell.column,
          nextColumn: nextCell?.column,
          isLastColumn,
        });

        return (
          <div
            key={cell.id}
            role={isUtilityCell ? "gridcell" : "none"}
            aria-colindex={isUtilityCell ? columnIndex + 1 : undefined}
            data-slot="data-grid-cell"
            data-column-id={columnId}
            data-highlighted={isCellFocused ? "" : undefined}
            tabIndex={isUtilityCell ? -1 : undefined}
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
                isFocused={isCellFocused}
                isRowSelected={isRowSelected}
              />
            ) : (
              <DataGridCell
                cell={cell}
                columnIndex={columnIndex}
                rowHeight={rowHeight}
                isFocused={isCellFocused}
                isEditing={isCellEditing}
                isSelected={isCellSelected}
                isSearchMatch={isSearchMatch}
                isActiveSearchMatch={isActiveSearchMatch}
                presence={presenceColumns?.get(columnId) ?? null}
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
  isFocused: boolean;
  isRowSelected: boolean;
}

const DataGridUtilityCell = React.memo(
  DataGridUtilityCellImpl,
) as typeof DataGridUtilityCellImpl;

function DataGridUtilityCellImpl<TData extends RowData>({
  cell,
  isFocused,
  isRowSelected,
}: DataGridUtilityCellProps<TData>) {
  return (
    <div
      data-slot="data-grid-utility-cell"
      data-row-id={cell.row.id}
      data-column-id={cell.column.id}
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

interface RowState<TData extends RowData> {
  visibleCells: Array<Cell<DataGridFeatures, TData>>;
  rowHeight: RowHeightValue;
  focusedColumnId: string | null;
  editingColumnId: string | null;
  /** Selected column spans for this row, `""` when none of its cells are selected. */
  cellSelectionKey: string;
  searchMatchColumns: Set<string> | null;
  activeSearchColumnId: string | null;
  presenceColumns: Map<string, CellPresence> | null;
  isRowSelected: boolean;
}

// Only primitives and memoized references, so the shallow compare skips rows whose slice didn't change
function selectRowState<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  state: TableState<DataGridFeatures>,
  row: Row<DataGridFeatures, TData>,
  rowIndex: number,
): RowState<TData> {
  const rowId = row.id;
  const activeRange = state.cellSelection[state.cellSelection.length - 1];
  const editingCell = state.editingCell;
  const activeSearchMatch = table.getActiveSearchMatch();
  const cellSelectionBounds =
    table.options.enableSingleCellSelection || table.getHasCellRangeSelection()
      ? table.getCellSelectionBounds()
      : EMPTY_CELL_SELECTION_BOUNDS;

  const isRowSelected = !!state.rowSelection[rowId];

  return {
    visibleCells: row.getVisibleCells(),
    rowHeight: state.rowHeight,
    focusedColumnId:
      state.focusedHeaderColumnId === null && activeRange?.anchorRowId === rowId
        ? activeRange.anchorColumnId
        : null,
    editingColumnId: editingCell?.rowId === rowId ? editingCell.columnId : null,
    // While rows are selected, only their cells highlight, not the focused cell that keeps focus in place
    cellSelectionKey:
      !isRowSelected && getHasKeys(state.rowSelection)
        ? ""
        : getRowCellSelectionKey(cellSelectionBounds, rowIndex),
    searchMatchColumns: table.getSearchMatchesByRowId().get(rowId) ?? null,
    activeSearchColumnId:
      activeSearchMatch?.rowId === rowId ? activeSearchMatch.columnId : null,
    presenceColumns: table.getCellPresenceByRowId().get(rowId) ?? null,
    isRowSelected,
  };
}

function getHasKeys(object: object) {
  for (const _ in object) return true;
  return false;
}
