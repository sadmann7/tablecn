"use client";

import type { RowData } from "@tanstack/react-table";

import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
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
  // Pulled out so it doesn't render as a `width` attribute on the element
  width: _width,
  onKeyDown: onKeyDownProp,
  className,
  ref,
  ...props
}: DataGridCellWrapperProps<TData>) {
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const cellRef = React.useRef<HTMLDivElement>(null);
  const composedRef = useMergedRefs(ref, cellRef);

  // The focused cell can come into view after focus moved to it, so it takes focus
  // from the grid or another cell in it
  React.useLayoutEffect(() => {
    if (!isFocused || isEditing) return;
    const element = cellRef.current;
    const grid = element?.closest('[role="grid"]');
    const active = document.activeElement;
    if (!element || !grid || !active || element.contains(active)) return;
    const activeGrid = active
      .closest('[data-slot="data-grid-row"]')
      ?.closest('[role="grid"]');
    if (active !== grid && activeGrid !== grid) return;
    element.focus({ preventScroll: true });
  }, [isFocused, isEditing]);

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
      ref={composedRef}
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
          "ring-ring": isFocused,
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
        presence && !isFocused
          ? ({ "--tw-ring-color": presence.color } as React.CSSProperties)
          : undefined
      }
      onKeyDown={onKeyDown}
    />
  );
}
