"use client";

import type { Cell, Table } from "@tanstack/react-table";
import * as React from "react";

import { cn } from "@/lib/utils";

interface DataGridCellProps<TData> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
}

export function DataGridCell<TData>({ cell, table }: DataGridCellProps<TData>) {
  const initialValue = cell.getValue();
  const [value, setValue] = React.useState(initialValue);
  const cellRef = React.useRef<HTMLDivElement>(null);

  const meta = table.options.meta;
  const originalRowIndex = cell.row.index;

  const rows = table.getRowModel().rows;
  const displayRowIndex = rows.findIndex(
    (row) => row.original === cell.row.original,
  );
  const rowIndex = displayRowIndex >= 0 ? displayRowIndex : originalRowIndex;
  const columnId = cell.column.id;

  const isFocused =
    meta?.focusedCell?.rowIndex === rowIndex &&
    meta?.focusedCell?.columnId === columnId;
  const isEditing =
    meta?.editingCell?.rowIndex === rowIndex &&
    meta?.editingCell?.columnId === columnId;
  const isSelected = meta?.getIsCellSelected?.(rowIndex, columnId) ?? false;
  const hasMultipleSelection =
    (meta?.selectionState?.selectedCells?.size ?? 0) > 1;

  const onBlur = React.useCallback(() => {
    if (cellRef.current) {
      const currentValue = cellRef.current.textContent ?? "";
      if (currentValue !== initialValue) {
        meta?.updateData?.(rowIndex, columnId, currentValue);
      }
      meta?.stopEditing?.();
    }
  }, [meta, rowIndex, columnId, initialValue]);

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
          cellRef.current?.blur();
        }
      } else if (isFocused) {
        switch (event.key) {
          case "F2":
          case "Enter":
            event.preventDefault();
            event.stopPropagation();
            meta?.startEditing?.(rowIndex, columnId);
            break;
          case "ArrowUp":
          case "ArrowDown":
          case "ArrowLeft":
          case "ArrowRight":
          case "Home":
          case "End":
          case "PageUp":
          case "PageDown":
          case "Tab":
            break;
          default:
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              event.stopPropagation();
              meta?.startEditing?.(rowIndex, columnId);

              setValue(event.key);

              queueMicrotask(() => {
                if (
                  cellRef.current &&
                  cellRef.current.contentEditable === "true"
                ) {
                  cellRef.current.textContent = event.key;
                  const range = document.createRange();
                  const selection = window.getSelection();
                  range.selectNodeContents(cellRef.current);
                  range.collapse(false);
                  selection?.removeAllRanges();
                  selection?.addRange(range);
                }
              });
            }
            break;
        }
      }
    },
    [isEditing, isFocused, meta, rowIndex, columnId],
  );

  const onClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!isEditing) {
        meta?.onCellClick?.(rowIndex, columnId, event);
      }
    },
    [meta, rowIndex, columnId, isEditing],
  );

  const onMouseDown = React.useCallback(
    (event: React.MouseEvent) => {
      if (!isEditing) {
        meta?.onCellMouseDown?.(rowIndex, columnId, event);
      }
    },
    [meta, rowIndex, columnId, isEditing],
  );

  const onMouseEnter = React.useCallback(
    (event: React.MouseEvent) => {
      if (!isEditing) {
        meta?.onCellMouseEnter?.(rowIndex, columnId, event);
      }
    },
    [meta, rowIndex, columnId, isEditing],
  );

  const onMouseUp = React.useCallback(() => {
    if (!isEditing) {
      meta?.onCellMouseUp?.();
    }
  }, [meta, isEditing]);

  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      meta?.onCellDoubleClick?.(rowIndex, columnId);
    },
    [meta, rowIndex, columnId],
  );

  React.useEffect(() => {
    setValue(initialValue);
    if (cellRef.current && !isEditing) {
      cellRef.current.textContent = initialValue as string;
    }
  }, [initialValue, isEditing]);

  React.useEffect(() => {
    if (cellRef.current) {
      if (isFocused) {
        cellRef.current.focus();

        if (isEditing) {
          if (!cellRef.current.textContent && value) {
            cellRef.current.textContent = value as string;
          }

          if (cellRef.current.textContent) {
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(cellRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }
      }
    }
  }, [isFocused, isEditing, value]);

  return (
    <div
      role="textbox"
      data-slot="cell-input"
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      ref={cellRef}
      contentEditable={isEditing}
      tabIndex={isFocused ? 0 : -1}
      onBlur={onBlur}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseUp={onMouseUp}
      onInput={onInput}
      onKeyDown={onKeyDown}
      suppressContentEditableWarning
      className={cn(
        "size-full cursor-default truncate px-2 py-1 text-left text-sm outline-none",
        {
          "cursor-text": isEditing,
          "ring-1 ring-ring ring-inset": isFocused,
          "bg-primary/10": isSelected && hasMultipleSelection,
        },
      )}
    >
      {!isEditing ? (value as string) : ""}
    </div>
  );
}
