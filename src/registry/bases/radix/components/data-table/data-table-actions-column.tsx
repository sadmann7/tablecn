"use client";

import type {
  CellContext,
  ColumnDef,
  Row,
  RowData,
} from "@tanstack/react-table";
import type * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Button } from "@/registry/bases/radix/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

type DataTableActionsContext<TData extends RowData> = Pick<
  CellContext<DataTableFeatures, TData>,
  "row" | "table"
>;

interface DataTableActionsCellProps<
  TData extends RowData,
> extends DataTableActionsContext<TData> {
  actions: (context: DataTableActionsContext<TData>) => React.ReactNode;
  getAriaLabel: (row: Row<DataTableFeatures, TData>) => string;
}

function DataTableActionsCell<TData extends RowData>({
  row,
  table,
  actions,
  getAriaLabel,
}: DataTableActionsCellProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={getAriaLabel(row)}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground data-[state=open]:bg-accent"
        >
          <IconPlaceholder
            lucide="Ellipsis"
            tabler="IconDots"
            hugeicons="MoreHorizontalIcon"
            phosphor="DotsThreeIcon"
            remixicon="RiMoreLine"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions({ row, table })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getDefaultAriaLabel<TData extends RowData>(
  row: Row<DataTableFeatures, TData>,
) {
  return `Open actions for row ${row.getDisplayIndex() + 1}`;
}

interface GetDataTableActionsColumnOptions<TData extends RowData> extends Omit<
  Partial<ColumnDef<DataTableFeatures, TData>>,
  "id" | "header" | "cell"
> {
  /** Renders the row's menu items, such as `DropdownMenuItem`s. */
  actions: (context: DataTableActionsContext<TData>) => React.ReactNode;
  /** The accessible label of the row's menu trigger. */
  getAriaLabel?: (row: Row<DataTableFeatures, TData>) => string;
}

export function getDataTableActionsColumn<TData extends RowData>({
  actions,
  getAriaLabel = getDefaultAriaLabel,
  size = 48,
  enableHiding = false,
  enableSorting = false,
  ...props
}: GetDataTableActionsColumnOptions<TData>): ColumnDef<
  DataTableFeatures,
  TData
> {
  return {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => (
      <DataTableActionsCell
        row={row}
        table={table}
        actions={actions}
        getAriaLabel={getAriaLabel}
      />
    ),
    size,
    enableHiding,
    enableSorting,
    ...props,
  };
}
