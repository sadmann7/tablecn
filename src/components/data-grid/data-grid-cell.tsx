"use client";

import type { Cell, RowData, Table } from "@tanstack/react-table";
import * as React from "react";

import { cn } from "@/lib/utils";

interface CellPosition {
  rowIndex: number;
  columnId: string;
}

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: TData is used in the TableMeta interface
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    focusedCell: CellPosition | null;
    editingCell: CellPosition | null;
    onCellClick: (rowIndex: number, columnId: string) => void;
    onCellDoubleClick: (rowIndex: number, columnId: string) => void;
    startEditing: (rowIndex: number, columnId: string) => void;
    stopEditing: () => void;
    navigateCell: (direction: "up" | "down" | "left" | "right") => void;
    blurCell: () => void;
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
  const cellRef = React.useRef<HTMLDivElement>(null);

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
    if (isEditing) {
      const currentValue = cellRef.current?.textContent ?? "";
      meta?.updateData(rowIndex, columnId, currentValue);
      meta?.stopEditing();
    }
  }, [meta, rowIndex, columnId, isEditing]);

  const onInput = React.useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const currentValue = event.currentTarget.textContent ?? "";
      setValue(currentValue);
    },
    [],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        if (event.key === "Enter") {
          event.preventDefault();
          cellRef.current?.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setValue(initialValue);
          if (cellRef.current) {
            cellRef.current.textContent = initialValue as string;
          }
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
          default:
            // Start editing on any printable character
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              meta?.startEditing(rowIndex, columnId);
              // Clear the content and let the character be typed
              if (cellRef.current) {
                cellRef.current.textContent = "";
              }
            }
            break;
        }
      }
    },
    [isEditing, isFocused, initialValue, meta, rowIndex, columnId],
  );

  const onClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!isEditing) {
        meta?.onCellClick(rowIndex, columnId);
      }
    },
    [meta, rowIndex, columnId, isEditing],
  );

  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      meta?.onCellDoubleClick(rowIndex, columnId);
    },
    [meta, rowIndex, columnId],
  );

  // Sync external changes
  React.useEffect(() => {
    setValue(initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue as string;
    }
  }, [initialValue, isEditing]);

  // Focus and manage contentEditable state
  React.useEffect(() => {
    if (cellRef.current) {
      if (isFocused) {
        cellRef.current.focus();

        if (isEditing) {
          // Set cursor to end when entering edit mode
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(cellRef.current);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    }
  }, [isFocused, isEditing]);

  return (
    <div
      ref={cellRef}
      role="gridcell"
      contentEditable={isEditing}
      suppressContentEditableWarning
      onBlur={onBlur}
      onInput={onInput}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      tabIndex={isFocused ? 0 : -1}
      className={cn(
        "h-8 w-full cursor-cell truncate px-0 py-1 text-left text-sm outline-none",
        isFocused && "bg-accent/20 ring-1 ring-ring ring-inset",
        isEditing && "cursor-text",
        className,
      )}
    >
      {!isEditing && (value as string)}
    </div>
  );
}
