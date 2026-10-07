"use client";

import type { RowData, Table } from "@tanstack/react-table";

import * as React from "react";
import { toast } from "sonner";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { ContextMenuState } from "@/lib/data-grid-types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataGridContextMenuProps<TData extends RowData> {
  table: Table<DataGridFeatures, TData>;
  contextMenu: ContextMenuState;
  dataGridRef: React.RefObject<HTMLDivElement | null>;
}

export function DataGridContextMenu<TData extends RowData>(
  props: DataGridContextMenuProps<TData>,
) {
  if (!props.contextMenu.open) return null;

  return <ContextMenu {...props} />;
}

const ContextMenu = React.memo(ContextMenuImpl, (prev, next) => {
  if (prev.contextMenu.open !== next.contextMenu.open) return false;
  if (!next.contextMenu.open) return true;
  if (prev.contextMenu.x !== next.contextMenu.x) return false;
  if (prev.contextMenu.y !== next.contextMenu.y) return false;

  return true;
}) as typeof ContextMenuImpl;

function ContextMenuImpl<TData extends RowData>({
  table,
  contextMenu,
  dataGridRef,
}: DataGridContextMenuProps<TData>) {
  const readOnly = table.getIsReadOnly();
  const canDeleteRows = !readOnly && !!table.options.onRowsDelete;

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
      dataGridRef.current?.focus();
    },
    [dataGridRef],
  );

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) table.closeContextMenu();
    },
    [table],
  );

  const onCopy = React.useCallback(() => {
    void table.copySelectedCells();
  }, [table]);

  const onCut = React.useCallback(() => {
    void table.cutSelectedCells();
  }, [table]);

  const onClear = React.useCallback(() => {
    const cells = table.getSelectedCells();
    if (cells.length === 0) return;

    table.clearCells(cells);

    toast.success(
      `${cells.length} cell${cells.length !== 1 ? "s" : ""} cleared`,
    );
  }, [table]);

  const onDelete = React.useCallback(async () => {
    const rowIds = new Set(table.getSelectedCells().map((cell) => cell.rowId));
    if (rowIds.size === 0) return;

    await table.deleteRows(Array.from(rowIds));

    toast.success(`${rowIds.size} row${rowIds.size !== 1 ? "s" : ""} deleted`);
  }, [table]);

  return (
    <DropdownMenu open={contextMenu.open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger style={triggerStyle} />
      <DropdownMenuContent
        data-grid-popover=""
        align="start"
        className="w-48"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DropdownMenuItem onSelect={onCopy}>
          <IconPlaceholder
            lucide="CopyIcon"
            tabler="IconCopy"
            hugeicons="Copy01Icon"
            phosphor="CopyIcon"
            remixicon="RiFileCopyLine"
          />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCut} disabled={readOnly}>
          <IconPlaceholder
            lucide="ScissorsIcon"
            tabler="IconCut"
            hugeicons="ScissorIcon"
            phosphor="ScissorsIcon"
            remixicon="RiScissorsLine"
          />
          Cut
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onClear} disabled={readOnly}>
          <IconPlaceholder
            lucide="EraserIcon"
            tabler="IconEraser"
            hugeicons="DeleteIcon"
            phosphor="EraserIcon"
            remixicon="RiEraserLine"
          />
          Clear
        </DropdownMenuItem>
        {canDeleteRows && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <IconPlaceholder
                lucide="Trash2Icon"
                tabler="IconTrash"
                hugeicons="Delete02Icon"
                phosphor="TrashIcon"
                remixicon="RiDeleteBinLine"
              />
              Delete rows
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
