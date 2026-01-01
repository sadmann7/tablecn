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
  if (showNumber && rowNumber !== undefined) {
    return (
      <div className="group relative">
        <div
          aria-hidden="true"
          data-state={checked ? "checked" : "unchecked"}
          className="pointer-events-none absolute start-0 top-0 flex size-4 items-center justify-center text-muted-foreground text-xs tabular-nums transition-opacity group-hover:opacity-0 data-[state=checked]:opacity-0"
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

interface DataGridSelectCellProps<TData>
  extends Pick<CellContext<TData, unknown>, "row" | "table"> {
  enableRowMarkers?: boolean;
}

function DataGridSelectCell<TData>({
  row,
  table,
  enableRowMarkers,
}: DataGridSelectCellProps<TData>) {
  const onRowSelect = table.options.meta?.onRowSelect;

  // biome-ignore lint/correctness/useExhaustiveDependencies: rowNumber is memoized to avoid re-rendering the component when the row number changes
  const rowNumber = React.useMemo(() => {
    if (!enableRowMarkers) return undefined;

    const rows = table.getRowModel().rows;
    const visualIndex = rows.findIndex((r) => r.id === row.id);
    return visualIndex !== -1 ? visualIndex + 1 : row.index + 1;
  }, [enableRowMarkers, table.getRowModel().rows, row]);

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
      aria-label={`Select row ${rowNumber}`}
      checked={row.getIsSelected()}
      onCheckedChange={onCheckedChange}
      onClick={onClick}
      rowNumber={rowNumber}
      showNumber={enableRowMarkers}
    />
  );
}

interface GetDataGridSelectColumnOptions<TData>
  extends Omit<Partial<ColumnDef<TData>>, "id" | "header" | "cell"> {
  enableRowMarkers?: boolean;
}

export function getDataGridSelectColumn<TData>({
  size = 40,
  enableHiding = false,
  enableResizing = false,
  enableSorting = false,
  enableRowMarkers = false,
  ...props
}: GetDataGridSelectColumnOptions<TData> = {}): ColumnDef<TData> {
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
    ...props,
  };
}
