import type * as React from "react";

import {
  flexRender,
  type RowData,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { cn } from "cn";

import type { DataTableFeatures } from "@/lib/table-features";

import { getColumnPinningStyle } from "@/lib/data-table-utils";
import { DataTablePagination } from "@/registry/bases/aria/components/data-table/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/bases/aria/ui/table";

interface DataTableProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: TanstackTable<DataTableFeatures, TData>;
  actionBar?: React.ReactNode;
}

export function DataTable<TData extends RowData>({
  table,
  actionBar,
  children,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: DataTableProps<TData>) {
  const headers = table.getFlatHeaders();
  // The first data column names the row, display columns like select do not
  const rowHeaderId = (
    headers.find((header) => header.column.accessorFn) ?? headers[0]
  )?.id;

  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        <Table
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          selectionMode="multiple"
          selectedKeys={table.getSelectedRowModel().rows.map((row) => row.id)}
          disabledKeys={table
            .getRowModel()
            .rows.filter((row) => !row.getCanSelect())
            .map((row) => row.id)}
          disabledBehavior="selection"
          onSelectionChange={(selection) => {
            if (selection === "all") {
              table.toggleAllPageRowsSelected(true);
              return;
            }

            const selectedIds = new Set([...selection].map(String));
            // Only this page is in the collection, so keep other pages' rows
            table.setRowSelection((rowSelection) => {
              const next = { ...rowSelection };
              for (const row of table.getRowModel().rows) {
                if (selectedIds.has(row.id)) next[row.id] = true;
                else delete next[row.id];
              }
              return next;
            });
          }}
        >
          <TableHeader>
            {headers.map((header) => (
              <TableHead
                key={header.id}
                id={header.id}
                isRowHeader={header.id === rowHeaderId}
                style={{
                  ...getColumnPinningStyle({ column: header.column }),
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableHeader>
          <TableBody renderEmptyState={() => "No results."}>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} id={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    style={{
                      ...getColumnPinningStyle({ column: cell.column }),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar &&
          table.getFilteredSelectedRowModel().rows.length > 0 &&
          actionBar}
      </div>
    </div>
  );
}
