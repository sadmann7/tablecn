"use client";

import { Subscribe, type Table } from "@tanstack/react-table";
import { Copy, Eraser, Trash2, X } from "lucide-react";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/registry/bases/radix/ui/action-bar";

import type { Person } from "../lib/seeds";

interface PeopleGridActionBarProps {
  table: Table<DataGridFeatures, Person>;
  onRowsDuplicate: (rows: Person[]) => void;
}

export function PeopleGridActionBar({
  table,
  onRowsDuplicate,
}: PeopleGridActionBarProps) {
  return (
    <Subscribe
      source={table.store}
      selector={(state) => ({
        rowSelection: state.rowSelection,
        cellSelection: state.cellSelection,
      })}
    >
      {() => (
        <PeopleGridActionBarImpl
          table={table}
          onRowsDuplicate={onRowsDuplicate}
        />
      )}
    </Subscribe>
  );
}

function PeopleGridActionBarImpl({
  table,
  onRowsDuplicate,
}: PeopleGridActionBarProps) {
  const hasRowSelection = table.getHasRowSelection();
  const selectedCount = hasRowSelection
    ? table.getSelectedRowIds().length
    : table.getSelectedRangeCellCount();

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) table.clearSelection();
    },
    [table],
  );

  const onDuplicate = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      onRowsDuplicate(getTargetRows(table).map((row) => row.original));
    },
    [table, onRowsDuplicate],
  );

  const onClear = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      table.clearCells(table.getSelectedCells());
    },
    [table],
  );

  const onDelete = React.useCallback(() => {
    void table.deleteRows(getTargetRows(table).map((row) => row.id));
  }, [table]);

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
        {!hasRowSelection && (
          <ActionBarItem onSelect={onClear}>
            <Eraser />
            Clear
          </ActionBarItem>
        )}
        <ActionBarItem onSelect={onDuplicate}>
          <Copy />
          Duplicate
        </ActionBarItem>
        <ActionBarItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Delete
        </ActionBarItem>
      </ActionBarGroup>
    </ActionBar>
  );
}

// Checked rows, or the rows a cell range covers
function getTargetRows(table: Table<DataGridFeatures, Person>) {
  if (table.getHasRowSelection()) return table.getSelectedRowModel().rows;

  const rowIds = new Set(table.getSelectedCells().map((cell) => cell.rowId));
  return table.getRowModel().rows.filter((row) => rowIds.has(row.id));
}
