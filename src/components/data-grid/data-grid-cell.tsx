"use client";

import type { Cell, RowData, Table } from "@tanstack/react-table";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CellPosition {
  rowIndex: number;
  columnId: string;
}

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    focusedCell: CellPosition | null;
    editingCell: CellPosition | null;
    handleCellClick: (rowIndex: number, columnId: string) => void;
    handleCellDoubleClick: (rowIndex: number, columnId: string) => void;
    startEditing: (rowIndex: number, columnId: string) => void;
    stopEditing: () => void;
    navigateCell: (direction: "up" | "down" | "left" | "right") => void;
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
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cellRef = React.useRef<HTMLButtonElement>(null);

  const meta = table.options.meta;
  const rowIndex = cell.row.index;
  const columnId = cell.column.id;

  const isFocused =
    meta?.focusedCell?.rowIndex === rowIndex &&
    meta?.focusedCell?.columnId === columnId;
  const isEditing =
    meta?.editingCell?.rowIndex === rowIndex &&
    meta?.editingCell?.columnId === columnId;

  const onBlur = React.useCallback(() => {
    meta?.updateData(rowIndex, columnId, value);
    meta?.stopEditing();
  }, [meta, rowIndex, columnId, value]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          (event.currentTarget as HTMLInputElement).blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          meta?.stopEditing();
        }
      } else if (isFocused) {
        switch (event.key) {
          case "ArrowUp":
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight":
            event.preventDefault();
            event.stopPropagation();
            meta?.navigateCell(
              event.key === "ArrowUp"
                ? "up"
                : event.key === "ArrowDown"
                  ? "down"
                  : event.key === "ArrowLeft"
                    ? "left"
                    : "right",
            );
            break;
          case "Enter":
          case "F2":
            event.preventDefault();
            meta?.startEditing(rowIndex, columnId);
            break;
        }
      }
    },
    [isEditing, isFocused, initialValue, meta, rowIndex, columnId],
  );

  const onClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      meta?.handleCellClick(rowIndex, columnId);
    },
    [meta, rowIndex, columnId],
  );

  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      meta?.handleCellDoubleClick(rowIndex, columnId);
    },
    [meta, rowIndex, columnId],
  );

  // Sync external changes
  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Focus cell when it becomes focused (but not editing)
  React.useEffect(() => {
    if (isFocused && !isEditing && cellRef.current) {
      cellRef.current.focus();
    }
  }, [isFocused, isEditing]);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={cn(
          "h-8 w-full rounded-none border-none bg-transparent p-0 focus-visible:ring-1 focus-visible:ring-ring dark:bg-transparent",
          className,
        )}
      />
    );
  }

  return (
    <button
      ref={cellRef}
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      tabIndex={isFocused ? 0 : -1}
      className={cn(
        "h-8 w-full cursor-cell select-none truncate px-0 py-1 text-left text-sm",
        isFocused && "bg-accent/20 ring-1 ring-ring ring-inset",
        className,
      )}
    >
      {value as string}
    </button>
  );
}
