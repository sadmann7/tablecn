"use client";

import { Subscribe, type ColumnDef, type RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Checkbox } from "@/registry/bases/base/ui/checkbox";

interface GetDataTableSelectColumnOptions<TData extends RowData> extends Omit<
  Partial<ColumnDef<DataTableFeatures, TData>>,
  "id" | "header" | "cell"
> {}

export function getDataTableSelectColumn<TData extends RowData>({
  size = 40,
  enableHiding = false,
  enableSorting = false,
  ...props
}: GetDataTableSelectColumnOptions<TData> = {}): ColumnDef<
  DataTableFeatures,
  TData
> {
  return {
    id: "select",
    header: ({ table }) => (
      <Subscribe
        source={table.atoms.rowSelection}
        selector={() => ({
          checked: table.getIsAllPageRowsSelected(),
          indeterminate: table.getIsSomePageRowsSelected(),
        })}
      >
        {({ checked, indeterminate }) => (
          <Checkbox
            aria-label="Select all"
            className="translate-y-0.5"
            checked={checked}
            indeterminate={indeterminate}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(value)}
          />
        )}
      </Subscribe>
    ),
    cell: ({ row }) => (
      <Subscribe
        source={row.table.atoms.rowSelection}
        selector={(selection) => selection[row.id] === true}
      >
        {(isSelected) => (
          <Checkbox
            aria-label="Select row"
            className="translate-y-0.5"
            checked={isSelected}
            onCheckedChange={(value) => row.toggleSelected(value)}
          />
        )}
      </Subscribe>
    ),
    size,
    enableHiding,
    enableSorting,
    ...props,
  };
}
