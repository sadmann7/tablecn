"use client";

import {
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type RowData,
  Subscribe,
  type TableState,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { Checkbox } from "@/registry/bases/radix/ui/checkbox";

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
            "pointer-events-none absolute inset-s-3 top-1.5 flex size-4 translate-y-[3.5px] items-center justify-center text-xs text-muted-foreground tabular-nums group-hover:opacity-0 group-has-focus-visible:opacity-0",
            checked && "opacity-0",
          )}
        >
          {rowNumber}
        </div>
        <Checkbox
          id={id}
          tabIndex={-1}
          className={cn(
            "relative translate-y-[3.5px] transition-none hover:border-primary/40",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100",
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
        tabIndex={-1}
        className={cn(
          "relative translate-y-[3.5px] transition-none hover:border-primary/40",
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
      <div className="flex translate-y-0.5 items-center ps-1 text-sm text-muted-foreground">
        #
      </div>
    );
  }

  return (
    <Subscribe source={table.store} selector={selectSelectAllState}>
      {() => (
        <DataGridSelectCheckbox
          aria-label="Select all"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={onCheckedChange}
          hitboxSize={hitboxSize}
          debug={debug}
        />
      )}
    </Subscribe>
  );
}

// The memoized grid header doesn't follow selection or filters, so select-all subscribes on its own
function selectSelectAllState(state: TableState<DataGridFeatures>) {
  return {
    rowSelection: state.rowSelection,
    columnFilters: state.columnFilters,
  };
}

interface DataGridSelectCellProps<TData extends RowData> extends Pick<
  CellContext<DataGridFeatures, TData>,
  "row" | "column" | "table"
> {
  hitboxSize?: HitboxSize;
  enableRowMarkers?: boolean;
  readOnly?: boolean;
  debug?: boolean;
}

function DataGridSelectCell<TData extends RowData>({
  row,
  column,
  table,
  hitboxSize,
  enableRowMarkers,
  readOnly,
  debug,
}: DataGridSelectCellProps<TData>) {
  const rowNumber = enableRowMarkers ? row.getDisplayIndex() + 1 : undefined;

  const onToggle = React.useCallback(
    (checked: boolean, shiftKey: boolean) => {
      table.setFocusedCell(row.id, column.id);
      // The checkbox renders a button, so the handler can't read `checked` from the event target
      row.getToggleSelectedHandler()({ target: { checked }, shiftKey });
    },
    [table, row, column],
  );

  const onCheckedChange = React.useCallback(
    (value: boolean) => onToggle(value, false),
    [onToggle],
  );

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!event.shiftKey) return;
      event.preventDefault();
      onToggle(!row.getIsSelected(), true);
    },
    [row, onToggle],
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
    cell: ({ row, column, table }) => (
      <DataGridSelectCell
        row={row}
        column={column}
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
