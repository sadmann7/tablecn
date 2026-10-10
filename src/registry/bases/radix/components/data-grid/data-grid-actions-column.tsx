"use client";

import type { CellContext, ColumnDef, RowData } from "@tanstack/react-table";

import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { Button } from "@/registry/bases/radix/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

type DataGridActionsContext<TData extends RowData> = Pick<
  CellContext<DataGridFeatures, TData>,
  "row" | "table"
>;

interface DataGridActionsCellProps<
  TData extends RowData,
> extends DataGridActionsContext<TData> {
  actions: (context: DataGridActionsContext<TData>) => React.ReactNode;
}

function DataGridActionsCell<TData extends RowData>({
  row,
  table,
  actions,
}: DataGridActionsCellProps<TData>) {
  return (
    <div className="-mx-3 flex justify-center">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open actions for row ${row.getDisplayIndex() + 1}`}
            variant="ghost"
            size="icon-sm"
            tabIndex={-1}
            className="size-6 -translate-y-[0.5px] text-muted-foreground transition-none data-[state=open]:bg-accent"
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
        <DropdownMenuContent data-grid-popover align="end">
          {actions({ row, table })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface GetDataGridActionsColumnOptions<TData extends RowData> extends Omit<
  Partial<ColumnDef<DataGridFeatures, TData>>,
  "id" | "header" | "cell"
> {
  /** Renders the row's menu items, such as `DropdownMenuItem`s. */
  actions: (context: DataGridActionsContext<TData>) => React.ReactNode;
}

export function getDataGridActionsColumn<TData extends RowData>({
  actions,
  size = 56,
  minSize = size,
  enableHiding = false,
  enableResizing = false,
  enableSorting = false,
  ...props
}: GetDataGridActionsColumnOptions<TData>): ColumnDef<DataGridFeatures, TData> {
  return {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => (
      <DataGridActionsCell row={row} table={table} actions={actions} />
    ),
    size,
    minSize,
    enableHiding,
    enableResizing,
    enableSorting,
    ...props,
  };
}
