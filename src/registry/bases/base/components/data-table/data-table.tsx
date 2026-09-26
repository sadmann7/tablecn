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
import { DataTablePagination } from "@/registry/bases/base/components/data-table/data-table-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/bases/base/ui/table";

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
  ...props
}: DataTableProps<TData>) {
  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <DataTableHeader table={table} />
          <DataTableBody table={table} />
        </Table>
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
      {() => (
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  style={getColumnPinningStyle({ column: header.column })}
                >
                  {header.isPlaceholder ? null : <FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
      )}
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

  if (!rows.length) {
    return (
      <Subscribe source={table.atoms.columnVisibility}>
        {() => (
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={table.getVisibleLeafColumns().length || 1}
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          </TableBody>
        )}
      </Subscribe>
    );
  }

  return (
    <TableBody>
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
          <Subscribe
            source={row.table.atoms.rowSelection}
            selector={(selection) => selection[row.id] === true}
          >
            {(isSelected) => (
              <TableRow data-state={isSelected ? "selected" : undefined}>
                {cells.map(({ cell, style }) => (
                  <TableCell key={cell.id} style={style}>
                    <FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            )}
          </Subscribe>
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
    <Subscribe source={table.atoms.rowSelection}>
      {(selection) => (Object.keys(selection).length > 0 ? actionBar : null)}
    </Subscribe>
  );
}
