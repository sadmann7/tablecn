"use client";

import type { Cell, RowData } from "@tanstack/react-table";

import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type {
  DataGridCellProps,
  StopEditingOptions,
} from "@/lib/data-grid-types";

import {
  CELL_TINTS,
  getCellFocusTarget,
  getCellLayoutStyle,
} from "@/lib/data-grid-utils";

interface DataGridCellElementProps<TData extends RowData>
  extends DataGridCellProps<TData>, React.ComponentProps<"div"> {
  onCommit?: (options?: StopEditingOptions) => void;
  onCancel?: () => void;
  commitOnEnter?: boolean;
}

export function DataGridCell<TData extends RowData>({
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
  pinned,
  pinnedOffset,
  grow,
  showStartBorder,
  showEndBorder,
  onCommit,
  onCancel,
  onKeyDown: onKeyDownProp,
  commitOnEnter = false,
  className,
  style,
  ref,
  ...props
}: DataGridCellElementProps<TData>) {
  const rowId = cell.row.id;
  const columnId = cell.column.id;
  const cellRef = React.useRef<HTMLDivElement>(null);
  const composedRef = useMergedRefs(ref, cellRef);

  React.useLayoutEffect(() => {
    if (!isFocused || isEditing) return;
    const element = cellRef.current;
    const grid = element?.closest('[role="grid"]');
    const active = document.activeElement;
    if (!element || !grid || element.contains(active)) return;
    const isPageFocused = !active || active === document.body;
    const activeGrid = active
      ?.closest('[data-slot="data-grid-cell"]')
      ?.closest('[role="grid"]');
    if (!isPageFocused && active !== grid && activeGrid !== grid) return;
    getCellFocusTarget(element).focus({ preventScroll: true });
  }, [isFocused, isEditing]);

  const isSelectionTinted = isSelected && !isEditing;
  const isTinted = isSelectionTinted || isSearchMatch || isActiveSearchMatch;

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const wasPrevented = event.defaultPrevented;
      onKeyDownProp?.(event);
      if (!wasPrevented && event.defaultPrevented) return;

      if (isEditing) {
        const commit = (options?: StopEditingOptions) => {
          event.preventDefault();
          event.stopPropagation();
          if (onCommit) {
            onCommit(options);
          } else {
            cell.table.stopEditing(options);
          }
        };

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (onCancel) {
            onCancel();
          } else {
            cell.table.stopEditing();
          }
        } else if (event.key === "Tab") {
          commit({ direction: event.shiftKey ? "shift+tab" : "tab" });
        } else if (event.key === "Enter") {
          if (commitOnEnter) {
            commit({ moveToNextRow: true });
          } else if (event.ctrlKey || event.metaKey) {
            commit();
          }
        }
        return;
      }

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

      if (!isFocused || readOnly) return;

      const isPrintable =
        event.key.length === 1 && !event.ctrlKey && !event.metaKey;

      if (event.key === "F2" || event.key === "Enter" || isPrintable) {
        event.preventDefault();
        event.stopPropagation();
        cell.startEditing(isPrintable ? { pendingChar: event.key } : undefined);
      }
    },
    [
      cell,
      onKeyDownProp,
      isFocused,
      isEditing,
      readOnly,
      onCommit,
      onCancel,
      commitOnEnter,
    ],
  );

  return (
    <div
      role="gridcell"
      aria-colindex={columnIndex + 1}
      aria-selected={isSelected}
      aria-readonly={readOnly || undefined}
      {...props}
      ref={composedRef}
      data-slot="data-grid-cell"
      data-row-id={rowId}
      data-column-id={columnId}
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      className={cn(
        "h-full px-2 pt-1.75 pb-2 text-start text-sm outline-none has-data-[slot=checkbox]:pt-2.5 has-data-[slot=switch]:pt-2.5 **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:w-fit **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:max-w-full **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:wrap-anywhere",
        {
          grow,
          "border-s": showStartBorder,
          "border-e": showEndBorder,
          "ring-1 ring-inset": isFocused || !!presence,
          "ring-ring": isFocused,
          "bg-background": !isTinted,
          [CELL_TINTS.tinted]: isTinted,
          [CELL_TINTS.selected]: isSelectionTinted,
          [CELL_TINTS.activeSearchMatch]:
            isActiveSearchMatch && !isSelectionTinted,
          [CELL_TINTS.searchMatch]:
            isSearchMatch && !isActiveSearchMatch && !isSelectionTinted,
          [CELL_TINTS.darkActiveSearchMatch]: isActiveSearchMatch,
          [CELL_TINTS.darkSearchMatch]: isSearchMatch && !isActiveSearchMatch,
          "cursor-default": !isEditing,
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:block **:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:truncate":
            rowHeight === "short",
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:line-clamp-2":
            rowHeight === "medium",
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:line-clamp-3":
            rowHeight === "tall",
          "**:data-[slot=data-grid-cell-content]:not-[[contenteditable=true]]:line-clamp-4":
            rowHeight === "extra-tall",
        },
        className,
      )}
      style={{
        ...getCellLayoutStyle({
          columnId: cell.column.id,
          pinned,
          pinnedOffset,
        }),
        ...(presence && !isFocused
          ? ({ "--tw-ring-color": presence.color } as React.CSSProperties)
          : null),
        ...style,
      }}
      onKeyDown={onKeyDown}
    />
  );
}

export function useCellValue<TData extends RowData>(
  cell: Cell<DataGridFeatures, TData>,
) {
  const { table } = cell;
  const rowId = cell.row.id;
  const columnId = cell.column.id;

  const subscribe = React.useCallback(
    (onChange: () => void) => table.subscribeCell(rowId, columnId, onChange),
    [table, rowId, columnId],
  );
  const getValue = () => cell.getValue();

  return React.useSyncExternalStore(subscribe, getValue, getValue);
}
