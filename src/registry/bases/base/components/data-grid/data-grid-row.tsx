"use client";

import type { VirtualItem } from "@tanstack/react-virtual";

import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import {
  type Cell,
  type CellSelectionBounds,
  type Column,
  flexRender,
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
  ColumnWindow,
  DataGridCellProps,
  RowHeightValue,
} from "@/lib/data-grid-types";

import {
  getColumnBorderVisibility,
  getColumnPinningStyle,
  getFocusedCellPosition,
  getHasCustomCell,
  getIsDataColumn,
  getRowCellSelectionKey,
  getRowHeightValue,
  getWindowedColumns,
} from "@/lib/data-grid-utils";
import { DataGridCell } from "@/registry/bases/base/components/data-grid/data-grid-cell";
import { DataGridCellPreview } from "@/registry/bases/base/components/data-grid/data-grid-cell-preview";

const EMPTY_CELL_SELECTION_BOUNDS: Array<CellSelectionBounds> = [];

interface DataGridRowContextValue {
  stretchColumns: boolean;
  adjustLayout: boolean;
  readOnlyColumnIds: Set<string>;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
}

export const DataGridRowContext =
  React.createContext<DataGridRowContextValue | null>(null);

function useDataGridRowContext() {
  const context = React.use(DataGridRowContext);
  if (!context) {
    throw new Error("`DataGridRow` must be rendered within `DataGrid`");
  }
  return context;
}

interface DataGridRowProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  row: Row<DataGridFeatures, TData>;
  leafColumns: Array<Column<DataGridFeatures, TData>>;
  virtualItem: VirtualItem;
  columnWindow: ColumnWindow | null;
  isScrolling: boolean;
}

export const DataGridRow = React.memo(
  DataGridRowImpl,
  (prev, next) =>
    prev.row.id === next.row.id &&
    prev.row.original === next.row.original &&
    prev.leafColumns === next.leafColumns &&
    prev.virtualItem.index === next.virtualItem.index &&
    prev.virtualItem.start === next.virtualItem.start &&
    prev.columnWindow === next.columnWindow &&
    prev.isScrolling === next.isScrolling,
) as typeof DataGridRowImpl;

function DataGridRowImpl<TData extends RowData>({
  row,
  leafColumns: _leafColumns,
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
          virtualItem={virtualItem}
          rowState={rowState}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataGridRowContentProps<TData extends RowData> extends Omit<
  DataGridRowProps<TData>,
  "row" | "leafColumns"
> {
  rowState: RowState<TData>;
}

function DataGridRowContent<TData extends RowData>({
  ref,
  virtualItem,
  columnWindow,
  rowState,
  isScrolling,
  className,
  style,
  ...props
}: DataGridRowContentProps<TData>) {
  const { stretchColumns, adjustLayout, readOnlyColumnIds, rowMapRef } =
    useDataGridRowContext();
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
        rowMapRef.current?.set(virtualRowIndex, node);
      } else {
        rowMapRef.current?.delete(virtualRowIndex);
      }
    },
    [virtualRowIndex, rowMapRef],
  );

  const rowRef = useMergedRefs(ref, onRowChange);

  return (
    <div
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      aria-selected={isRowSelected}
      data-index={virtualRowIndex}
      data-slot="data-grid-row"
      tabIndex={-1}
      {...props}
      ref={rowRef}
      className={cn("absolute flex w-full border-b", className)}
      style={{
        height: `${getRowHeightValue(rowHeight)}px`,
        ...(adjustLayout
          ? { top: `${virtualItem.start}px` }
          : { transform: `translateY(${virtualItem.start}px)` }),
        ...style,
      }}
    >
      {getWindowedColumns(visibleCells, columnWindow).map((entry) => {
        if (entry.type === "spacer") {
          return (
            <div
              key={entry.key}
              aria-hidden="true"
              className="shrink-0"
              style={{ width: entry.size }}
            />
          );
        }

        const { item: cell, colIndex: columnIndex } = entry;
        const columnId = cell.column.id;

        const isCellFocused = focusedColumnId === columnId;
        const isCellEditing = editingColumnId === columnId;
        const isCellSelected = cellSelectionKey !== "" && cell.getIsSelected();
        const isUtilityCell = !getIsDataColumn(cell.column);

        const isSearchMatch = searchMatchColumns?.has(columnId) ?? false;
        const isActiveSearchMatch = activeSearchColumnId === columnId;

        const nextCell = visibleCells[columnIndex + 1];
        const { showEndBorder, showStartBorder } = getColumnBorderVisibility({
          column: cell.column,
          nextColumn: nextCell?.column,
        });

        return (
          <div
            key={columnId}
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
              ...getColumnPinningStyle(cell.column),
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
              <DataGridDataCell
                cell={cell}
                columnIndex={columnIndex}
                width={cell.column.getSize()}
                rowHeight={rowHeight}
                isFocused={isCellFocused}
                isEditing={isCellEditing}
                isSelected={isCellSelected}
                isSearchMatch={isSearchMatch}
                isActiveSearchMatch={isActiveSearchMatch}
                presence={presenceColumns?.get(columnId) ?? null}
                readOnly={readOnlyColumnIds.has(columnId)}
                isScrolling={isScrolling}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DataGridDataCellProps<
  TData extends RowData,
> extends DataGridCellProps<TData> {
  isScrolling: boolean;
}

function DataGridDataCell<TData extends RowData>({
  isScrolling,
  ...props
}: DataGridDataCellProps<TData>) {
  const [isPreview, setIsPreview] = React.useState(isScrolling);
  const rowId = props.cell.row.id;
  const [prevRowId, setPrevRowId] = React.useState(rowId);

  if (rowId !== prevRowId) {
    setPrevRowId(rowId);
    if (isScrolling && !isPreview) setIsPreview(true);
  }
  if (isPreview && !isScrolling) setIsPreview(false);

  if (
    isPreview &&
    !props.isFocused &&
    !props.isEditing &&
    !getHasCustomCell(props.cell.column)
  ) {
    return (
      <DataGridCellPreview
        cell={props.cell}
        columnIndex={props.columnIndex}
        width={props.width}
        rowHeight={props.rowHeight}
        isSelected={props.isSelected}
        isSearchMatch={props.isSearchMatch}
        isActiveSearchMatch={props.isActiveSearchMatch}
        readOnly={props.readOnly}
      />
    );
  }

  return <DataGridCell key={rowId} {...props} />;
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
  const onFocus = React.useCallback(() => {
    const { table, row, column } = cell;
    const ranges = table.atoms.cellSelection.get();
    const focusedCell = getFocusedCellPosition(ranges);
    if (focusedCell?.rowId === row.id && focusedCell.columnId === column.id) {
      return;
    }

    if (table.getHasRowSelection()) {
      table.setCellSelection([
        ...ranges.slice(0, -1),
        {
          anchorRowId: row.id,
          anchorColumnId: column.id,
          focusRowId: row.id,
          focusColumnId: column.id,
        },
      ]);
      return;
    }

    table.setFocusedCell(row.id, column.id);
  }, [cell]);

  return (
    <div
      data-slot="data-grid-utility-cell"
      data-row-id={cell.row.id}
      data-column-id={cell.column.id}
      data-focused={isFocused ? "" : undefined}
      tabIndex={-1}
      onFocus={onFocus}
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
  columnSizing: TableState<DataGridFeatures>["columnSizing"];
  rowHeight: RowHeightValue;
  focusedColumnId: string | null;
  editingColumnId: string | null;
  cellSelectionKey: string;
  searchMatchColumns: Set<string> | null;
  activeSearchColumnId: string | null;
  presenceColumns: Map<string, CellPresence> | null;
  isRowSelected: boolean;
}

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
  const currentRow = table.getRowModel().rows[rowIndex];

  return {
    visibleCells: (currentRow?.id === rowId
      ? currentRow
      : row
    ).getVisibleCells(),
    columnSizing: state.columnSizing,
    rowHeight: state.rowHeight,
    focusedColumnId:
      state.focusedHeaderColumnId === null && activeRange?.anchorRowId === rowId
        ? activeRange.anchorColumnId
        : null,
    editingColumnId: editingCell?.rowId === rowId ? editingCell.columnId : null,
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
