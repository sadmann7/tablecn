"use client";

import type { Cell, Table } from "@tanstack/react-table";
import * as React from "react";

import { cn } from "@/lib/utils";

interface DataGridCellWrapperProps<TData> extends React.ComponentProps<"div"> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  rowIndex: number;
  columnId: string;
  isFocused: boolean;
  isEditing: boolean;
  isSelected: boolean;
  className?: string;
  onVariantKeyDown?: (event: React.KeyboardEvent) => void;
}

export function DataGridCellWrapper<TData>({
  table,
  rowIndex,
  columnId,
  isFocused,
  isEditing,
  isSelected,
  className,
  children,
  onVariantKeyDown,
  ...props
}: DataGridCellWrapperProps<TData>) {
  const meta = table.options.meta;

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

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      // Always let the variant handle its specific logic first
      onVariantKeyDown?.(event);

      // If variant handled it, don't continue
      if (event.defaultPrevented) return;

      // Handle common navigation keys (these never trigger editing)
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Tab"
      ) {
        return;
      }

      // Handle common editing triggers when focused but not editing
      if (isFocused && !isEditing) {
        if (event.key === "F2" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          meta?.startEditing?.(rowIndex, columnId);
          return;
        }

        // Handle typing to start editing (single character, not a modifier)
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          meta?.startEditing?.(rowIndex, columnId);
        }
      }
    },
    [onVariantKeyDown, isFocused, isEditing, meta, rowIndex, columnId],
  );

  return (
    <div
      role="button"
      data-slot="cell-wrapper"
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
      className={cn(
        "size-full cursor-default truncate px-2 py-1 text-left text-sm outline-none",
        {
          "ring-1 ring-ring ring-inset": isFocused,
          "bg-primary/10": isSelected,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
