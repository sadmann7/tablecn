"use client";

import {
  type HeaderGroup,
  type RowData,
  type TableState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { Direction } from "@/lib/data-grid-types";
import type { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";

import { useAsRef } from "@/hooks/use-as-ref";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import {
  flexRender,
  getColumnBorderVisibility,
  getColumnPinningStyle,
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

interface DataGridProps<TData extends RowData>
  extends
    Omit<ReturnType<typeof useDataGrid<TData>>, "dir">,
    React.ComponentProps<"div"> {
  dir?: Direction;
  height?: number;
  stretchColumns?: boolean;
  /** Rendered while any rows are selected, such as an `ActionBar` with bulk row actions. */
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
        dataGridBodyProps={dataGridBodyProps}
        columnSizeVars={columnSizeVars}
        onRowAdd={onRowAdd}
        adjustLayout={adjustLayout}
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
    <table.Subscribe selector={() => table.getHasRowSelection()}>
      {(hasRowSelection) => (hasRowSelection ? actionBar : null)}
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
  | "dataGridBodyProps"
  | "columnSizeVars"
  | "onRowAdd"
  | "adjustLayout"
> & {
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
  dataGridBodyProps,
  columnSizeVars,
  onRowAdd: onRowAddProp,
  adjustLayout,
  height,
  stretchColumns,
}: DataGridViewportProps<TData>) {
  const rows = table.getRowModel().rows;
  const rowSize = table.getRowSize();
  const readOnly = table.getIsReadOnly();
  const leafColumns = table.getAllLeafColumns();
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const { enableCellEditing } = table.options;

  const rowVirtualizer = useVirtualizer({
    ...rowVirtualizerOptions,
    count: rows.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: () => rowSize,
    scrollPaddingStart:
      (headerRef.current?.getBoundingClientRect().bottom ?? 0) -
      (dataGridRef.current?.getBoundingClientRect().top ?? 0) +
      VIEWPORT_OFFSET,
    // Add extra row buffer to absorb virtual position drift after render measurements
    scrollPaddingEnd:
      (dataGridRef.current?.getBoundingClientRect().bottom ?? 0) -
      (footerRef.current?.getBoundingClientRect().top ??
        dataGridRef.current?.getBoundingClientRect().bottom ??
        0) +
      rowSize +
      VIEWPORT_OFFSET,
  });

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
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    rowVirtualizer,
    table.state.rowHeight,
    table.state.columnFilters,
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
      measureElement: rowVirtualizer.measureElement,
    }),
    [
      stretchColumns,
      adjustLayout,
      readOnlyColumnIds,
      rowMapRef,
      rowVirtualizer.measureElement,
    ],
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
        headerGroups={table.getHeaderGroups()}
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
        <DataGridRowContext value={rowContext}>
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index];
            if (!row) return null;

            return (
              <DataGridRow key={row.id} row={row} virtualItem={virtualItem} />
            );
          })}
        </DataGridRowContext>
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

interface DataGridHeaderProps<TData extends RowData> {
  table: DataGridProps<TData>["table"];
  headerGroups: Array<HeaderGroup<DataGridFeatures, TData>>;
  headerRef: DataGridProps<TData>["headerRef"];
  stretchColumns: boolean;
}

// The viewport re-renders on every scroll frame, so the header only follows its own state
const DataGridHeader = React.memo(
  DataGridHeaderImpl,
  (prev, next) =>
    prev.table.atoms === next.table.atoms &&
    prev.headerGroups === next.headerGroups &&
    prev.headerRef === next.headerRef &&
    prev.stretchColumns === next.stretchColumns,
) as typeof DataGridHeaderImpl;

function DataGridHeaderImpl<TData extends RowData>({
  table,
  headerGroups,
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
              {headerGroup.headers.map((header, columnIndex) => {
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
              })}
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
