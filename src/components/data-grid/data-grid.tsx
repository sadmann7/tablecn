"use client";

import type { Header } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import * as React from "react";
import { DataGridColumnHeader } from "@/components/data-grid/data-grid-column-header";
import { DataGridContextMenu } from "@/components/data-grid/data-grid-context-menu";
import { DataGridPasteDialog } from "@/components/data-grid/data-grid-paste-dialog";
import { DataGridRow } from "@/components/data-grid/data-grid-row";
import { DataGridSearch } from "@/components/data-grid/data-grid-search";
import type { useDataGrid } from "@/hooks/use-data-grid";
import { flexRender, getCommonPinningStyles } from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { Direction } from "@/types/data-grid";
import { DataGridVirtualPadding } from "./data-grid-virtual-padding";

interface DataGridProps<TData>
  extends Omit<ReturnType<typeof useDataGrid<TData>>, "dir">,
    Omit<React.ComponentProps<"div">, "contextMenu"> {
  dir?: Direction;
  height?: number;
  stretchColumns?: boolean;
}

export function DataGrid<TData>({
  dataGridRef,
  headerRef,
  rowMapRef,
  footerRef,
  dir = "ltr",
  table,
  tableMeta,
  rowVirtualizer,
  columnVirtualizer,
  centerColumnIndices,
  columns,
  searchState,
  columnSizeVars,
  cellSelectionMap,
  focusedCell,
  editingCell,
  rowHeight,
  contextMenu,
  pasteDialog,
  onRowAdd,
  height = 600,
  stretchColumns = false,
  className,
  ...props
}: DataGridProps<TData>) {
  const rows = table.getRowModel().rows;
  const readOnly = tableMeta?.readOnly ?? false;
  const columnVisibility = table.getState().columnVisibility;
  const columnPinning = table.getState().columnPinning;
  const leftPinnedIds = new Set(columnPinning?.left ?? []);
  const rightPinnedIds = new Set(columnPinning?.right ?? []);

  const visibleColumns = table.getVisibleLeafColumns();
  const virtualColumns = columnVirtualizer.getVirtualItems();

  let virtualPaddingLeft: number | undefined;
  let virtualPaddingRight: number | undefined;

  if (virtualColumns.length) {
    virtualPaddingLeft = virtualColumns[0]?.start ?? 0;
    virtualPaddingRight =
      columnVirtualizer.getTotalSize() -
      (virtualColumns[virtualColumns.length - 1]?.end ?? 0);
  }

  const onGridContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    [],
  );

  const onAddRowKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onRowAdd) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRowAdd();
      }
    },
    [onRowAdd],
  );

  function renderHeaderCell(
    header: Header<TData, unknown>,
    ariaColIndex: number,
    keyPrefix?: string,
  ) {
    const sorting = table.getState().sorting;
    const currentSort = sorting.find((sort) => sort.id === header.column.id);
    const isSortable = header.column.getCanSort();

    return (
      <div
        key={`${keyPrefix ?? ""}${header.id}`}
        role="columnheader"
        aria-colindex={ariaColIndex}
        aria-sort={
          currentSort?.desc === false
            ? "ascending"
            : currentSort?.desc === true
              ? "descending"
              : isSortable
                ? "none"
                : undefined
        }
        data-slot="grid-header-cell"
        tabIndex={-1}
        className={cn("relative", {
          grow: stretchColumns && header.column.id !== "select",
          "border-e": header.column.id !== "select",
        })}
        style={{
          ...getCommonPinningStyles({
            column: header.column,
            dir,
          }),
          width: `calc(var(--header-${header.id}-size) * 1px)`,
        }}
      >
        {header.isPlaceholder ? null : typeof header.column.columnDef.header ===
          "function" ? (
          <div className="size-full px-3 py-1.5">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        ) : (
          <DataGridColumnHeader header={header} table={table} />
        )}
      </div>
    );
  }

  return (
    <div
      data-slot="grid-wrapper"
      dir={dir}
      {...props}
      className={cn("relative flex w-full flex-col", className)}
    >
      {searchState && <DataGridSearch {...searchState} />}
      <DataGridContextMenu
        tableMeta={tableMeta}
        columns={columns}
        contextMenu={contextMenu}
      />
      <DataGridPasteDialog tableMeta={tableMeta} pasteDialog={pasteDialog} />
      <div
        role="grid"
        aria-label="Data grid"
        aria-rowcount={rows.length + (onRowAdd ? 1 : 0)}
        aria-colcount={columns.length}
        data-slot="grid"
        tabIndex={0}
        ref={dataGridRef}
        className="relative grid select-none overflow-auto rounded-md border focus:outline-none"
        style={{
          ...columnSizeVars,
          maxHeight: `${height}px`,
        }}
        onContextMenu={onGridContextMenu}
      >
        <div
          role="rowgroup"
          data-slot="grid-header"
          ref={headerRef}
          className="sticky top-0 z-10 grid border-b bg-background"
        >
          {table.getHeaderGroups().map((headerGroup, rowIndex) => (
            <div
              key={headerGroup.id}
              role="row"
              aria-rowindex={rowIndex + 1}
              data-slot="grid-header-row"
              tabIndex={-1}
              className="flex w-full"
            >
              {(() => {
                return (
                  <>
                    {/* Left pinned headers */}
                    {headerGroup.headers
                      .filter((h) => leftPinnedIds.has(h.column.id))
                      .map((header, idx) =>
                        renderHeaderCell(header, idx + 1, `left-${idx}-`),
                      )}

                    {/* Center (virtualized) */}
                    <DataGridVirtualPadding
                      virtualPaddingLeft={virtualPaddingLeft}
                      virtualPaddingRight={virtualPaddingRight}
                    >
                      {virtualColumns.map((vc) => {
                        const actualIndex =
                          centerColumnIndices[vc.index] ?? vc.index;
                        const header = headerGroup.headers[actualIndex];
                        if (!header) return null;
                        if (
                          leftPinnedIds.has(header.column.id) ||
                          rightPinnedIds.has(header.column.id) ||
                          header.column.getIsPinned()
                        ) {
                          return null;
                        }
                        return renderHeaderCell(header, actualIndex + 1);
                      })}
                    </DataGridVirtualPadding>

                    {/* Right pinned headers */}
                    {headerGroup.headers
                      .filter((h) => rightPinnedIds.has(h.column.id))
                      .map((header, idx) =>
                        renderHeaderCell(
                          header,
                          visibleColumns.length - idx,
                          `right-${idx}-`,
                        ),
                      )}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
        <div
          role="rowgroup"
          data-slot="grid-body"
          className="relative grid"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            contain: "strict",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index];
            if (!row) return null;

            const cellSelectionKeys =
              cellSelectionMap?.get(virtualItem.index) ?? new Set<string>();

            return (
              <DataGridRow
                key={row.id}
                row={row}
                tableMeta={tableMeta}
                rowMapRef={rowMapRef}
                virtualItem={virtualItem}
                rowVirtualizer={rowVirtualizer}
                rowHeight={rowHeight}
                focusedCell={focusedCell}
                editingCell={editingCell}
                cellSelectionKeys={cellSelectionKeys}
                columnVisibility={columnVisibility}
                columnPinning={columnPinning}
                dir={dir}
                readOnly={readOnly}
                stretchColumns={stretchColumns}
                leftPinnedIds={leftPinnedIds}
                rightPinnedIds={rightPinnedIds}
                centerColumnIndices={centerColumnIndices}
                virtualColumns={virtualColumns}
                virtualPaddingLeft={virtualPaddingLeft}
                virtualPaddingRight={virtualPaddingRight}
              />
            );
          })}
        </div>
        {onRowAdd && (
          <div
            role="rowgroup"
            data-slot="grid-footer"
            ref={footerRef}
            className="sticky bottom-0 z-10 grid border-t bg-background"
          >
            <div
              role="row"
              aria-rowindex={rows.length + 2}
              data-slot="grid-add-row"
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
                onKeyDown={onAddRowKeyDown}
              >
                <div className="sticky start-0 flex items-center gap-2 px-3 text-muted-foreground">
                  <Plus className="size-3.5" />
                  <span className="text-sm">Add row</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
