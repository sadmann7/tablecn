"use client";

import {
  Subscribe,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "cn";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Checkbox } from "@/registry/bases/radix/ui/checkbox";

function getHitboxClassName(debug?: boolean) {
  return cn(
    "translate-y-0.5 cursor-pointer select-none after:-inset-2",
    debug &&
      "after:border after:border-dashed after:border-red-500 after:bg-red-500/20",
  );
}

interface DataTableSelectHeaderProps<TData extends RowData> extends Pick<
  HeaderContext<DataTableFeatures, TData>,
  "table"
> {
  debug?: boolean;
}

function DataTableSelectHeader<TData extends RowData>({
  table,
  debug,
}: DataTableSelectHeaderProps<TData>) {
  return (
    <Subscribe
      source={table.atoms.rowSelection}
      selector={() =>
        table.getIsAllPageRowsSelected()
          ? true
          : table.getIsSomePageRowsSelected()
            ? "indeterminate"
            : false
      }
    >
      {(checked) => (
        <Checkbox
          aria-label="Select all"
          className={getHitboxClassName(debug)}
          checked={checked}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      )}
    </Subscribe>
  );
}

interface DataTableSelectCellProps<TData extends RowData> extends Pick<
  CellContext<DataTableFeatures, TData>,
  "row"
> {
  debug?: boolean;
}

function DataTableSelectCell<TData extends RowData>({
  row,
  debug,
}: DataTableSelectCellProps<TData>) {
  return (
    <Subscribe
      source={row.table.atoms.rowSelection}
      selector={(selection) => selection[row.id] === true}
    >
      {(isSelected) => (
        <Checkbox
          aria-label="Select row"
          className={getHitboxClassName(debug)}
          checked={isSelected}
          onClick={(event) => {
            if (row.table.options.enableRowRangeSelection !== true) {
              row.toggleSelected(!isSelected);
              return;
            }

            if (event.shiftKey) event.preventDefault();

            row.getToggleSelectedHandler()({
              target: { checked: !isSelected },
              shiftKey: event.shiftKey,
              nativeEvent: event.nativeEvent,
            });
          }}
        />
      )}
    </Subscribe>
  );
}

interface GetDataTableSelectColumnOptions<TData extends RowData> extends Omit<
  Partial<ColumnDef<DataTableFeatures, TData>>,
  "id" | "header" | "cell"
> {
  debug?: boolean;
}

export function getDataTableSelectColumn<TData extends RowData>({
  size = 40,
  enableHiding = false,
  enableSorting = false,
  debug = false,
  ...props
}: GetDataTableSelectColumnOptions<TData> = {}): ColumnDef<
  DataTableFeatures,
  TData
> {
  return {
    id: "select",
    header: ({ table }) => (
      <DataTableSelectHeader table={table} debug={debug} />
    ),
    cell: ({ row }) => <DataTableSelectCell row={row} debug={debug} />,
    size,
    enableHiding,
    enableSorting,
    ...props,
  };
}
