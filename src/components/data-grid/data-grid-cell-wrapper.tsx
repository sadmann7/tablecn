"use client";

import type { Cell, Table } from "@tanstack/react-table";
import * as React from "react";

import { cn } from "@/lib/utils";

interface DataGridCellWrapperProps<TData> extends React.ComponentProps<"div"> {
  cell: Cell<TData, unknown>;
  table: Table<TData>;
  rowIndex: number;
  columnId: string;
  isEditing: boolean;
  isFocused: boolean;
  isSelected: boolean;
}

export function DataGridCellWrapper<TData>({
  table,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  isSelected,
  className,
  onClick: onClickProp,
  onKeyDown: onKeyDownProp,
  ...props
}: DataGridCellWrapperProps<TData>) {
  const meta = table.options.meta;

  const isSearchMatch = meta?.isSearchMatch?.(rowIndex, columnId) ?? false;
  const isCurrentSearchMatch =
    meta?.isCurrentSearchMatch?.(rowIndex, columnId) ?? false;

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isEditing) {
        event.preventDefault();
        onClickProp?.(event);
        if (isFocused) {
          meta?.startEditing?.(rowIndex, columnId);
        } else {
          meta?.onCellClick?.(rowIndex, columnId, event);
        }
      }
    },
    [meta, rowIndex, columnId, isEditing, isFocused, onClickProp],
  );

  const onContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      if (!isEditing) {
        meta?.onCellContextMenu?.(rowIndex, columnId, event);
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
      if (!isEditing) {
        event.preventDefault();
        meta?.onCellDoubleClick?.(rowIndex, columnId);
      }
    },
    [meta, rowIndex, columnId, isEditing],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDownProp?.(event);

      if (event.defaultPrevented) return;

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

      if (isFocused && !isEditing) {
        if (event.key === "F2" || event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          meta?.startEditing?.(rowIndex, columnId);
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          meta?.startEditing?.(rowIndex, columnId);
          return;
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          meta?.startEditing?.(rowIndex, columnId);
        }
      }
    },
    [onKeyDownProp, isFocused, isEditing, meta, rowIndex, columnId],
  );

  return (
    <div
      role="button"
      data-slot="data-grid-cell-wrapper"
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      className={cn(
        "size-full px-2 py-1 text-left text-sm outline-none",
        {
          "ring-1 ring-ring ring-inset": isFocused,
          "bg-yellow-100 dark:bg-yellow-900/30":
            isSearchMatch && !isCurrentSearchMatch,
          "bg-orange-200 dark:bg-orange-900/50": isCurrentSearchMatch,
          "bg-primary/10": isSelected && !isEditing,
          "cursor-default truncate [&_[role=textbox]]:truncate": !isEditing,
        },
        className,
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
      {...props}
    />
  );
}
