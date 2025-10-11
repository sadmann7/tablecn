"use client";

import type { Table } from "@tanstack/react-table";
import { Copy, Eraser } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UpdateCell } from "@/types/data-grid";

interface DataGridContextMenuProps<TData> {
  table: Table<TData>;
}

export function DataGridContextMenu<TData>({
  table,
}: DataGridContextMenuProps<TData>) {
  const meta = table.options.meta;
  const contextMenu = meta?.contextMenu;
  const onContextMenuOpenChange = meta?.onContextMenuOpenChange;
  const selectionState = meta?.selectionState;

  const virtualTriggerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      left: `${contextMenu?.x ?? 0}px`,
      top: `${contextMenu?.y ?? 0}px`,
      width: "1px",
      height: "1px",
      padding: 0,
      margin: 0,
      border: "none",
      background: "transparent",
      pointerEvents: "none",
      opacity: 0,
    }),
    [contextMenu?.x, contextMenu?.y],
  );

  const onCloseAutoFocus: React.ComponentProps<
    typeof DropdownMenuContent
  >["onCloseAutoFocus"] = React.useCallback((event: Event) => {
    event.preventDefault();
  }, []);

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
    toast.success(
      `${selectionState.selectedCells.size} cell${selectionState.selectedCells.size !== 1 ? "s" : ""} copied`,
    );
  }, [table, selectionState]);

  const onClear = React.useCallback(() => {
    if (
      !selectionState?.selectedCells ||
      selectionState.selectedCells.size === 0
    )
      return;

    const updates: Array<UpdateCell> = [];

    for (const cellKey of selectionState.selectedCells) {
      const parts = cellKey.split(":");
      const rowIndexStr = parts[0];
      const columnId = parts[1];
      if (rowIndexStr && columnId) {
        const rowIndex = Number.parseInt(rowIndexStr, 10);
        if (!Number.isNaN(rowIndex)) {
          updates.push({ rowIndex, columnId, value: "" });
        }
      }
    }

    meta?.updateCells?.(updates);

    toast.success(
      `${updates.length} cell${updates.length !== 1 ? "s" : ""} cleared`,
    );
  }, [meta, selectionState]);

  if (!contextMenu) return null;

  return (
    <DropdownMenu
      open={contextMenu.open}
      onOpenChange={onContextMenuOpenChange}
    >
      <DropdownMenuTrigger asChild>
        <button type="button" tabIndex={-1} style={virtualTriggerStyle} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-48"
        data-grid-popover
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DropdownMenuItem onClick={onCopy}>
          <Copy />
          Copy
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onClear}>
          <Eraser />
          Clear
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
