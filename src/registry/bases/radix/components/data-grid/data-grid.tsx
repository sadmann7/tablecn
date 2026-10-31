"use client";

import {
  type Column,
  flexRender,
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
import { useLayoutEffect } from "radix-ui/internal";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { ColumnWindow } from "@/lib/data-grid-types";
import type { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";

import { useValueAsRef } from "@/hooks/use-value-as-ref";
import {
  getColumnBorderVisibility,
  getColumnPinningStyle,
  getWindowedColumns,
} from "@/lib/data-grid-utils";
import { DataGridColumnHeader } from "@/registry/bases/radix/components/data-grid/data-grid-column-header";
import { DataGridContextMenu } from "@/registry/bases/radix/components/data-grid/data-grid-context-menu";
import { DataGridPasteDialog } from "@/registry/bases/radix/components/data-grid/data-grid-paste-dialog";
import {
  DataGridRow,
  DataGridRowContext,
} from "@/registry/bases/radix/components/data-grid/data-grid-row";
import { DataGridSearch } from "@/registry/bases/radix/components/data-grid/data-grid-search";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const VIEWPORT_OFFSET = 1;
const COLUMN_OVERSCAN = 2;
const SCROLL_JUMP_EXIT_ROWS_PER_COMMIT = 2;

interface DataGridProps<TData extends RowData>
  extends
    ReturnType<typeof useDataGrid<TData>>,
    Omit<React.ComponentProps<"div">, "dir"> {
  height?: number;
  stretchColumns?: boolean;
  actionBar?: React.ReactNode;
}

export function DataGrid<TData extends RowData>({
  table,
  dataGridRef,
  headerRef,
  footerRef,
  rowMapRef,
  rowVirtualizerRef,
  columnVirtualizerRef,
  rowVirtualizerOptions,
  dataGridBodyProps,
  columnSizeVars,
  dir,
  adjustLayout,
  height = 600,
  stretchColumns = false,
  actionBar,
  onRowAdd,
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
        columnVirtualizerRef={columnVirtualizerRef}
        rowVirtualizerOptions={rowVirtualizerOptions}
        dataGridBodyProps={dataGridBodyProps}
        columnSizeVars={columnSizeVars}
        dir={dir}
        adjustLayout={adjustLayout}
        height={height}
        stretchColumns={stretchColumns}
        onRowAdd={onRowAdd}
      />
      {actionBar ? (
        <DataGridActionBar table={table} actionBar={actionBar} />
      ) : null}
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

type DataGridViewportProps<TData extends RowData> = Pick<
  DataGridProps<TData>,
  | "table"
  | "dataGridRef"
  | "headerRef"
  | "footerRef"
  | "rowMapRef"
  | "rowVirtualizerRef"
  | "columnVirtualizerRef"
  | "rowVirtualizerOptions"
  | "dataGridBodyProps"
  | "columnSizeVars"
  | "dir"
  | "adjustLayout"
  | "onRowAdd"
> &
  Required<Pick<DataGridProps<TData>, "height" | "stretchColumns">>;

function DataGridViewport<TData extends RowData>({
  table,
  dataGridRef,
  headerRef,
  footerRef,
  rowMapRef,
  rowVirtualizerRef,
  columnVirtualizerRef,
  rowVirtualizerOptions,
  dataGridBodyProps,
  columnSizeVars,
  dir,
  adjustLayout,
  height,
  stretchColumns,
  onRowAdd: onRowAddProp,
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
  const [insets, setInsets] = React.useState(EMPTY_VIEWPORT_INSETS);

  const isColumnVirtualizationEnabled =
    !stretchColumns && headerGroups.length === 1;
  const enableCellEditing = table.options.enableCellEditing;
  const hasFooter = !readOnly && !!onRowAddProp;
  const insetsKey =
    rows.length * rowSize > height
      ? `overflow:${hasFooter}`
      : `${rows.length}:${rowSize}:${hasFooter}`;

  useLayoutEffect(() => {
    const dataGrid = dataGridRef.current;
    if (!dataGrid) return;
    const header = headerRef.current;
    const footer = footerRef.current;

    const measure = () => {
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
    };

    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [dataGrid, header, footer]) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [dataGridRef, headerRef, footerRef, insetsKey]);

  const isScrollJumpingRef = React.useRef(false);

  const rowRangeExtractor = React.useCallback(
    ({ startIndex, endIndex, overscan: overscanProp, count }: Range) => {
      const overscan = isScrollJumpingRef.current ? 0 : overscanProp;
      const direction = rowVirtualizerRef.current?.scrollDirection ?? null;
      const before =
        direction === "forward"
          ? Math.ceil(overscan / 3)
          : direction === "backward"
            ? overscan * 2 - Math.ceil(overscan / 3)
            : overscan;
      const viewportHeight = rowVirtualizerRef.current?.scrollRect?.height ?? 0;
      const visibleCount =
        viewportHeight > 0
          ? Math.ceil(viewportHeight / rowSize) + 1
          : endIndex - startIndex + 1;
      const total = Math.min(count, visibleCount + overscan * 2);
      const start = Math.max(0, Math.min(startIndex - before, count - total));
      const indexes: number[] = [];
      for (let index = start; index < start + total; index++) {
        indexes.push(index);
      }
      return indexes;
    },
    [rowVirtualizerRef, rowSize],
  );

  const getRowKey = React.useCallback(
    (index: number) => `${index}:${rowSize}`,
    [rowSize],
  );

  const rowVirtualizer = useVirtualizer({
    ...rowVirtualizerOptions,
    rangeExtractor: rowRangeExtractor,
    count: rows.length,
    getScrollElement: () => dataGridRef.current,
    getItemKey: getRowKey,
    estimateSize: () => rowSize,
    scrollPaddingStart: VIEWPORT_OFFSET,
    scrollPaddingEnd: insets.start + insets.end + VIEWPORT_OFFSET,
  });

  const centerColumnsRef = useValueAsRef(centerColumns);

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
  const isScrolling =
    rowVirtualizer.isScrolling || columnVirtualizer.isScrolling;
  const isScrollJumping =
    rowVirtualizer.isScrolling &&
    scrollDelta >
      rowSize *
        (committedScrollRef.current.isJumping
          ? SCROLL_JUMP_EXIT_ROWS_PER_COMMIT
          : rowVirtualizer.options.overscan * 2);
  const deferredIsScrolling = React.useDeferredValue(isScrolling);

  useLayoutEffect(() => {
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

  const columnWindow = React.useMemo(
    () => parseColumnWindowKey(columnWindowKey),
    [columnWindowKey],
  );

  useLayoutEffect(() => {
    columnVirtualizerRef.current = columnVirtualizer;
    return () => {
      if (columnVirtualizerRef.current === columnVirtualizer) {
        columnVirtualizerRef.current = null;
      }
    };
  }, [columnVirtualizerRef, columnVirtualizer]);

  useLayoutEffect(() => {
    rowVirtualizerRef.current = rowVirtualizer;
    return () => {
      if (rowVirtualizerRef.current === rowVirtualizer) {
        rowVirtualizerRef.current = null;
      }
    };
  }, [rowVirtualizerRef, rowVirtualizer]);

  useLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      rowVirtualizer.measure();
      columnVirtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    rowVirtualizer,
    columnVirtualizer,
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `getCanEdit` reads these table options, so they invalidate the set
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

  const onRowAddRef = useValueAsRef(onRowAddProp);

  const onRowAdd = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      void onRowAddRef.current?.(event);
    },
    [onRowAddRef],
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
        void onRowAddRef.current(event);
      }
    },
    [onRowAddRef],
  );

  return (
    <div
      role="grid"
      aria-label="Data grid"
      aria-rowcount={rows.length + 1 + (hasFooter ? 1 : 0)}
      aria-colcount={visibleColumnCount}
      aria-multiselectable="true"
      data-slot="data-grid"
      tabIndex={0}
      ref={dataGridRef}
      className="relative isolate grid overflow-auto rounded-md border select-none focus:outline-none"
      style={{
        ...columnSizeVars,
        maxHeight: `${height}px`,
      }}
      onContextMenu={onDataGridContextMenu}
    >
      <DataGridHeader
        table={table}
        headerRef={headerRef}
        headerGroups={headerGroups}
        columnWindow={columnWindow}
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
        <div
          data-slot="data-grid-rows"
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
            {rowVirtualizer.getVirtualItems().map((virtualItem, _, items) => {
              const row = rows[virtualItem.index];
              if (!row) return null;

              return (
                <DataGridRow
                  key={virtualItem.index % items.length}
                  row={row}
                  leafColumns={leafColumns}
                  virtualItem={virtualItem}
                  columnWindow={columnWindow}
                  isScrolling={isScrolling || deferredIsScrolling}
                />
              );
            })}
          </DataGridRowContext>
        </div>
      </div>
      {hasFooter && (
        <div
          role="rowgroup"
          data-slot="data-grid-footer"
          ref={footerRef}
          className="sticky bottom-0 z-30 grid border-t bg-background"
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

function getColumnsWidth<TData extends RowData>(
  columns: Column<DataGridFeatures, TData>[],
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
  const items = virtualizer.getVirtualItems();
  if (centerCount > 0 && items.length === 0) return "";
  let key = `${startCount}|${centerCount}|${centerStart}|${centerEnd}|`;
  for (const item of items) {
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

interface DataGridHeaderProps<TData extends RowData>
  extends
    Pick<DataGridProps<TData>, "table" | "headerRef">,
    Required<Pick<DataGridProps<TData>, "stretchColumns">> {
  headerGroups: HeaderGroup<DataGridFeatures, TData>[];
  columnWindow: ColumnWindow | null;
}

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
  headerRef,
  headerGroups,
  columnWindow,
  stretchColumns,
}: DataGridHeaderProps<TData>) {
  return (
    <table.Subscribe selector={selectHeaderState}>
      {({ sorting }) => (
        <div
          role="rowgroup"
          data-slot="data-grid-header"
          ref={headerRef}
          className="sticky top-0 z-30 grid border-b bg-background"
        >
          {headerGroups.map((headerGroup, rowIndex) => (
            <div
              key={headerGroup.id}
              role="row"
              aria-rowindex={rowIndex + 1}
              data-slot="data-grid-header-row"
              tabIndex={-1}
              className="flex w-full overflow-x-clip"
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
                      {header.isPlaceholder ? null : header.column.columnDef
                          .header !== undefined &&
                        typeof header.column.columnDef.header !== "string" ? (
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
                          table={table}
                          header={header}
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

function onHeaderCellMouseDown(event: React.MouseEvent<HTMLDivElement>) {
  if (!event.currentTarget.querySelector("button, input, a[href]")) {
    event.preventDefault();
  }
}
