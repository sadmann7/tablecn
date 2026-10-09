"use client";

import {
  type Cell,
  type ColumnPinningPosition,
  FlexRender,
  type Header,
  type Row,
  type RowData,
  Subscribe,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import {
  getColumnPinningStyle,
  getColumnSizingStyle,
} from "@/lib/data-table-utils";
import { DataTablePagination } from "@/registry/bases/base/components/data-table/data-table-pagination";
import { useDirection } from "@/registry/bases/base/ui/direction";
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
  const dir = useDirection();

  return (
    <div
      dir={dir}
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        <DataTableLayout table={table}>
          <DataTableHeader table={table} />
          <DataTableBody table={table} />
        </DataTableLayout>
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

interface DataTableLayoutProps<TData extends RowData> {
  table: TanstackTable<DataTableFeatures, TData>;
  children: React.ReactNode;
}

function DataTableLayout<TData extends RowData>({
  table,
  children,
}: DataTableLayoutProps<TData>) {
  return (
    <Subscribe
      source={table.store}
      selector={(state) => ({
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnSizing: state.columnSizing,
        columnVisibility: state.columnVisibility,
      })}
    >
      {() => (
        <Table className="table-fixed" style={getColumnSizingStyle(table)}>
          {children}
        </Table>
      )}
    </Subscribe>
  );
}

interface DataTableHeaderProps<TData extends RowData> {
  table: TanstackTable<DataTableFeatures, TData>;
}

function DataTableHeader<TData extends RowData>({
  table,
}: DataTableHeaderProps<TData>) {
  return (
    <Subscribe
      source={table.store}
      selector={(state) => ({
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnVisibility: state.columnVisibility,
      })}
    >
      {() => (
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="group/row">
              {headerGroup.headers.map((header) => (
                <DataTableHeadCell
                  key={header.id}
                  header={header}
                  pinned={header.column.getIsPinned()}
                />
              ))}
            </TableRow>
          ))}
        </TableHeader>
      )}
    </Subscribe>
  );
}

interface DataTableHeadCellProps<TData extends RowData> {
  header: Header<DataTableFeatures, TData>;
  pinned: ColumnPinningPosition;
}

const DataTableHeadCell = React.memo(
  DataTableHeadCellImpl,
) as typeof DataTableHeadCellImpl;

function DataTableHeadCellImpl<TData extends RowData>({
  header,
  pinned,
}: DataTableHeadCellProps<TData>) {
  return (
    <TableHead
      colSpan={header.colSpan}
      className={getCellClassName(pinned)}
      style={getColumnPinningStyle(header.column)}
    >
      {header.isPlaceholder ? null : <FlexRender header={header} />}
    </TableHead>
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
        <DataTableRow key={row.id} row={row} />
      ))}
    </TableBody>
  );
}

interface DataTableRowProps<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
}

const DataTableRow = React.memo(DataTableRowImpl) as typeof DataTableRowImpl;

function DataTableRowImpl<TData extends RowData>({
  row,
}: DataTableRowProps<TData>) {
  return (
    <Subscribe
      source={row.table.store}
      selector={(state) => ({
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnVisibility: state.columnVisibility,
        isSelected: state.rowSelection[row.id] === true,
      })}
    >
      {({ isSelected }) => (
        <TableRow
          data-state={isSelected ? "selected" : undefined}
          className="group/row"
        >
          {row.getVisibleCells().map((cell) => (
            <DataTableCell
              key={cell.id}
              cell={cell}
              pinned={cell.column.getIsPinned()}
            />
          ))}
        </TableRow>
      )}
    </Subscribe>
  );
}

interface DataTableCellProps<TData extends RowData> {
  cell: Cell<DataTableFeatures, TData>;
  pinned: ColumnPinningPosition;
}

/**
 * Cells re-render only when their cell or pinned side changes. Cell and header
 * renderers that read table state should subscribe to it themselves, like the
 * select column does.
 */
const DataTableCell = React.memo(DataTableCellImpl) as typeof DataTableCellImpl;

function DataTableCellImpl<TData extends RowData>({
  cell,
  pinned,
}: DataTableCellProps<TData>) {
  return (
    <TableCell
      className={getCellClassName(pinned)}
      style={getColumnPinningStyle(cell.column)}
    >
      <FlexRender cell={cell} />
    </TableCell>
  );
}

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
      selector={() => table.getSelectedRowIds().length > 0}
    >
      {(hasSelectedRows) => (hasSelectedRows ? actionBar : null)}
    </Subscribe>
  );
}

function getCellClassName(pinned: ColumnPinningPosition) {
  return pinned
    ? "overflow-hidden bg-background transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-has-aria-expanded/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted"
    : "overflow-hidden";
}
