"use client";

import type { Table, TableMeta } from "@tanstack/react-table";
import { CheckCircle2, Palette, Trash2, X } from "lucide-react";
import * as React from "react";

import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/components/ui/action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CellSelectOption } from "@/types/data-grid";

interface DataGridActionBarProps<TData> {
  table: Table<TData>;
  tableMeta: TableMeta<TData>;
  statusOptions?: CellSelectOption[];
  styleOptions?: CellSelectOption[];
  onStatusUpdate?: (value: string) => void;
  onStyleUpdate?: (value: string) => void;
  onDelete?: () => void;
}

export function DataGridActionBar<TData>({
  table,
  tableMeta,
  statusOptions,
  styleOptions,
  onStatusUpdate,
  onStyleUpdate,
  onDelete,
}: DataGridActionBarProps<TData>) {
  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        table.toggleAllRowsSelected(false);
        tableMeta.onSelectionClear?.();
      }
    },
    [table, tableMeta],
  );

  const selectedRowCount = table.getSelectedRowModel().rows.length;

  return (
    <ActionBar
      data-grid-popover
      open={selectedRowCount > 0}
      onOpenChange={onOpenChange}
    >
      <ActionBarSelection>
        <span className="font-medium">{selectedRowCount}</span>
        <span>{selectedRowCount === 1 ? "row" : "rows"} selected</span>
        <ActionBarSeparator />
        <ActionBarClose>
          <X />
        </ActionBarClose>
      </ActionBarSelection>
      <ActionBarSeparator />
      <ActionBarGroup>
        {statusOptions && statusOptions.length > 0 && onStatusUpdate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionBarItem variant="secondary" size="sm">
                <CheckCircle2 />
                Status
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover>
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onStatusUpdate(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {styleOptions && styleOptions.length > 0 && onStyleUpdate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionBarItem variant="secondary" size="sm">
                <Palette />
                Style
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover>
              {styleOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onStyleUpdate(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onDelete && (
          <ActionBarItem variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 />
            Delete
          </ActionBarItem>
        )}
      </ActionBarGroup>
    </ActionBar>
  );
}
