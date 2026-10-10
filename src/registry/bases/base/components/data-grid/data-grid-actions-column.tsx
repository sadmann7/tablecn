"use client";

import type { CellContext, ColumnDef, RowData } from "@tanstack/react-table";

import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { Button } from "@/registry/bases/base/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
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
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Open actions for row ${row.getDisplayIndex() + 1}`}
            variant="ghost"
            size="icon-sm"
            tabIndex={-1}
            className="-my-1 size-7 text-muted-foreground data-popup-open:bg-accent"
          />
        }
      >
        <IconPlaceholder
          lucide="Ellipsis"
          tabler="IconDots"
          hugeicons="MoreHorizontalIcon"
          phosphor="DotsThreeIcon"
          remixicon="RiMoreLine"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent data-grid-popover align="end">
        {actions({ row, table })}
      </DropdownMenuContent>
    </DropdownMenu>
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
  size = 48,
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
    enableHiding,
    enableResizing,
    enableSorting,
    ...props,
  };
}
