"use client";

import type {
  CellContext,
  ColumnDef,
  Row,
  RowData,
} from "@tanstack/react-table";
import type * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Button } from "@/registry/bases/aria/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/registry/bases/aria/ui/dropdown-menu";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface GetDataTableActionsColumnOptions<TData extends RowData> extends Omit<
  Partial<ColumnDef<DataTableFeatures, TData>>,
  "id" | "header" | "cell"
> {
  actions: (context: CellContext<DataTableFeatures, TData>) => React.ReactNode;
  getAriaLabel?: (row: Row<DataTableFeatures, TData>) => string;
}

export function getDataTableActionsColumn<TData extends RowData>({
  actions,
  getAriaLabel = (row) => `Open actions for row ${row.getDisplayIndex() + 1}`,
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
    cell: (context) => (
      <DropdownMenuTrigger>
        <Button
          aria-label={getAriaLabel(context.row)}
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground aria-expanded:bg-accent"
        >
          <IconPlaceholder
            lucide="Ellipsis"
            tabler="IconDots"
            hugeicons="MoreHorizontalIcon"
            phosphor="DotsThreeIcon"
            remixicon="RiMoreLine"
          />
        </Button>
        <DropdownMenu placement="bottom end">{actions(context)}</DropdownMenu>
      </DropdownMenuTrigger>
    ),
    size,
    enableHiding,
    enableSorting,
    ...props,
  };
}
