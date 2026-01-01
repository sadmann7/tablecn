"use client";

import type {
  CellContext,
  ColumnDef,
  HeaderContext,
} from "@tanstack/react-table";
import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface DataGridSelectCheckboxProps
  extends React.ComponentProps<typeof Checkbox> {
  rowNumber?: number;
  showNumber?: boolean;
}

function DataGridSelectCheckbox({
  rowNumber,
  showNumber,
  checked,
  className,
  ...props
}: DataGridSelectCheckboxProps) {
  if (showNumber && !Number.isNaN(rowNumber)) {
    return (
      <div className="group relative">
        <div
          aria-hidden="true"
          data-state={checked ? "checked" : "unchecked"}
          className="pointer-events-none absolute top-0 left-0 flex size-4 items-center justify-center text-muted-foreground text-xs tabular-nums transition-opacity group-hover:opacity-0 data-[state=checked]:opacity-0"
        >
          {rowNumber}
        </div>
        <Checkbox
          className={cn(
            "relative transition-[shadow,border,opacity] after:absolute after:-inset-2.5 after:content-[''] hover:border-primary/40",
            "opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100",
            className,
          )}
          checked={checked}
          {...props}
        />
      </div>
    );
  }

  return (
    <Checkbox
      className={cn(
        "relative transition-[shadow,border] after:absolute after:-inset-2.5 after:content-[''] hover:border-primary/40",
        className,
      )}
      checked={checked}
      {...props}
    />
  );
}

function DataGridSelectHeader<TData>({
  table,
}: Pick<HeaderContext<TData, unknown>, "table">) {
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
  enableRowMarkers,
}: Pick<CellContext<TData, unknown>, "row" | "table"> & {
  enableRowMarkers?: boolean;
}) {
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
      rowNumber={row.index + 1}
      showNumber={enableRowMarkers}
    />
  );
}

interface GetDataGridSelectColumnOptions {
  enableRowMarkers?: boolean;
  size?: number;
  enableHiding?: boolean;
  enableResizing?: boolean;
  enableSorting?: boolean;
}

export function getDataGridSelectColumn<TData>({
  size = 40,
  enableHiding = false,
  enableResizing = false,
  enableSorting = false,
  enableRowMarkers = false,
}: GetDataGridSelectColumnOptions = {}): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => <DataGridSelectHeader table={table} />,
    cell: ({ row, table }) => (
      <DataGridSelectCell
        row={row}
        table={table}
        enableRowMarkers={enableRowMarkers}
      />
    ),
    size,
    enableHiding,
    enableResizing,
    enableSorting,
  };
}
