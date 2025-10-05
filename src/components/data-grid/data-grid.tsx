"use client";

import { flexRender, type Row, type Table } from "@tanstack/react-table";
import type { Virtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import * as React from "react";

import { DataGridColumnHeader } from "@/components/data-grid/data-grid-column-header";
import { DataGridRow } from "@/components/data-grid/data-grid-row";
import type { useDataGrid } from "@/hooks/use-data-grid";
import { getCommonPinningStyles } from "@/lib/data-table";
import { cn } from "@/lib/utils";
import type { ScrollToOptions } from "@/types/data-grid";

interface DataGridProps<TData>
  extends ReturnType<typeof useDataGrid<TData>>,
    React.ComponentProps<"div"> {
  height?: number;
  onRowAdd?: () =>
    | ScrollToOptions
    | undefined
    | Promise<ScrollToOptions | undefined>;
}

export function DataGrid<TData>({
  dataGridRef,
  table,
  rowVirtualizer,
  rowMapRef,
  scrollToRow,
  height = 600,
  onRowAdd: onRowAddProp,
  className,
  ...props
}: DataGridProps<TData>) {
  const rows = table.getRowModel().rows;
  const columns = table.getAllColumns();

  const onRowAdd = React.useCallback(async () => {
    if (!onRowAddProp) return;

    const result = await onRowAddProp();

    requestAnimationFrame(() => {
      if (result && typeof result === "object" && "rowIndex" in result) {
        const adjustedRowIndex =
          result.rowIndex >= rows.length ? rows.length : result.rowIndex;

        scrollToRow({
          rowIndex: adjustedRowIndex,
          columnId: result.columnId,
        });
      } else {
        scrollToRow({ rowIndex: rows.length });
      }
    });
  }, [onRowAddProp, scrollToRow, rows.length]);

  return (
    <div className={cn("flex w-full flex-col", className)} {...props}>
      <div
        role="grid"
        aria-label="Data grid"
        aria-rowcount={rows.length + (onRowAddProp ? 1 : 0)}
        aria-colcount={columns.length}
        tabIndex={0}
        ref={dataGridRef}
        className="relative select-none overflow-auto rounded-md border focus:outline-none"
        style={{
          height: `${height}px`,
        }}
      >
        <div className="grid">
          <div
            role="rowgroup"
            className="sticky top-0 z-10 grid border-b bg-background"
          >
            {table.getHeaderGroups().map((headerGroup, rowIndex) => (
              <div
                key={headerGroup.id}
                role="row"
                aria-rowindex={rowIndex + 1}
                data-slot="header-row"
                tabIndex={-1}
                className="flex w-full"
              >
                {headerGroup.headers.map((header, colIndex) => {
                  const sorting = table.getState().sorting;
                  const currentSort = sorting.find(
                    (sort) => sort.id === header.column.id,
                  );
                  const isSortable = header.column.getCanSort();

                  return (
                    <div
                      key={header.id}
                      role="columnheader"
                      aria-colindex={colIndex + 1}
                      aria-sort={
                        currentSort?.desc === false
                          ? "ascending"
                          : currentSort?.desc === true
                            ? "descending"
                            : isSortable
                              ? "none"
                              : undefined
                      }
                      data-slot="header-cell"
                      tabIndex={-1}
                      className="grow border-r"
                      style={{
                        ...getCommonPinningStyles({ column: header.column }),
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <DataGridColumnHeader header={header} table={table} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div
            role="rowgroup"
            className="relative grid"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualIndexes().map((virtualRowIndex) => {
              const row = rows[virtualRowIndex];
              if (!row) return null;

              return (
                <DataGridRow
                  key={row.id}
                  row={row}
                  virtualRowIndex={virtualRowIndex}
                  rowVirtualizer={rowVirtualizer}
                  rowMapRef={rowMapRef}
                />
              );
            })}
          </div>
          {onRowAdd && (
            <div
              role="rowgroup"
              className="sticky bottom-0 z-10 grid border-t bg-background"
            >
              <div
                role="row"
                aria-rowindex={rows.length + 2}
                data-slot="add-row"
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
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowAdd();
                    }
                  }}
                >
                  <div className="sticky left-0 flex items-center gap-2 px-3 text-muted-foreground">
                    <Plus className="size-3.5" />
                    <span className="text-sm">Add row</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
