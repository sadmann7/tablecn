"use client";

import { Subscribe, type Table, type TableState } from "@tanstack/react-table";
import { CheckCircle2, Copy, Eraser, Network, Trash2, X } from "lucide-react";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { ActionBarTooltipItem } from "@/components/action-bar-tooltip-item";
import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/registry/bases/radix/ui/action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";

import { duplicateRows } from "../lib/duplicate-rows";
import { departments, type Person, statuses } from "../lib/seeds";

interface PeopleDataGridActionBarProps {
  table: Table<DataGridFeatures, Person>;
}

export function PeopleDataGridActionBar({
  table,
}: PeopleDataGridActionBarProps) {
  return (
    <Subscribe source={table.store} selector={selectSelectionState}>
      {() => <PeopleDataGridActionBarImpl table={table} />}
    </Subscribe>
  );
}

function PeopleDataGridActionBarImpl({ table }: PeopleDataGridActionBarProps) {
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
      duplicateRows(table, getTargetRows(table));
    },
    [table],
  );

  const onCellsUpdate = React.useCallback(
    <TColumnId extends keyof Person>(
      columnId: TColumnId,
      value: Person[TColumnId],
    ) => {
      table.updateCells(
        getTargetRows(table).map((row) => ({
          rowId: row.id,
          columnId,
          value,
        })),
      );
    },
    [table],
  );

  const onClear = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      table.clearCells(table.getSelectedCells());
    },
    [table],
  );

  const onDelete = React.useCallback(() => {
    table.deleteRows(getTargetRows(table).map((row) => row.id));
  }, [table]);

  return (
    <ActionBar
      data-grid-popover=""
      open={selectedCount > 0}
      onOpenChange={onOpenChange}
    >
      <ActionBarSelection className="whitespace-nowrap">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionBarTooltipItem label="Status" icon={<CheckCircle2 />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent data-grid-popover>
            {statuses.map((status) => (
              <DropdownMenuItem
                key={status}
                onSelect={() => onCellsUpdate("status", status)}
              >
                {status}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ActionBarTooltipItem label="Department" icon={<Network />} />
          </DropdownMenuTrigger>
          <DropdownMenuContent data-grid-popover>
            {departments.map((department) => (
              <DropdownMenuItem
                key={department}
                onSelect={() => onCellsUpdate("department", department)}
              >
                {department}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {!hasRowSelection && (
          <ActionBarTooltipItem
            label="Clear"
            icon={<Eraser />}
            onSelect={onClear}
          />
        )}
        <ActionBarTooltipItem
          label="Duplicate"
          icon={<Copy />}
          onSelect={onDuplicate}
        />
        <ActionBarTooltipItem
          variant="destructive"
          label="Delete"
          icon={<Trash2 />}
          onSelect={onDelete}
        />
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

function selectSelectionState(state: TableState<DataGridFeatures>) {
  return {
    rowSelection: state.rowSelection,
    cellSelection: state.cellSelection,
  };
}
