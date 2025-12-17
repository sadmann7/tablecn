"use client";

import type {
  CellContext,
  ColumnDef,
  HeaderContext,
  Table,
} from "@tanstack/react-table";
import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAsRef } from "@/hooks/use-as-ref";
import { cn } from "@/lib/utils";

function DataGridSelectCheckbox({
  className,
  ...props
}: React.ComponentProps<typeof Checkbox>) {
  return (
    <Checkbox
      className={cn(
        "after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40",
        className,
      )}
      {...props}
    />
  );
}

function DataGridSelectHeader<TData>({ table }: HeaderContext<TData, unknown>) {
  const tableRef = useAsRef(table);

  const onCheckedChange = React.useCallback(
    (value: boolean) => tableRef.current.toggleAllPageRowsSelected(value),
    [tableRef],
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
}: CellContext<TData, unknown>) {
  const propsRef = useAsRef({
    row,
    onRowSelect: table.options.meta?.onRowSelect,
  });

  const onCheckedChange = React.useCallback(
    (value: boolean) => {
      const { row, onRowSelect } = propsRef.current;

      if (onRowSelect) {
        onRowSelect(row.index, value, false);
      } else {
        row.toggleSelected(value);
      }
    },
    [propsRef],
  );

  const onClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (event.shiftKey) {
        event.preventDefault();
        const { row, onRowSelect } = propsRef.current;

        onRowSelect?.(row.index, !row.getIsSelected(), true);
      }
    },
    [propsRef],
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
