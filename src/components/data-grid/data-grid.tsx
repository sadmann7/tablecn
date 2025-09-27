"use client";

import { flexRender, type Table } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import * as React from "react";

import { DataGridColumnHeader } from "@/components/data-grid/data-grid-column-header";
import { Button } from "@/components/ui/button";
import type { useDataGrid } from "@/hooks/use-data-grid";
import { cn } from "@/lib/utils";
import type { ScrollToOptions } from "@/types/data-grid";

interface DataGridProps<TData>
  extends React.ComponentProps<"div">,
    Pick<
      ReturnType<typeof useDataGrid>,
      "gridRef" | "rowVirtualizer" | "scrollToRow"
    > {
  table: Table<TData>;
  height?: number;
  onRowAdd?: () =>
    | ScrollToOptions
    | undefined
    | Promise<ScrollToOptions | undefined>;
}

export function DataGrid<TData>({
  gridRef,
  table,
  rowVirtualizer,
  scrollToRow,
  height = 600,
  onRowAdd: onRowAddProp,
  className,
  ...props
}: DataGridProps<TData>) {
  const rows = table.getRowModel().rows;
  const columns = table.getAllColumns();

  console.log({ sorting: table.getState().sorting });

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
        ref={gridRef}
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
                      className="border-r"
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
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
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={virtualRow.index + 2}
                  data-index={virtualRow.index}
                  data-slot="row"
                  tabIndex={-1}
                  ref={(node) => rowVirtualizer.measureElement(node)}
                  className="absolute flex w-full border-b"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell, colIndex) => (
                    <div
                      key={cell.id}
                      role="gridcell"
                      aria-colindex={colIndex + 1}
                      data-slot="cell"
                      tabIndex={-1}
                      className="flex h-9 w-full items-center border-r"
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  ))}
                </div>
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
                  className="flex h-9 w-full items-center gap-2 bg-muted/30 px-3 transition-colors hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
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
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-sm">Add row</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
