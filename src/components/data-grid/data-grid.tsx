"use client";

import { type ColumnDef, flexRender } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import { useDataGrid } from "@/hooks/use-data-grid";
import { cn } from "@/lib/utils";
import type { ScrollToOptions } from "@/types/data-grid";

interface DataGridProps<TData> extends React.ComponentProps<"div"> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onDataChange?: (data: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;
  height?: number;
  estimateRowSize?: number;
  overscan?: number;
  enableSorting?: boolean;
  onRowAdd?: () =>
    | ScrollToOptions
    | undefined
    | Promise<ScrollToOptions | undefined>;
}

export function DataGrid<TData>({
  data,
  columns,
  onDataChange,
  getRowId,
  height = 600,
  estimateRowSize = 35,
  overscan = 3,
  enableSorting = true,
  onRowAdd: onRowAddProp,
  className,
  ...props
}: DataGridProps<TData>) {
  const { gridRef, table, rows, rowVirtualizer, scrollToRowAndFocusCell } =
    useDataGrid({
      data,
      columns,
      onDataChange,
      getRowId,
      enableSorting,
      estimateRowSize,
      overscan,
    });

  React.useEffect(() => {
    function onCellMouseUp() {
      table.options.meta?.onCellMouseUp?.();
    }

    document.addEventListener("mouseup", onCellMouseUp);
    return () => {
      document.removeEventListener("mouseup", onCellMouseUp);
    };
  }, [table]);

  const onRowAdd = React.useCallback(async () => {
    if (!onRowAddProp) return;

    const result = await onRowAddProp();

    requestAnimationFrame(() => {
      if (result && typeof result === "object" && "rowIndex" in result) {
        const adjustedRowIndex =
          result.rowIndex >= data.length ? data.length : result.rowIndex;

        scrollToRowAndFocusCell({
          rowIndex: adjustedRowIndex,
          columnId: result.columnId,
        });
      } else {
        scrollToRowAndFocusCell({ rowIndex: data.length });
      }
    });
  }, [onRowAddProp, scrollToRowAndFocusCell, data.length]);

  return (
    <div className={cn("w-full", className)} {...props}>
      <div
        ref={gridRef}
        className="relative select-none overflow-auto rounded-md border focus:outline-none"
        style={{
          height: `${height}px`,
        }}
        role="grid"
        tabIndex={0}
        aria-label="Data grid"
        aria-rowcount={data.length}
        aria-colcount={columns.length}
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
                  const isAscending = header.column.getIsSorted() === "asc";
                  const isDescending = header.column.getIsSorted() === "desc";
                  const isSortable = header.column.getCanSort();

                  return (
                    <div
                      key={header.id}
                      role="columnheader"
                      aria-colindex={colIndex + 1}
                      aria-sort={
                        isAscending
                          ? "ascending"
                          : isDescending
                            ? "descending"
                            : isSortable
                              ? "none"
                              : undefined
                      }
                      data-slot="header-cell"
                      tabIndex={isSortable ? 0 : -1}
                      className={cn(
                        "flex items-center gap-2 truncate border-r px-3 py-2 font-medium text-sm",
                        isSortable ? "cursor-pointer" : "cursor-default",
                      )}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          header.column.getToggleSortingHandler()?.(event);
                        }
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {enableSorting && (
                        <>
                          {isAscending && (
                            <ChevronUp
                              size={16}
                              className="text-muted-foreground"
                            />
                          )}
                          {isDescending && (
                            <ChevronDown
                              size={16}
                              className="text-muted-foreground"
                            />
                          )}
                        </>
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
      {onRowAdd && (
        <div className="mt-4">
          <button
            onClick={onRowAdd}
            className={cn(
              "rounded-md border border-primary/20 bg-primary/10 px-4 py-2 font-medium text-primary text-sm transition-colors hover:bg-primary/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            Add Row
          </button>
        </div>
      )}
    </div>
  );
}
