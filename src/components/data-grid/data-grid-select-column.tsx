"use client";

import type { CellContext, ColumnDef, Table } from "@tanstack/react-table";
import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

function DataGridSelectCheckbox({
  className,
  ...props
}: React.ComponentProps<typeof Checkbox>) {
  return (
    <Checkbox
      className={cn(
        "relative transition-[shadow,border] after:absolute after:-inset-2.5 after:content-[''] hover:border-primary/40",
        className,
      )}
      {...props}
    />
  );
}

function DataGridSelectHeader<TData>({ table }: { table: Table<TData> }) {
  const onCheckedChange = React.useCallback(
    (value: boolean) => table.toggleAllPageRowsSelected(value),
    [table],
  );

  return (
    <DataGridSelectCheckbox
      aria-label="Select all"
      checked={
        table.getIsAllPageRowsSelected() ||
        (table.getIsSomePageRowsSelected() && "indeterminate")
      }
      onCheckedChange={onCheckedChange}
    />
  );
}

function DataGridSelectCell<TData>({
  row,
  table,
}: Pick<CellContext<TData, unknown>, "row" | "table">) {
  const onRowSelect = table.options.meta?.onRowSelect;

  const onCheckedChange = React.useCallback(
    (value: boolean) => {
      if (onRowSelect) {
        onRowSelect(row.index, value, false);
      } else {
        row.toggleSelected(value);
      }
    },
    [onRowSelect, row],
  );

  const onClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (event.shiftKey) {
        event.preventDefault();
        onRowSelect?.(row.index, !row.getIsSelected(), true);
      }
    },
    [onRowSelect, row],
  );

  return (
    <DataGridSelectCheckbox
      aria-label="Select row"
      checked={row.getIsSelected()}
      onCheckedChange={onCheckedChange}
      onClick={onClick}
    />
  );
}

export function getDataGridSelectColumn<TData>({
  size = 40,
  enableHiding = false,
  enableResizing = false,
  enableSorting = false,
  ...props
}: Partial<ColumnDef<TData>> = {}): ColumnDef<TData> {
  return {
    id: "select",
    header: DataGridSelectHeader,
    cell: DataGridSelectCell,
    size,
    enableHiding,
    enableResizing,
    enableSorting,
    ...props,
  };
}
