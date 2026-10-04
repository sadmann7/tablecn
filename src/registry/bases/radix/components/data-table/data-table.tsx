"use client";

import {
  FlexRender,
  type Row,
  type RowData,
  Subscribe,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { cn } from "cn";
import { Slot } from "radix-ui";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import {
  getColumnPinningStyle,
  getColumnSizingStyle,
} from "@/lib/data-table-utils";
import { DataTablePagination } from "@/registry/bases/radix/components/data-table/data-table-pagination";
import { useDirection } from "@/registry/bases/radix/ui/direction";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/bases/radix/ui/table";

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
        rowSelection: state.rowSelection,
        sorting: state.sorting,
      })}
    >
      {() => (
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="group/row">
              {headerGroup.headers.map((header) => (
                <DataTableCellSlot
                  key={header.id}
                  pinned={!!header.column.getIsPinned()}
                  style={getColumnPinningStyle(header.column)}
                >
                  <TableHead colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <FlexRender header={header} />
                    )}
                  </TableHead>
                </DataTableCellSlot>
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
        columnVisibility: state.columnVisibility,
      })}
    >
      {() => {
        const cells = row.getVisibleCells().map((cell) => ({
          cell,
          pinned: !!cell.column.getIsPinned(),
          style: getColumnPinningStyle(cell.column),
        }));

        return (
          <Subscribe
            source={row.table.atoms.rowSelection}
            selector={(selection) => selection[row.id] === true}
          >
            {(isSelected) => (
              <TableRow
                data-state={isSelected ? "selected" : undefined}
                className="group/row"
              >
                {cells.map(({ cell, pinned, style }) => (
                  <DataTableCellSlot
                    key={cell.id}
                    pinned={pinned}
                    style={style}
                  >
                    <TableCell>
                      <FlexRender cell={cell} />
                    </TableCell>
                  </DataTableCellSlot>
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
    <Subscribe
      source={table.atoms.rowSelection}
      selector={() => table.getSelectedRowIds().length > 0}
    >
      {(hasSelectedRows) => (hasSelectedRows ? actionBar : null)}
    </Subscribe>
  );
}

interface DataTableCellSlotProps extends React.ComponentProps<
  typeof Slot.Root
> {
  pinned?: boolean;
}

function DataTableCellSlot({
  pinned = false,
  className,
  ...props
}: DataTableCellSlotProps) {
  return (
    <Slot.Root
      className={cn(
        "overflow-hidden",
        pinned &&
          "bg-background transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-has-aria-expanded/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
