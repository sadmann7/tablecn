"use client";

import { flexRender, type Table } from "@tanstack/react-table";
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
    <div className={cn("flex w-full flex-col gap-2", className)} {...props}>
      <div
        role="grid"
        aria-label="Data grid"
        aria-rowcount={rows.length}
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
        </div>
      </div>
      {onRowAdd && <Button onClick={onRowAdd}>Add Row</Button>}
    </div>
  );
}
