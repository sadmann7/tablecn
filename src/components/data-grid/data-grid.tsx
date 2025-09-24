"use client";

import { type ColumnDef, flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as React from "react";

import { DataGridCell } from "@/components/data-grid/data-grid-cell";
import { useDataGrid } from "@/hooks/use-data-grid";
import { cn } from "@/lib/utils";

interface DataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onDataChange?: (data: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;
  className?: string;
  height?: number;
  estimateRowSize?: number;
  overscan?: number;
  enableSorting?: boolean;
  onAddRow?: () => void;
}

export function DataGrid<TData>({
  data,
  columns,
  onDataChange,
  getRowId,
  className,
  height = 600,
  estimateRowSize = 35,
  overscan = 5,
  enableSorting = true,
  onAddRow,
}: DataGridProps<TData>) {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // Default column with editable cell
  const defaultColumn: Partial<ColumnDef<TData>> = React.useMemo(
    () => ({
      cell: ({ cell, table }) => <DataGridCell cell={cell} table={table} />,
    }),
    [],
  );

  const { table, rows } = useDataGrid({
    data,
    columns,
    onDataChange,
    getRowId,
    enableSorting,
    defaultColumn,
  });

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimateRowSize,
    overscan,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={tableContainerRef}
        className="overflow-auto rounded-md border"
        style={{
          height: `${height}px`,
          position: "relative",
        }}
      >
        {/* Table with CSS Grid for virtualization */}
        <div style={{ display: "grid" }}>
          {/* Header */}
          <div
            style={{
              display: "grid",
              position: "sticky",
              top: 0,
              zIndex: 10,
              backgroundColor: "hsl(var(--background))",
              borderBottom: "1px solid hsl(var(--border))",
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <div
                key={headerGroup.id}
                style={{
                  display: "flex",
                  width: "100%",
                }}
              >
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 12px",
                      fontWeight: "500",
                      fontSize: "14px",
                      borderRight: "1px solid hsl(var(--border))",
                      width: header.getSize(),
                      minWidth: header.getSize(),
                      cursor: header.column.getCanSort()
                        ? "pointer"
                        : "default",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        header.column.getToggleSortingHandler()?.(e);
                      }
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                    role="button"
                    tabIndex={header.column.getCanSort() ? 0 : -1}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {enableSorting && (
                      <span className="ml-1">
                        {{
                          asc: "🔼",
                          desc: "🔽",
                        }[header.column.getIsSorted() as string] ?? null}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Body */}
          <div
            style={{
              display: "grid",
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={(node) => virtualizer.measureElement(node)}
                  style={{
                    display: "flex",
                    position: "absolute",
                    transform: `translateY(${virtualRow.start}px)`,
                    width: "100%",
                    borderBottom: "1px solid hsl(var(--border))",
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "4px 8px",
                        borderRight: "1px solid hsl(var(--border))",
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

      {/* Add row button */}
      {onAddRow && (
        <div className="mt-4">
          <button
            onClick={onAddRow}
            className="rounded-md border border-primary/20 bg-primary/10 px-4 py-2 font-medium text-primary text-sm transition-colors hover:bg-primary/20"
          >
            Add Row
          </button>
        </div>
      )}
    </div>
  );
}
