"use client";

import type { Table, TableMeta } from "@tanstack/react-table";
import { CopyIcon, EraserIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseCellKey } from "@/lib/data-grid";
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
  const dataGridRef = meta?.dataGridRef;
  const onDataUpdate = meta?.onDataUpdate;
  const onRowsDelete = meta?.onRowsDelete;

  if (!contextMenu) return null;

  return (
    <ContextMenu
      table={table}
      dataGridRef={dataGridRef}
      contextMenu={contextMenu}
      onContextMenuOpenChange={onContextMenuOpenChange}
      selectionState={selectionState}
      onDataUpdate={onDataUpdate}
      onRowsDelete={onRowsDelete}
    />
  );
}

interface ContextMenuProps<TData>
  extends Pick<
      TableMeta<TData>,
      | "dataGridRef"
      | "onContextMenuOpenChange"
      | "selectionState"
      | "onDataUpdate"
      | "onRowsDelete"
    >,
    Required<Pick<TableMeta<TData>, "contextMenu">> {
  table: Table<TData>;
}

const ContextMenu = React.memo(ContextMenuImpl, (prev, next) => {
  if (prev.contextMenu.open !== next.contextMenu.open) return false;
  if (!next.contextMenu.open) return true;
  if (prev.contextMenu.x !== next.contextMenu.x) return false;
  if (prev.contextMenu.y !== next.contextMenu.y) return false;

  const prevSize = prev.selectionState?.selectedCells?.size ?? 0;
  const nextSize = next.selectionState?.selectedCells?.size ?? 0;
  if (prevSize !== nextSize) return false;

  return true;
}) as typeof ContextMenuImpl;

function ContextMenuImpl<TData>({
  table,
  dataGridRef,
  contextMenu,
  onContextMenuOpenChange,
  selectionState,
  onDataUpdate,
  onRowsDelete,
}: ContextMenuProps<TData>) {
  const triggerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      left: `${contextMenu.x}px`,
      top: `${contextMenu.y}px`,
      width: "1px",
      height: "1px",
      padding: 0,
      margin: 0,
      border: "none",
      background: "transparent",
      pointerEvents: "none",
      opacity: 0,
    }),
    [contextMenu.x, contextMenu.y],
  );

  const onCloseAutoFocus: NonNullable<
    React.ComponentProps<typeof DropdownMenuContent>["onCloseAutoFocus"]
  > = React.useCallback(
    (event) => {
      event.preventDefault();
      dataGridRef?.current?.focus();
    },
    [dataGridRef],
  );

  const onCopy = React.useCallback(() => {
    if (
      !selectionState?.selectedCells ||
      selectionState.selectedCells.size === 0
    )
      return;

    const rows = table.getRowModel().rows;
    const columnIds: string[] = [];

    const selectedCellsArray = Array.from(selectionState.selectedCells);
    for (const cellKey of selectedCellsArray) {
      const { columnId } = parseCellKey(cellKey);
      if (columnId && !columnIds.includes(columnId)) {
        columnIds.push(columnId);
      }
    }

    const cellData = new Map<string, string>();
    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
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

    const rowIndices = new Set<number>();
    const colIndices = new Set<number>();

    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      rowIndices.add(rowIndex);
      const colIndex = columnIds.indexOf(columnId);
      if (colIndex >= 0) {
        colIndices.add(colIndex);
      }
    }

    const sortedRowIndices = Array.from(rowIndices).sort((a, b) => a - b);
    const sortedColIndices = Array.from(colIndices).sort((a, b) => a - b);
    const sortedColumnIds = sortedColIndices.map((i) => columnIds[i]);

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
      const { rowIndex, columnId } = parseCellKey(cellKey);
      updates.push({ rowIndex, columnId, value: "" });
    }

    onDataUpdate?.(updates);

    toast.success(
      `${updates.length} cell${updates.length !== 1 ? "s" : ""} cleared`,
    );
  }, [onDataUpdate, selectionState]);

  const onDelete = React.useCallback(async () => {
    if (
      !selectionState?.selectedCells ||
      selectionState.selectedCells.size === 0
    )
      return;

    const rowIndices = new Set<number>();
    for (const cellKey of selectionState.selectedCells) {
      const { rowIndex } = parseCellKey(cellKey);
      rowIndices.add(rowIndex);
    }

    const rowIndicesArray = Array.from(rowIndices).sort((a, b) => a - b);
    const rowCount = rowIndicesArray.length;

    await onRowsDelete?.(rowIndicesArray);

    toast.success(`${rowCount} row${rowCount !== 1 ? "s" : ""} deleted`);
  }, [onRowsDelete, selectionState]);

  return (
    <DropdownMenu
      open={contextMenu.open}
      onOpenChange={onContextMenuOpenChange}
    >
      <DropdownMenuTrigger style={triggerStyle} />
      <DropdownMenuContent
        data-grid-popover=""
        align="start"
        className="w-48"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DropdownMenuItem onSelect={onCopy}>
          <CopyIcon />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onClear}>
          <EraserIcon />
          Clear
        </DropdownMenuItem>
        {onRowsDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon />
              Delete rows
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
