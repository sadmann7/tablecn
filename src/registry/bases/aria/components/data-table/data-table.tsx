"use client";

import {
  FlexRender,
  type Row,
  type RowData,
  Subscribe,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

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
  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        <Subscribe source={table.atoms.rowSelection}>
          {() => (
            <Table
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledby}
              selectionMode="multiple"
              selectedKeys={table
                .getSelectedRowModel()
                .rows.map((row) => row.id)}
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
              <DataTableHeader table={table} />
              <DataTableBody table={table} />
            </Table>
          )}
        </Subscribe>
      </div>
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar ? (
          <DataTableActionBar table={table} actionBar={actionBar} />
        ) : null}
      </div>
    </div>
  );
}

function DataTableHeader<TData extends RowData>({
  table,
}: {
  table: TanstackTable<DataTableFeatures, TData>;
}) {
  return (
    <Subscribe
      source={table.store}
      selector={(state) => ({
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnSizing: state.columnSizing,
        columnVisibility: state.columnVisibility,
        rowSelection: state.rowSelection,
        sorting: state.sorting,
      })}
    >
      {() => {
        const headers = table.getFlatHeaders();
        // The first data column names the row, display columns like select do not
        const rowHeaderId = (
          headers.find((header) => header.column.accessorFn) ?? headers[0]
        )?.id;

        return (
          <TableHeader>
            {headers.map((header) => (
              <TableHead
                key={header.id}
                id={header.id}
                isRowHeader={header.id === rowHeaderId}
                style={getColumnPinningStyle({ column: header.column })}
              >
                {header.isPlaceholder ? null : <FlexRender header={header} />}
              </TableHead>
            ))}
          </TableHeader>
        );
      }}
    </Subscribe>
  );
}

interface DataTableBodyProps<TData extends RowData> {
  table: TanstackTable<DataTableFeatures, TData>;
}

function DataTableBody<TData extends RowData>({
  table,
}: DataTableBodyProps<TData>) {
  const rows = table.getRowModel().rows;

  return (
    <TableBody renderEmptyState={() => "No results."}>
      {rows.map((row) => (
        <MemoizedDataTableRow key={row.id} row={row} />
      ))}
    </TableBody>
  );
}

interface DataTableRowProps<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
}

function DataTableRow<TData extends RowData>({
  row,
}: DataTableRowProps<TData>) {
  return (
    <Subscribe
      source={row.table.store}
      selector={(state) => ({
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnSizing: state.columnSizing,
        columnVisibility: state.columnVisibility,
      })}
    >
      {() => {
        const cells = row.getVisibleCells().map((cell) => ({
          cell,
          style: getColumnPinningStyle({ column: cell.column }),
        }));

        return (
          <TableRow id={row.id}>
            {cells.map(({ cell, style }) => (
              <TableCell key={cell.id} style={style}>
                <FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        );
      }}
    </Subscribe>
  );
}

const MemoizedDataTableRow = React.memo(DataTableRow) as typeof DataTableRow;

interface DataTableActionBarProps<TData extends RowData> {
  table: TanstackTable<DataTableFeatures, TData>;
  actionBar: React.ReactNode;
}

function DataTableActionBar<TData extends RowData>({
  table,
  actionBar,
}: DataTableActionBarProps<TData>) {
  return (
    <Subscribe
      source={table.atoms.rowSelection}
      selector={() => table.getSelectedRowModel().rows.length > 0}
    >
      {(hasSelectedRows) => (hasSelectedRows ? actionBar : null)}
    </Subscribe>
  );
}
