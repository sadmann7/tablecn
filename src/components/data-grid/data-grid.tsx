"use client";

import { type ColumnDef, flexRender } from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import { useDataGrid } from "@/hooks/use-data-grid";
import { cn } from "@/lib/utils";

interface ScrollToOptions {
  rowIndex: number;
  columnId?: string;
}

interface DataGridProps<TData> extends React.ComponentProps<"div"> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onDataChange?: (data: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;
  height?: number;
  estimateRowSize?: number;
  overscan?: number;
  enableSorting?: boolean;
  onRowAdd?: () => ScrollToOptions | undefined;
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
    });

  const onRowAdd = React.useCallback(() => {
    if (!onRowAddProp) return;

    const result = onRowAddProp();

    // Use requestAnimationFrame to ensure the data has been updated and DOM has re-rendered
    requestAnimationFrame(() => {
      if (result && typeof result === "object" && "rowIndex" in result) {
        // If user provided specific scroll options, use them
        // But adjust rowIndex to account for the newly added row if it seems to be referencing the old data length
        const adjustedRowIndex =
          result.rowIndex >= data.length ? data.length : result.rowIndex;
        scrollToRowAndFocusCell({
          rowIndex: adjustedRowIndex,
          columnId: result.columnId,
        });
      } else {
        // Default behavior: scroll to the last row (newly added) and focus first cell
        scrollToRowAndFocusCell({ rowIndex: data.length });
      }
    });
  }, [onRowAddProp, scrollToRowAndFocusCell, data.length]);

  return (
    <div className={cn("w-full", className)} {...props}>
      <div
        ref={gridRef}
        className="relative overflow-auto rounded-md border"
        style={{
          height: `${height}px`,
        }}
      >
        <div className="grid">
          <div className="sticky top-0 z-10 grid border-b bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="flex w-full">
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    role="button"
                    tabIndex={header.column.getCanSort() ? 0 : -1}
                    className={cn(
                      "flex items-center gap-2 truncate border-r px-3 py-2 font-medium text-sm",
                      header.column.getCanSort()
                        ? "cursor-pointer"
                        : "cursor-default",
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
                        {header.column.getIsSorted() === "asc" && (
                          <ChevronUp
                            size={16}
                            className="text-muted-foreground"
                          />
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <ChevronDown
                            size={16}
                            className="text-muted-foreground"
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div
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
                  data-index={virtualRow.index}
                  ref={(node) => rowVirtualizer.measureElement(node)}
                  className="absolute flex w-full border-b"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      data-grid-cell
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
            className="rounded-md border border-primary/20 bg-primary/10 px-4 py-2 font-medium text-primary text-sm transition-colors hover:bg-primary/20"
          >
            Add Row
          </button>
        </div>
      )}
    </div>
  );
}
