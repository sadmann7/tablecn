"use client";

import type { ColumnDef, RowData } from "@tanstack/react-table";

import { cn } from "cn";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Checkbox } from "@/registry/bases/aria/ui/checkbox";

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
    header: () => <DataTableSelectHeader debug={debug} />,
    cell: () => <DataTableSelectCell debug={debug} />,
    size,
    enableHiding,
    enableSorting,
    ...props,
  };
}

interface DataTableSelectHeaderProps {
  debug?: boolean;
}

function DataTableSelectHeader({ debug }: DataTableSelectHeaderProps) {
  return (
    <Checkbox
      slot="selection"
      aria-label="Select all"
      className={getHitboxClassName(debug)}
    />
  );
}

function getHitboxClassName(debug?: boolean) {
  return cn(
    "select-none after:-inset-2",
    debug &&
      "after:border after:border-dashed after:border-red-500 after:bg-red-500/20",
  );
}

interface DataTableSelectCellProps {
  debug?: boolean;
}

function DataTableSelectCell({ debug }: DataTableSelectCellProps) {
  return (
    <Checkbox
      slot="selection"
      aria-label="Select row"
      className={getHitboxClassName(debug)}
    />
  );
}
