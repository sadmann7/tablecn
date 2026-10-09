"use client";

import {
  type Column,
  type HeaderGroup,
  type RowData,
  type TableState,
} from "@tanstack/react-table";
import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
  type Virtualizer,
} from "@tanstack/react-virtual";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { ColumnWindow, Direction } from "@/lib/data-grid-types";
import type { useDataGrid } from "@/registry/bases/base/hooks/use-data-grid";

import { useAsRef } from "@/hooks/use-as-ref";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import {
  flexRender,
  getColumnBorderVisibility,
  getColumnPinningStyle,
  getWindowedColumns,
} from "@/lib/data-grid-utils";
import { DataGridColumnHeader } from "@/registry/bases/base/components/data-grid/data-grid-column-header";
import { DataGridContextMenu } from "@/registry/bases/base/components/data-grid/data-grid-context-menu";
import { DataGridPasteDialog } from "@/registry/bases/base/components/data-grid/data-grid-paste-dialog";
import {
  DataGridRow,
  DataGridRowContext,
} from "@/registry/bases/base/components/data-grid/data-grid-row";
import { DataGridSearch } from "@/registry/bases/base/components/data-grid/data-grid-search";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const VIEWPORT_OFFSET = 1;
const COLUMN_OVERSCAN = 2;
const SCROLL_JUMP_EXIT_ROWS_PER_COMMIT = 2;

interface DataGridProps<TData extends RowData>
  extends
    Omit<ReturnType<typeof useDataGrid<TData>>, "dir">,
    React.ComponentProps<"div"> {
  dir?: Direction;
  height?: number;
  stretchColumns?: boolean;
  /** Rendered while rows or a range of cells are selected, such as an `ActionBar` with bulk actions. */
  actionBar?: React.ReactNode;
}

export function DataGrid<TData extends RowData>({
  dataGridRef,
  headerRef,
  rowMapRef,
  footerRef,
  dir = "ltr",
  table,
  dataGridBodyProps,
  rowVirtualizerRef,
  rowVirtualizerOptions,
  columnVirtualizerRef,
  columnSizeVars,
  onRowAdd,
  height = 600,
  stretchColumns = false,
  adjustLayout,
  actionBar,
  className,
  ...props
}: DataGridProps<TData>) {
  return (
    <div
      data-slot="data-grid-wrapper"
      dir={dir}
      {...props}
      className={cn("relative flex w-full flex-col", className)}
    >
      {table.options.enableSearch && <DataGridSearch table={table} />}
      <DataGridContextMenu table={table} dataGridRef={dataGridRef} />
      <DataGridPasteDialog table={table} />
      <DataGridViewport
        table={table}
        dataGridRef={dataGridRef}
        headerRef={headerRef}
        footerRef={footerRef}
        rowMapRef={rowMapRef}
        rowVirtualizerRef={rowVirtualizerRef}
        rowVirtualizerOptions={rowVirtualizerOptions}
        columnVirtualizerRef={columnVirtualizerRef}
        dataGridBodyProps={dataGridBodyProps}
        columnSizeVars={columnSizeVars}
        onRowAdd={onRowAdd}
        adjustLayout={adjustLayout}
        dir={dir}
        height={height}
        stretchColumns={stretchColumns}
      />
      {actionBar ? (
        <DataGridActionBar table={table} actionBar={actionBar} />
      ) : null}
    </div>
  );
}

interface DataGridActionBarProps<TData extends RowData> extends Pick<
  DataGridProps<TData>,
  "table"
> {
  actionBar: React.ReactNode;
}

function DataGridActionBar<TData extends RowData>({
  table,
  actionBar,
}: DataGridActionBarProps<TData>) {
  return (
    <table.Subscribe
      selector={() =>
        table.getHasRowSelection() || table.getHasCellRangeSelection()
      }
    >
      {(hasSelection) => (hasSelection ? actionBar : null)}
    </table.Subscribe>
  );
}

type DataGridViewportProps<TData extends RowData> = Pick<
  DataGridProps<TData>,
  | "table"
  | "dataGridRef"
  | "headerRef"
  | "footerRef"
  | "rowMapRef"
  | "rowVirtualizerRef"
  | "rowVirtualizerOptions"
  | "columnVirtualizerRef"
  | "dataGridBodyProps"
  | "columnSizeVars"
  | "onRowAdd"
  | "adjustLayout"
> & {
  dir: Direction;
  height: number;
  stretchColumns: boolean;
};

// Owns the virtualizer and its scroll container so scroll frames re-render here, not in the component calling useDataGrid
function DataGridViewport<TData extends RowData>({
  table,
  dataGridRef,
  headerRef,
  footerRef,
  rowMapRef,
  rowVirtualizerRef,
  rowVirtualizerOptions,
  columnVirtualizerRef,
  dataGridBodyProps,
  columnSizeVars,
  onRowAdd: onRowAddProp,
  adjustLayout,
  dir,
  height,
  stretchColumns,
}: DataGridViewportProps<TData>) {
  const rows = table.getRowModel().rows;
  const rowSize = table.getRowSize();
  const readOnly = table.getIsReadOnly();
  const leafColumns = table.getAllLeafColumns();
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const headerGroups = table.getHeaderGroups();
  const startColumns = table.getStartVisibleLeafColumns();
  const centerColumns = table.getCenterVisibleLeafColumns();
  const startWidth = getColumnsWidth(startColumns);
  const centerWidth = getColumnsWidth(centerColumns);
  const endWidth = getColumnsWidth(table.getEndVisibleLeafColumns());
  const isColumnVirtualizationEnabled =
    !stretchColumns && headerGroups.length === 1;
  const enableCellEditing = table.options.enableCellEditing;
  const hasFooter = !readOnly && !!onRowAddProp;

  const insets = useViewportInsets({
    dataGridRef,
    headerRef,
    footerRef,
    // The footer follows the last row until the body overflows, so row count and height move it
    contentKey: `${rows.length}:${rowSize}:${hasFooter}`,
  });

  const isScrollJumpingRef = React.useRef(false);

  // Spends most of the overscan ahead of the scroll direction, where rows are about to enter
  const rowRangeExtractor = React.useCallback(
    ({ startIndex, endIndex, overscan: overscanProp, count }: Range) => {
      // While jumping, every frame replaces all rows and pinning covers the gap, so overscan rows are wasted mounts
      const overscan = isScrollJumpingRef.current ? 0 : overscanProp;
      const direction = rowVirtualizerRef.current?.scrollDirection ?? null;
      const before =
        direction === "forward"
          ? Math.ceil(overscan / 3)
          : direction === "backward"
            ? overscan * 2
            : overscan;
      const after =
        direction === "forward"
          ? overscan * 2
          : direction === "backward"
            ? Math.ceil(overscan / 3)
            : overscan;
      const start = Math.max(0, startIndex - before);
      const end = Math.min(count - 1, endIndex + after);
      const indexes: Array<number> = [];
      for (let index = start; index <= end; index++) indexes.push(index);
      return indexes;
    },
    [rowVirtualizerRef],
  );

  const rowVirtualizer = useVirtualizer({
    ...rowVirtualizerOptions,
    rangeExtractor: rowRangeExtractor,
    count: rows.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: () => rowSize,
    scrollPaddingStart: insets.start + VIEWPORT_OFFSET,
    // Add extra row buffer to absorb virtual position drift after render measurements
    scrollPaddingEnd: insets.end + rowSize + VIEWPORT_OFFSET,
  });

  const centerColumnsRef = useAsRef(centerColumns);

  // Keeps the focused and editing columns mounted while scrolled away, so keyboard focus and drafts survive
  const columnRangeExtractor = React.useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      const activeColumnIds = [
        table.getFocusedCell()?.column.id,
        table.atoms.editingCell.get()?.columnId,
      ];
      for (const columnId of activeColumnIds) {
        if (!columnId) continue;
        const index = centerColumnsRef.current.findIndex(
          (column) => column.id === columnId,
        );
        if (index !== -1 && !indexes.includes(index)) indexes.push(index);
      }
      return indexes.sort((a, b) => a - b);
    },
    [table, centerColumnsRef],
  );

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    enabled: isColumnVirtualizationEnabled,
    isRtl: dir === "rtl",
    count: centerColumns.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: (index) => centerColumns[index]?.getSize() ?? 0,
    getItemKey: (index) => centerColumns[index]?.id ?? index,
    overscan: COLUMN_OVERSCAN,
    paddingStart: startWidth,
    scrollPaddingStart: startWidth + VIEWPORT_OFFSET,
    scrollPaddingEnd: endWidth + VIEWPORT_OFFSET,
    rangeExtractor: columnRangeExtractor,
  });

  const scrollOffset = rowVirtualizer.scrollOffset ?? 0;
  const committedScrollRef = React.useRef({
    offset: scrollOffset,
    isJumping: false,
  });
  const scrollDelta = Math.abs(
    scrollOffset - committedScrollRef.current.offset,
  );
  // Cells mounted during any scroll start as previews, since they look the same and cost far less to mount
  const isScrolling =
    rowVirtualizer.isScrolling || columnVirtualizer.isScrolling;
  // Jumps past the leading overscan would scroll into blank space before React renders, which scrollbar drags do constantly.
  // Pinned rows only move when the virtualizer re-renders, which it skips until the visible range changes, so unpin once
  // commits slow down instead of holding rows behind a slowing fling and snapping them into place when it stops
  const isScrollJumping =
    rowVirtualizer.isScrolling &&
    scrollDelta >
      rowSize *
        (committedScrollRef.current.isJumping
          ? SCROLL_JUMP_EXIT_ROWS_PER_COMMIT
          : rowVirtualizer.options.overscan * 2);
  // Cells leave preview mode in a transition, so React spreads the upgrade over frames and drops it if scrolling resumes
  const deferredIsScrolling = React.useDeferredValue(isScrolling);

  useIsomorphicLayoutEffect(() => {
    committedScrollRef.current = {
      offset: scrollOffset,
      isJumping: isScrollJumping,
    };
    isScrollJumpingRef.current = isScrollJumping;
  });

  const columnWindowKey = isColumnVirtualizationEnabled
    ? getColumnWindowKey({
        virtualizer: columnVirtualizer,
        startCount: startColumns.length,
        centerCount: centerColumns.length,
        centerStart: startWidth,
        centerEnd: startWidth + centerWidth,
      })
    : "";
  // Rows compare the window by reference, so it only changes when the mounted columns do
  const columnWindow = React.useMemo(
    () => parseColumnWindowKey(columnWindowKey),
    [columnWindowKey],
  );

  useIsomorphicLayoutEffect(() => {
    columnVirtualizerRef.current = columnVirtualizer;
    return () => {
      if (columnVirtualizerRef.current === columnVirtualizer) {
        columnVirtualizerRef.current = null;
      }
    };
  }, [columnVirtualizerRef, columnVirtualizer]);

  useIsomorphicLayoutEffect(() => {
    rowVirtualizerRef.current = rowVirtualizer;
    return () => {
      if (rowVirtualizerRef.current === rowVirtualizer) {
        rowVirtualizerRef.current = null;
      }
    };
  }, [rowVirtualizerRef, rowVirtualizer]);

  useIsomorphicLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      rowVirtualizer.measure();
      columnVirtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    rowVirtualizer,
    columnVirtualizer,
    table.state.rowHeight,
    table.state.columnFilters,
    table.state.columnOrder,
    table.state.columnPinning,
    table.state.columnSizing,
    table.state.columnVisibility,
    table.state.sorting,
  ]);

  const readOnlyColumnIds = React.useMemo(
    () =>
      new Set(
        leafColumns
          .filter((column) => !column.getCanEdit())
          .map((column) => column.id),
      ),
    [leafColumns, readOnly, enableCellEditing],
  );

  const rowContext = React.useMemo(
    () => ({
      stretchColumns,
      adjustLayout,
      readOnlyColumnIds,
      rowMapRef,
    }),
    [stretchColumns, adjustLayout, readOnlyColumnIds, rowMapRef],
  );

  const onRowAddRef = useAsRef(onRowAddProp);

  const onRowAdd = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      void onRowAddRef.current?.(event);
    },
    [onRowAddRef],
  );

  // Skip the grid's own tab stop when Shift+Tab leaves a cell
  const onDataGridKeyDownCapture = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab" || !event.shiftKey) return;
      const container = event.currentTarget;
      if (event.target === container) return;

      container.tabIndex = -1;
      requestAnimationFrame(() => {
        container.tabIndex = 0;
      });
    },
    [],
  );

  const onDataGridContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    [],
  );

  const onFooterCellKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onRowAddRef.current) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void onRowAddRef.current();
      }
    },
    [onRowAddRef],
  );

  return (
    <div
      role="grid"
      aria-label="Data grid"
      aria-rowcount={rows.length + 1 + (!readOnly && onRowAddProp ? 1 : 0)}
      aria-colcount={visibleColumnCount}
      aria-multiselectable="true"
      data-slot="data-grid"
      tabIndex={0}
      ref={dataGridRef}
      className="relative grid overflow-auto rounded-md border select-none focus:outline-none"
      style={{
        ...columnSizeVars,
        maxHeight: `${height}px`,
      }}
      onKeyDownCapture={onDataGridKeyDownCapture}
      onContextMenu={onDataGridContextMenu}
    >
      <DataGridHeader
        table={table}
        headerGroups={headerGroups}
        columnWindow={columnWindow}
        headerRef={headerRef}
        stretchColumns={stretchColumns}
      />
      <div
        role="rowgroup"
        data-slot="data-grid-body"
        {...dataGridBodyProps}
        className="relative grid"
        style={{
          ...dataGridBodyProps.style,
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {/* While jumping, rows are pinned and offset by the rendered scroll position, so the last rendered rows stay on screen when the compositor scrolls ahead of JS. Otherwise they scroll natively so the compositor keeps scrolling smooth */}
        <div
          data-slot="grid-rows"
          data-pinned={isScrollJumping ? "" : undefined}
          className="relative h-0 data-pinned:sticky"
          style={
            isScrollJumping
              ? {
                  top: insets.headerHeight,
                  transform: `translateY(${-scrollOffset}px)`,
                }
              : undefined
          }
        >
          <DataGridRowContext value={rowContext}>
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const row = rows[virtualItem.index];
              if (!row) return null;

              return (
                <DataGridRow
                  key={row.id}
                  row={row}
                  virtualItem={virtualItem}
                  columnWindow={columnWindow}
                  isScrolling={isScrolling || deferredIsScrolling}
                />
              );
            })}
          </DataGridRowContext>
        </div>
      </div>
      {!readOnly && onRowAddProp && (
        <div
          role="rowgroup"
          data-slot="data-grid-footer"
          ref={footerRef}
          className="sticky bottom-0 z-10 grid border-t bg-background"
        >
          <div
            role="row"
            aria-rowindex={rows.length + 2}
            data-slot="data-grid-add-row"
            tabIndex={-1}
            className="flex w-full"
          >
            <div
              role="gridcell"
              tabIndex={0}
              className="relative flex h-9 grow items-center bg-muted/30 transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
              style={{
                width: table.getTotalSize(),
                minWidth: table.getTotalSize(),
              }}
              onClick={onRowAdd}
              onKeyDown={onFooterCellKeyDown}
            >
              <div className="sticky inset-s-0 flex items-center gap-2 px-3 text-muted-foreground">
                <IconPlaceholder
                  lucide="Plus"
                  tabler="IconPlus"
                  hugeicons="PlusSignIcon"
                  phosphor="PlusIcon"
                  remixicon="RiAddLine"
                  className="size-3.5"
                />
                <span className="text-sm">Add row</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ViewportInsets {
  start: number;
  end: number;
  headerHeight: number;
}

const EMPTY_VIEWPORT_INSETS: ViewportInsets = {
  start: 0,
  end: 0,
  headerHeight: 0,
};

// Measures the sticky header and footer on resize instead of on every scroll frame, where reading layout would force it
function useViewportInsets({
  dataGridRef,
  headerRef,
  footerRef,
  contentKey,
}: {
  dataGridRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
  footerRef: React.RefObject<HTMLDivElement | null>;
  contentKey: string;
}) {
  const [insets, setInsets] = React.useState(EMPTY_VIEWPORT_INSETS);

  useIsomorphicLayoutEffect(() => {
    const dataGrid = dataGridRef.current;
    if (!dataGrid) return;
    const header = headerRef.current;
    const footer = footerRef.current;

    function measure() {
      if (!dataGrid) return;
      const gridRect = dataGrid.getBoundingClientRect();
      const next: ViewportInsets = {
        start:
          (header?.getBoundingClientRect().bottom ?? gridRect.top) -
          gridRect.top,
        end:
          gridRect.bottom -
          (footer?.getBoundingClientRect().top ?? gridRect.bottom),
        headerHeight: header?.offsetHeight ?? 0,
      };
      setInsets((prev) =>
        prev.start === next.start &&
        prev.end === next.end &&
        prev.headerHeight === next.headerHeight
          ? prev
          : next,
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [dataGrid, header, footer]) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [dataGridRef, headerRef, footerRef, contentKey]);

  return insets;
}

interface DataGridHeaderProps<TData extends RowData> {
  table: DataGridProps<TData>["table"];
  headerGroups: Array<HeaderGroup<DataGridFeatures, TData>>;
  columnWindow: ColumnWindow | null;
  headerRef: DataGridProps<TData>["headerRef"];
  stretchColumns: boolean;
}

// The viewport re-renders on every scroll frame, so the header only follows its own state
const DataGridHeader = React.memo(
  DataGridHeaderImpl,
  (prev, next) =>
    prev.table.atoms === next.table.atoms &&
    prev.headerGroups === next.headerGroups &&
    prev.columnWindow === next.columnWindow &&
    prev.headerRef === next.headerRef &&
    prev.stretchColumns === next.stretchColumns,
) as typeof DataGridHeaderImpl;

function DataGridHeaderImpl<TData extends RowData>({
  table,
  headerGroups,
  columnWindow,
  headerRef,
  stretchColumns,
}: DataGridHeaderProps<TData>) {
  return (
    <table.Subscribe selector={selectHeaderState}>
      {({ sorting }) => (
        <div
          role="rowgroup"
          data-slot="data-grid-header"
          ref={headerRef}
          className="sticky top-0 z-10 grid border-b bg-background"
        >
          {headerGroups.map((headerGroup, rowIndex) => (
            <div
              key={headerGroup.id}
              role="row"
              aria-rowindex={rowIndex + 1}
              data-slot="data-grid-header-row"
              tabIndex={-1}
              className="flex w-full"
            >
              {getWindowedColumns(headerGroup.headers, columnWindow).map(
                (entry) => {
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

                  const { item: header, colIndex: columnIndex } = entry;
                  const primarySort =
                    sorting[0]?.id === header.column.id ? sorting[0] : null;

                  const nextHeader = headerGroup.headers[columnIndex + 1];
                  const isLastColumn =
                    columnIndex === headerGroup.headers.length - 1;

                  const { showEndBorder, showStartBorder } =
                    getColumnBorderVisibility({
                      column: header.column,
                      nextColumn: nextHeader?.column,
                    });

                  const cornerClassName = cn(
                    rowIndex === 0 && {
                      "rounded-ss-[calc(var(--radius-md)-1px)]":
                        columnIndex === 0,
                      "rounded-se-[calc(var(--radius-md)-1px)]": isLastColumn,
                    },
                  );

                  return (
                    <div
                      key={header.id}
                      role="columnheader"
                      aria-colindex={columnIndex + 1}
                      aria-sort={
                        primarySort
                          ? primarySort.desc
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                      data-slot="data-grid-header-cell"
                      data-column-id={header.column.id}
                      tabIndex={-1}
                      onMouseDown={onHeaderCellMouseDown}
                      className={cn("group/header relative", {
                        grow: stretchColumns && header.column.id !== "select",
                        "border-e":
                          showEndBorder && header.column.id !== "select",
                        "border-s":
                          showStartBorder && header.column.id !== "select",
                      })}
                      style={{
                        ...getColumnPinningStyle(header.column),
                        width: `calc(var(--header-${header.id}-size) * 1px)`,
                      }}
                    >
                      {header.isPlaceholder ? null : typeof header.column
                          .columnDef.header === "function" ? (
                        <div
                          className={cn(
                            "size-full px-3 py-1.5 group-focus-within/header:ring-1 group-focus-within/header:ring-ring group-focus-within/header:ring-inset",
                            cornerClassName,
                          )}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </div>
                      ) : (
                        <DataGridColumnHeader
                          header={header}
                          table={table}
                          className={cornerClassName}
                        />
                      )}
                    </div>
                  );
                },
              )}
            </div>
          ))}
        </div>
      )}
    </table.Subscribe>
  );
}

// A header with nothing to interact with, like the actions column's, shouldn't take focus when clicked
function onHeaderCellMouseDown(event: React.MouseEvent<HTMLDivElement>) {
  if (!event.currentTarget.querySelector("button, input, a[href]")) {
    event.preventDefault();
  }
}

function selectHeaderState(state: TableState<DataGridFeatures>) {
  return {
    sorting: state.sorting,
    columnVisibility: state.columnVisibility,
    columnPinning: state.columnPinning,
    columnOrder: state.columnOrder,
    columnSizing: state.columnSizing,
    columnResizing: state.columnResizing,
  };
}

function getColumnsWidth<TData extends RowData>(
  columns: Array<Column<DataGridFeatures, TData>>,
) {
  let width = 0;
  for (const column of columns) width += column.getSize();
  return width;
}

function getColumnWindowKey(params: {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  startCount: number;
  centerCount: number;
  centerStart: number;
  centerEnd: number;
}) {
  const { virtualizer, startCount, centerCount, centerStart, centerEnd } =
    params;
  let key = `${startCount}|${centerCount}|${centerStart}|${centerEnd}|`;
  for (const item of virtualizer.getVirtualItems()) {
    key += `${item.index}:${item.start}:${item.end},`;
  }
  return key;
}

function parseColumnWindowKey(key: string): ColumnWindow | null {
  if (!key) return null;
  const [startCount, centerCount, centerStart, centerEnd, items = ""] =
    key.split("|");
  return {
    startCount: Number(startCount),
    centerCount: Number(centerCount),
    centerStart: Number(centerStart),
    centerEnd: Number(centerEnd),
    items: items
      .split(",")
      .filter(Boolean)
      .map((item) => {
        const [index, start, end] = item.split(":").map(Number);
        return { index: index ?? 0, start: start ?? 0, end: end ?? 0 };
      }),
  };
}
