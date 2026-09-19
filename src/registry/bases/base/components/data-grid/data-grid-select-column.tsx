"use client";

import type {
  CellContext,
  ColumnDef,
  HeaderContext,
  RowData,
} from "@tanstack/react-table";

import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/registry/bases/base/ui/checkbox";

type HitboxSize = "default" | "sm" | "lg";

interface DataGridSelectHitboxProps {
  htmlFor: string;
  children: React.ReactNode;
  size?: HitboxSize;
  debug?: boolean;
}

function DataGridSelectHitbox({
  htmlFor,
  children,
  size,
  debug,
}: DataGridSelectHitboxProps) {
  return (
    <div
      className={cn(
        "group relative -my-1.5 h-[calc(100%+0.75rem)] py-1.5",
        size === "default" && "-ms-3 -me-2 ps-3 pe-2",
        size === "sm" && "-ms-3 -me-1.5 ps-3 pe-1.5",
        size === "lg" && "-mx-3 px-3",
      )}
    >
      {children}
      <label
        htmlFor={htmlFor}
        className={cn(
          "absolute inset-0 cursor-pointer",
          debug && "border border-dashed border-red-500 bg-red-500/20",
        )}
      />
    </div>
  );
}

interface DataGridSelectCheckboxProps extends Omit<
  React.ComponentProps<typeof Checkbox>,
  "id"
> {
  rowNumber?: number;
  hitboxSize?: HitboxSize;
  debug?: boolean;
}

function DataGridSelectCheckbox({
  rowNumber,
  hitboxSize,
  debug,
  checked,
  className,
  ...props
}: DataGridSelectCheckboxProps) {
  const id = React.useId();

  if (rowNumber !== undefined) {
    return (
      <DataGridSelectHitbox htmlFor={id} size={hitboxSize} debug={debug}>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-s-3 top-1.5 flex size-4 items-center justify-center text-xs text-muted-foreground tabular-nums transition-opacity group-hover:opacity-0",
            checked && "opacity-0",
          )}
        >
          {rowNumber}
        </div>
        <Checkbox
          id={id}
          className={cn(
            "relative transition-[shadow,border,opacity] hover:border-primary/40",
            "opacity-0 group-hover:opacity-100 data-checked:opacity-100",
            className,
          )}
          checked={checked}
          {...props}
        />
      </DataGridSelectHitbox>
    );
  }

  return (
    <DataGridSelectHitbox htmlFor={id} size={hitboxSize} debug={debug}>
      <Checkbox
        id={id}
        className={cn(
          "relative transition-[shadow,border] hover:border-primary/40",
          className,
        )}
        checked={checked}
        {...props}
      />
    </DataGridSelectHitbox>
  );
}

interface DataGridSelectHeaderProps<TData extends RowData> extends Pick<
  HeaderContext<DataGridFeatures, TData>,
  "table"
> {
  hitboxSize?: HitboxSize;
  readOnly?: boolean;
  debug?: boolean;
}

function DataGridSelectHeader<TData extends RowData>({
  table,
  hitboxSize,
  readOnly,
  debug,
}: DataGridSelectHeaderProps<TData>) {
  const onCheckedChange = React.useCallback(
    (value: boolean) => table.toggleAllPageRowsSelected(value),
    [table],
  );

  if (readOnly) {
    return (
      <div className="mt-1 flex items-center ps-1 text-sm text-muted-foreground">
        #
      </div>
    );
  }

  return (
    <DataGridSelectCheckbox
      aria-label="Select all"
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={
        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
      }
      onCheckedChange={onCheckedChange}
      hitboxSize={hitboxSize}
      debug={debug}
    />
  );
}

interface DataGridSelectCellProps<TData extends RowData> extends Pick<
  CellContext<DataGridFeatures, TData>,
  "row" | "table"
> {
  hitboxSize?: HitboxSize;
  enableRowMarkers?: boolean;
  readOnly?: boolean;
  debug?: boolean;
}

function DataGridSelectCell<TData extends RowData>({
  row,
  table,
  hitboxSize,
  enableRowMarkers,
  readOnly,
  debug,
}: DataGridSelectCellProps<TData>) {
  const meta = table.options.meta;
  const rowNumber = enableRowMarkers
    ? (meta?.getVisualRowIndex?.(row.id) ?? row.index + 1)
    : undefined;

  const onCheckedChange = React.useCallback(
    (value: boolean) => {
      if (meta?.onRowSelect) {
        meta.onRowSelect(row.id, value, false);
      } else {
        row.toggleSelected(value);
      }
    },
    [meta, row],
  );

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.shiftKey) {
        event.preventDefault();
        meta?.onRowSelect?.(row.id, !row.getIsSelected(), true);
      }
    },
    [meta, row],
  );

  if (readOnly) {
    return (
      <div className="flex items-center ps-1 text-xs text-muted-foreground tabular-nums">
        {rowNumber ?? row.index + 1}
      </div>
    );
  }

  return (
    <DataGridSelectCheckbox
      aria-label={rowNumber ? `Select row ${rowNumber}` : "Select row"}
      checked={row.getIsSelected()}
      onCheckedChange={onCheckedChange}
      onClick={onClick}
      rowNumber={rowNumber}
      hitboxSize={hitboxSize}
      debug={debug}
    />
  );
}

interface GetDataGridSelectColumnOptions<TData extends RowData> extends Omit<
  Partial<ColumnDef<DataGridFeatures, TData>>,
  "id" | "header" | "cell"
> {
  enableRowMarkers?: boolean;
  readOnly?: boolean;
  hitboxSize?: HitboxSize;
  debug?: boolean;
}

export function getDataGridSelectColumn<TData extends RowData>({
  size = 40,
  hitboxSize = "default",
  enableHiding = false,
  enableResizing = false,
  enableSorting = false,
  enableRowMarkers = false,
  readOnly = false,
  debug = false,
  ...props
}: GetDataGridSelectColumnOptions<TData> = {}): ColumnDef<
  DataGridFeatures,
  TData
> {
  return {
    id: "select",
    header: ({ table }) => (
      <DataGridSelectHeader
        table={table}
        hitboxSize={hitboxSize}
        readOnly={readOnly}
        debug={debug}
      />
    ),
    cell: ({ row, table }) => (
      <DataGridSelectCell
        row={row}
        table={table}
        enableRowMarkers={enableRowMarkers}
        readOnly={readOnly}
        hitboxSize={hitboxSize}
        debug={debug}
      />
    ),
    size,
    enableHiding,
    enableResizing,
    enableSorting,
    ...props,
  };
}
