"use client";

import * as React from "react";

import { useAsRef } from "@/hooks/use-as-ref";
import { useComposedRefs } from "@/lib/compose-refs";
import { getCellKey } from "@/lib/data-grid";
import { cn } from "@/lib/utils";
import type { DataGridCellProps } from "@/types/data-grid";

interface DataGridCellWrapperProps<TData>
  extends DataGridCellProps<TData>,
    React.ComponentProps<"div"> {}

export function DataGridCellWrapper<TData>({
  tableMeta,
  rowIndex,
  columnId,
  isEditing,
  isFocused,
  isSelected,
  isSearchMatch,
  isActiveSearchMatch,
  readOnly,
  rowHeight,
  className,
  onClick: onClickProp,
  onKeyDown: onKeyDownProp,
  ref,
  ...props
}: DataGridCellWrapperProps<TData>) {
  const propsRef = useAsRef({
    tableMeta,
    rowIndex,
    columnId,
    readOnly,
    onClickProp,
    onKeyDownProp,
  });

  const onCellChange = React.useCallback(
    (node: HTMLDivElement | null) => {
      const { tableMeta, rowIndex, columnId } = propsRef.current;

      const cellMapRef = tableMeta?.cellMapRef;
      if (!cellMapRef) return;

      const cellKey = getCellKey(rowIndex, columnId);

      if (node) {
        cellMapRef.current.set(cellKey, node);
      } else {
        cellMapRef.current.delete(cellKey);
      }
    },
    [propsRef],
  );

  const composedRef = useComposedRefs(ref, onCellChange);

  const onClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const { tableMeta, rowIndex, columnId, readOnly, onClickProp } =
        propsRef.current;

      if (!isEditing) {
        event.preventDefault();
        onClickProp?.(event);
        if (isFocused && !readOnly) {
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        } else {
          tableMeta?.onCellClick?.(rowIndex, columnId, event);
        }
      }
    },
    [isEditing, isFocused, propsRef],
  );

  const onContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      const { tableMeta, rowIndex, columnId } = propsRef.current;
      if (!isEditing) {
        tableMeta?.onCellContextMenu?.(rowIndex, columnId, event);
      }
    },
    [isEditing, propsRef],
  );

  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent) => {
      const { tableMeta, rowIndex, columnId } = propsRef.current;

      if (!isEditing) {
        event.preventDefault();
        tableMeta?.onCellDoubleClick?.(rowIndex, columnId);
      }
    },
    [isEditing, propsRef],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const { tableMeta, rowIndex, columnId, readOnly, onKeyDownProp } =
        propsRef.current;

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
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
          return;
        }

        if (event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
          return;
        }

        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          tableMeta?.onCellEditingStart?.(rowIndex, columnId);
        }
      }
    },
    [isFocused, isEditing, propsRef],
  );

  const onMouseDown = React.useCallback(
    (event: React.MouseEvent) => {
      const { tableMeta, rowIndex, columnId } = propsRef.current;

      if (!isEditing) {
        tableMeta?.onCellMouseDown?.(rowIndex, columnId, event);
      }
    },
    [isEditing, propsRef],
  );

  const onMouseEnter = React.useCallback(
    (event: React.MouseEvent) => {
      const { tableMeta, rowIndex, columnId } = propsRef.current;

      if (!isEditing) {
        tableMeta?.onCellMouseEnter?.(rowIndex, columnId, event);
      }
    },
    [isEditing, propsRef],
  );

  const onMouseUp = React.useCallback(() => {
    if (!isEditing) {
      propsRef.current.tableMeta?.onCellMouseUp?.();
    }
  }, [isEditing, propsRef.current.tableMeta]);

  return (
    <div
      role="button"
      data-slot="grid-cell-wrapper"
      data-editing={isEditing ? "" : undefined}
      data-focused={isFocused ? "" : undefined}
      data-selected={isSelected ? "" : undefined}
      tabIndex={isFocused && !isEditing ? 0 : -1}
      {...props}
      ref={composedRef}
      className={cn(
        "size-full px-2 py-1.5 text-start text-sm outline-none has-data-[slot=checkbox]:pt-2.5",
        {
          "ring-1 ring-ring ring-inset": isFocused,
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
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseUp={onMouseUp}
      onKeyDown={onKeyDown}
    />
  );
}
