"use client";

import {
  Subscribe,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type RowData,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Checkbox } from "@/registry/bases/radix/ui/checkbox";

interface DataTableSelectHitboxProps {
  htmlFor: string;
  children: React.ReactNode;
  debug?: boolean;
}

function DataTableSelectHitbox({
  htmlFor,
  children,
  debug,
}: DataTableSelectHitboxProps) {
  return (
    <div className="relative -m-2 inline-flex translate-y-0.5 p-2">
      {children}
      <label
        htmlFor={htmlFor}
        className={cn(
          "absolute inset-0 cursor-pointer",
          debug && "border border-dashed border-red-500 bg-red-500/20",
        )}
      />
    </div>
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
  const id = React.useId();

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
        <DataTableSelectHitbox htmlFor={id} debug={debug}>
          <Checkbox
            id={id}
            aria-label="Select all"
            className="after:hidden"
            checked={checked}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        </DataTableSelectHitbox>
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
  const id = React.useId();

  return (
    <Subscribe
      source={row.table.atoms.rowSelection}
      selector={(selection) => selection[row.id] === true}
    >
      {(isSelected) => (
        <DataTableSelectHitbox htmlFor={id} debug={debug}>
          <Checkbox
            id={id}
            aria-label="Select row"
            className="after:hidden"
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
        </DataTableSelectHitbox>
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
