"use client";

import {
  type Row,
  type RowData,
  Subscribe,
  type Table,
} from "@tanstack/react-table";
import { CheckCircle2, Palette, Trash2, X } from "lucide-react";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { CellSelectOption } from "@/lib/data-grid-types";

import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/registry/bases/radix/ui/action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";

type SkaterRows<TData extends RowData> = Array<Row<DataGridFeatures, TData>>;

interface SkatersGridActionBarProps<TData extends RowData> {
  table: Table<DataGridFeatures, TData>;
  statusOptions?: CellSelectOption[];
  styleOptions?: CellSelectOption[];
  onStatusUpdate?: (value: string, rows: SkaterRows<TData>) => void;
  onStyleUpdate?: (value: string, rows: SkaterRows<TData>) => void;
  onDelete?: (rows: SkaterRows<TData>) => void;
}

export function SkatersGridActionBar<TData extends RowData>(
  props: SkatersGridActionBarProps<TData>,
) {
  return (
    <Subscribe
      source={props.table.store}
      selector={(state) => ({
        rowSelection: state.rowSelection,
        cellSelection: state.cellSelection,
      })}
    >
      {() => <SkatersGridActionBarImpl {...props} />}
    </Subscribe>
  );
}

function SkatersGridActionBarImpl<TData extends RowData>({
  table,
  statusOptions,
  styleOptions,
  onStatusUpdate,
  onStyleUpdate,
  onDelete,
}: SkatersGridActionBarProps<TData>) {
  const hasRowSelection = table.getHasRowSelection();
  const selectedCount = hasRowSelection
    ? table.getSelectedRowIds().length
    : table.getSelectedRangeCellCount();

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        table.toggleAllRowsSelected(false);
        table.clearSelection();
      }
    },
    [table],
  );

  return (
    <ActionBar
      data-grid-popover
      open={selectedCount > 0}
      onOpenChange={onOpenChange}
    >
      <ActionBarSelection>
        <span className="font-medium">{selectedCount}</span>
        <span>
          {hasRowSelection
            ? selectedCount === 1
              ? "row"
              : "rows"
            : selectedCount === 1
              ? "cell"
              : "cells"}{" "}
          selected
        </span>
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
              <ActionBarItem variant="secondary">
                <CheckCircle2 />
                Status
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover>
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() =>
                    onStatusUpdate(option.value, getTargetRows(table))
                  }
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
              <ActionBarItem variant="secondary">
                <Palette />
                Style
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover>
              {styleOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() =>
                    onStyleUpdate(option.value, getTargetRows(table))
                  }
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onDelete && (
          <ActionBarItem
            variant="destructive"
            onClick={() => onDelete(getTargetRows(table))}
          >
            <Trash2 />
            Delete
          </ActionBarItem>
        )}
      </ActionBarGroup>
    </ActionBar>
  );
}

// Checked rows, or the rows a cell range covers
function getTargetRows<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
) {
  if (table.getHasRowSelection()) return table.getSelectedRowModel().rows;

  const rowIds = new Set(table.getSelectedCells().map((cell) => cell.rowId));
  return table.getRowModel().rows.filter((row) => rowIds.has(row.id));
}
