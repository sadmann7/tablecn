"use client";

import type { RowData } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";

import type { DataGridCellProps } from "@/lib/data-grid-types";

import { getCellKey } from "@/lib/data-grid-utils";
import { useDataGridPresence } from "@/registry/bases/radix/components/data-grid/data-grid-presence";

interface DataGridCellWrapperProps<TData extends RowData>
  extends DataGridCellProps<TData>, React.ComponentProps<"div"> {}

export function DataGridCellWrapper<TData extends RowData>({
  cell,
  rowId,
  columnId,
  isEditing,
  isFocused,
  isSelected,
  isSearchMatch,
  isActiveSearchMatch,
  readOnly,
  rowHeight,
  className,
  onKeyDown: onKeyDownProp,
  ...props
}: DataGridCellWrapperProps<TData>) {
  const cellPresence = useDataGridPresence(getCellKey(rowId, columnId));

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
      role="button"
      data-slot="grid-cell-wrapper"
      data-row-id={rowId}
      data-column-id={columnId}
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      {...props}
      className={cn(
        "size-full px-2 py-1.5 text-start text-sm outline-none has-data-[slot=checkbox]:pt-2.5",
        {
          "ring-1 ring-inset": isFocused || !!cellPresence,
          "ring-ring": isFocused && !cellPresence,
          "bg-yellow-100 dark:bg-yellow-900/30":
            isSearchMatch && !isActiveSearchMatch,
          "bg-orange-200 dark:bg-orange-900/50": isActiveSearchMatch,
          "bg-primary/10": isSelected && !isEditing,
          "cursor-default": !isEditing,
          "**:data-[slot=grid-cell-content]:line-clamp-1":
            !isEditing && rowHeight === "short",
          "**:data-[slot=grid-cell-content]:line-clamp-2":
            !isEditing && rowHeight === "medium",
          "**:data-[slot=grid-cell-content]:line-clamp-3":
            !isEditing && rowHeight === "tall",
          "**:data-[slot=grid-cell-content]:line-clamp-4":
            !isEditing && rowHeight === "extra-tall",
        },
        className,
      )}
      style={
        cellPresence
          ? ({ "--tw-ring-color": cellPresence.color } as React.CSSProperties)
          : undefined
      }
      onKeyDown={onKeyDown}
    />
  );
}
