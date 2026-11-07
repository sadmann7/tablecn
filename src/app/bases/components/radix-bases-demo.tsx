"use client";

import * as React from "react";

import type { Task } from "@/db/schema";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { getDataTableActionsColumn } from "@/registry/bases/radix/components/data-table/data-table-actions-column";
import { DataTableAdvancedToolbar } from "@/registry/bases/radix/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/registry/bases/radix/components/data-table/data-table-column-header";
import { DataTableCommandFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-command-filter-menu";
import { DataTableFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
import { getDataTableSelectColumn } from "@/registry/bases/radix/components/data-table/data-table-select-column";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";
import { Badge } from "@/registry/bases/radix/ui/badge";
import { DirectionProvider } from "@/registry/bases/radix/ui/direction";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/registry/bases/radix/ui/dropdown-menu";

import { useBasesDemo } from "../hooks/use-bases-demo";
import { getBasesColumns } from "../lib/columns";

export function RadixBasesDemo() {
  const { filterMode, dir, data, onCopy, onDelete } = useBasesDemo();

  const columns = React.useMemo(
    () =>
      getBasesColumns({
        data,
        selectColumn: getDataTableSelectColumn<Task>(),
        actionsColumn: getDataTableActionsColumn<Task>({
          actions: ({ row }) => (
            <>
              <DropdownMenuItem onSelect={() => onCopy(row.original)}>
                Copy code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </>
          ),
          getAriaLabel: (row) => `Open actions for ${row.original.code}`,
        }),
        renderHeader: (column, label) => (
          <DataTableColumnHeader column={column} label={label} />
        ),
        renderBadge: (children) => (
          <Badge variant="outline" className="py-1 [&>svg]:size-3.5">
            {children}
          </Badge>
        ),
      }),
    [data, onCopy, onDelete],
  );

  const { table } = useDataTable({
    mode: "client",
    data,
    columns,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { start: ["select"], end: ["actions"] },
    },
    getRowId: (row) => row.id,
    clearOnDefault: true,
    enableRowRangeSelection: true,
  });

  return (
    <DirectionProvider dir={dir}>
      <DataTable aria-label="Tasks" table={table}>
        {filterMode === "plain" ? (
          <DataTableToolbar
            table={table}
            globalFilterPlaceholder="Search tasks..."
          >
            <DataTableSortMenu table={table} align="end" />
          </DataTableToolbar>
        ) : (
          <DataTableAdvancedToolbar table={table}>
            <DataTableSortMenu table={table} align="start" />
            {filterMode === "advanced" ? (
              <DataTableFilterMenu table={table} align="start" />
            ) : (
              <DataTableCommandFilterMenu table={table} align="start" />
            )}
          </DataTableAdvancedToolbar>
        )}
      </DataTable>
    </DirectionProvider>
  );
}
