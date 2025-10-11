"use client";

import type { Table } from "@tanstack/react-table";
import { CopyIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataGridContextMenuProps<TData> {
  table: Table<TData>;
}

export function DataGridContextMenu<TData>({
  table,
}: DataGridContextMenuProps<TData>) {
  const meta = table.options.meta;
  const contextMenu = meta?.contextMenu;
  const closeContextMenu = meta?.closeContextMenu;
  const selectionState = meta?.selectionState;

  const virtualTriggerRef = React.useRef<HTMLButtonElement>(null);

  const onCloseAutoFocus: React.ComponentProps<
    typeof DropdownMenuContent
  >["onCloseAutoFocus"] = (event) => {
    event.preventDefault();
  };

  React.useEffect(() => {
    if (contextMenu?.open && virtualTriggerRef.current) {
      const trigger = virtualTriggerRef.current;
      trigger.style.position = "fixed";
      trigger.style.left = `${contextMenu.x}px`;
      trigger.style.top = `${contextMenu.y}px`;
      trigger.style.width = "1px";
      trigger.style.height = "1px";
      trigger.style.padding = "0";
      trigger.style.border = "none";
      trigger.style.background = "transparent";
      trigger.style.pointerEvents = "none";
      trigger.style.opacity = "0";
    }
  }, [contextMenu?.open, contextMenu?.x, contextMenu?.y]);

  const onCopy = React.useCallback(() => {
    if (
      !selectionState?.selectedCells ||
      selectionState.selectedCells.size === 0
    )
      return;

    const rows = table.getRowModel().rows;
    const columnIds: string[] = [];

    // Collect all unique column IDs from selected cells
    const selectedCellsArray = Array.from(selectionState.selectedCells);
    for (const cellKey of selectedCellsArray) {
      const parts = cellKey.split(":");
      const columnId = parts[1];
      if (columnId && !columnIds.includes(columnId)) {
        columnIds.push(columnId);
      }
    }

    // Build grid of selected cells
    const cellData = new Map<string, string>();
    for (const cellKey of selectedCellsArray) {
      const parts = cellKey.split(":");
      const rowIndexStr = parts[0];
      const columnId = parts[1];
      if (rowIndexStr && columnId) {
        const rowIndex = Number.parseInt(rowIndexStr, 10);
        if (!Number.isNaN(rowIndex) && rows[rowIndex]) {
          const row = rows[rowIndex];
          if (row) {
            const cell = row
              .getVisibleCells()
              .find((c) => c.column.id === columnId);
            if (cell) {
              const value = cell.getValue();
              cellData.set(cellKey, String(value ?? ""));
            }
          }
        }
      }
    }

    // Get row indices and column indices
    const rowIndices = new Set<number>();
    const colIndices = new Set<number>();

    for (const cellKey of selectedCellsArray) {
      const parts = cellKey.split(":");
      const rowIndexStr = parts[0];
      const columnId = parts[1];
      if (rowIndexStr && columnId) {
        const rowIndex = Number.parseInt(rowIndexStr, 10);
        if (!Number.isNaN(rowIndex)) {
          rowIndices.add(rowIndex);
        }
        const colIndex = columnIds.indexOf(columnId);
        if (colIndex >= 0) {
          colIndices.add(colIndex);
        }
      }
    }

    const sortedRowIndices = Array.from(rowIndices).sort((a, b) => a - b);
    const sortedColIndices = Array.from(colIndices).sort((a, b) => a - b);
    const sortedColumnIds = sortedColIndices.map((i) => columnIds[i]);

    // Build TSV (tab-separated values)
    const tsvData = sortedRowIndices
      .map((rowIndex) =>
        sortedColumnIds
          .map((columnId) => {
            const cellKey = `${rowIndex}:${columnId}`;
            return cellData.get(cellKey) ?? "";
          })
          .join("\t"),
      )
      .join("\n");

    navigator.clipboard.writeText(tsvData);
    closeContextMenu?.();
  }, [table, selectionState, closeContextMenu]);

  const onDelete = React.useCallback(() => {
    if (
      !selectionState?.selectedCells ||
      selectionState.selectedCells.size === 0
    )
      return;

    for (const cellKey of selectionState.selectedCells) {
      const parts = cellKey.split(":");
      const rowIndexStr = parts[0];
      const columnId = parts[1];
      if (rowIndexStr && columnId) {
        const rowIndex = Number.parseInt(rowIndexStr, 10);
        if (!Number.isNaN(rowIndex)) {
          meta?.updateData?.(rowIndex, columnId, "");
        }
      }
    }

    closeContextMenu?.();
  }, [meta, selectionState, closeContextMenu]);

  if (!contextMenu) return null;

  return (
    <DropdownMenu
      open={contextMenu.open}
      onOpenChange={(open) => {
        if (!open) {
          closeContextMenu?.();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          ref={virtualTriggerRef}
          type="button"
          tabIndex={-1}
          style={{ position: "fixed" }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-48"
        data-grid-popover
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DropdownMenuItem onClick={onCopy}>
          <CopyIcon />
          Copy
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
