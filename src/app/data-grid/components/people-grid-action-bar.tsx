"use client";

import { Subscribe, type Table } from "@tanstack/react-table";
import { Copy, Trash2, X } from "lucide-react";
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
    <Subscribe source={table.atoms.rowSelection}>
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
  const selectedRowIds = table.getSelectedRowIds();

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) table.clearSelection();
    },
    [table],
  );

  const onDuplicate = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      onRowsDuplicate(
        table.getSelectedRowModel().rows.map((row) => row.original),
      );
    },
    [table, onRowsDuplicate],
  );

  const onDelete = React.useCallback(() => {
    void table.deleteRows(selectedRowIds);
  }, [table, selectedRowIds]);

  return (
    <ActionBar
      data-grid-popover
      open={selectedRowIds.length > 0}
      onOpenChange={onOpenChange}
    >
      <ActionBarSelection>
        <span className="font-medium">{selectedRowIds.length}</span>
        <span>{selectedRowIds.length === 1 ? "row" : "rows"} selected</span>
        <ActionBarSeparator />
        <ActionBarClose>
          <X />
        </ActionBarClose>
      </ActionBarSelection>
      <ActionBarSeparator />
      <ActionBarGroup>
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
