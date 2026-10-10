"use client";

import type { RowData } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";

import type { DataGridCellProps } from "@/lib/data-grid-types";

interface DataGridCellWrapperProps<TData extends RowData>
  extends DataGridCellProps<TData>, React.ComponentProps<"div"> {}

export function DataGridCellWrapper<TData extends RowData>({
  cell,
  columnIndex,
  isEditing,
  isFocused,
  isSelected,
  isSearchMatch,
  isActiveSearchMatch,
  presence,
  readOnly,
  rowHeight,
  width: _width,
  className,
  onKeyDown: onKeyDownProp,
  ...props
}: DataGridCellWrapperProps<TData>) {
  const rowId = cell.row.id;
  const columnId = cell.column.id;

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

      if (isFocused && !isEditing && !readOnly) {
        if (event.key === "F2" || event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          cell.startEditing();
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          cell.startEditing();
          return;
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          cell.startEditing();
        }
      }
    },
    [cell, onKeyDownProp, isFocused, isEditing, readOnly],
  );

  return (
    <div
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-selected={isSelected}
      aria-readonly={readOnly || undefined}
      {...props}
      data-slot="data-grid-cell-wrapper"
      data-row-id={rowId}
      data-column-id={columnId}
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      className={cn(
        "size-full px-2 py-1.5 text-start text-sm outline-none has-data-[slot=checkbox]:pt-2.5",
        {
          "ring-1 ring-inset": isFocused || !!presence,
          "ring-ring": isFocused && !presence,
          "bg-yellow-100 dark:bg-yellow-900/30":
            isSearchMatch && !isActiveSearchMatch,
          "bg-orange-200 dark:bg-orange-900/50": isActiveSearchMatch,
          "bg-primary/10": isSelected && !isEditing,
          "cursor-default": !isEditing,
          "**:data-[slot=data-grid-cell-content]:line-clamp-1":
            !isEditing && rowHeight === "short",
          "**:data-[slot=data-grid-cell-content]:line-clamp-2":
            !isEditing && rowHeight === "medium",
          "**:data-[slot=data-grid-cell-content]:line-clamp-3":
            !isEditing && rowHeight === "tall",
          "**:data-[slot=data-grid-cell-content]:line-clamp-4":
            !isEditing && rowHeight === "extra-tall",
        },
        className,
      )}
      style={
        presence
          ? ({ "--tw-ring-color": presence.color } as React.CSSProperties)
          : undefined
      }
      onKeyDown={onKeyDown}
    />
  );
}
