"use client";

import type { Cell, RowData, Table } from "@tanstack/react-table";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

interface DataGridCellProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  className?: string;
}

export function DataGridCell<TData>({
  cell,
  table,
  className,
}: DataGridCellProps<TData>) {
  const initialValue = cell.getValue();
  const [value, setValue] = React.useState(initialValue);

  const onBlur = React.useCallback(() => {
    table.options.meta?.updateData(cell.row.index, cell.column.id, value);
  }, [table.options.meta, cell.row.index, cell.column.id, value]);

  const onKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      (event.currentTarget as HTMLInputElement).blur();
    }
  }, []);

  // Sync external changes
  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <Input
      value={value as string}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={cn(
        "h-8 border-none bg-transparent p-1 focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    />
  );
}
