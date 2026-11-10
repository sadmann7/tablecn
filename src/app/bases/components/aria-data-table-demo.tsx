"use client";

import * as React from "react";

import type { Task } from "@/db/schema";

import { DataTable } from "@/registry/bases/aria/components/data-table/data-table";
import { getDataTableActionsColumn } from "@/registry/bases/aria/components/data-table/data-table-actions-column";
import { DataTableAdvancedToolbar } from "@/registry/bases/aria/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/registry/bases/aria/components/data-table/data-table-column-header";
import { DataTableCommandFilterMenu } from "@/registry/bases/aria/components/data-table/data-table-command-filter-menu";
import { DataTableFilterMenu } from "@/registry/bases/aria/components/data-table/data-table-filter-menu";
import { getDataTableSelectColumn } from "@/registry/bases/aria/components/data-table/data-table-select-column";
import { DataTableSortMenu } from "@/registry/bases/aria/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/aria/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/aria/hooks/use-data-table";
import { Badge } from "@/registry/bases/aria/ui/badge";
import { DirectionProvider } from "@/registry/bases/aria/ui/direction";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/registry/bases/aria/ui/dropdown-menu";

import { useBasesDataTable } from "../hooks/use-bases-data-table";
import { getBasesDataTableColumns } from "../lib/data-table-columns";
import { basesTasksTable } from "../lib/table";

export function AriaDataTableDemo() {
  const { filterMode, dir, data, onCopy, onDelete } = useBasesDataTable();

  const columns = React.useMemo(
    () =>
      getBasesDataTableColumns({
        data,
        selectColumn: getDataTableSelectColumn<Task>(),
        actionsColumn: getDataTableActionsColumn<Task>({
          actions: ({ row }) => (
            <>
              <DropdownMenuItem onAction={() => onCopy(row.original)}>
                Copy code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onAction={() => onDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </>
          ),
          getAriaLabel: (row) => `Open actions for ${row.original.code}`,
        }),
        renderHeader: (column) => <DataTableColumnHeader column={column} />,
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
    definition: basesTasksTable,
    initialState: {
      columnPinning: { start: ["select"], end: ["actions"] },
    },
    getRowId: (row) => row.id,
    clearOnDefault: true,
    enableRowRangeSelection: true,
  });

  return (
    <DirectionProvider direction={dir}>
      <DataTable aria-label="Tasks" table={table}>
        {filterMode === "plain" ? (
          <DataTableToolbar
            table={table}
            globalFilterPlaceholder="Search tasks..."
          >
            <DataTableSortMenu table={table} placement="bottom end" />
          </DataTableToolbar>
        ) : (
          <DataTableAdvancedToolbar
            table={table}
            globalFilterPlaceholder="Search tasks..."
          >
            <DataTableSortMenu table={table} placement="bottom start" />
            {filterMode === "advanced" ? (
              <DataTableFilterMenu table={table} placement="bottom start" />
            ) : (
              <DataTableCommandFilterMenu
                table={table}
                placement="bottom start"
              />
            )}
          </DataTableAdvancedToolbar>
        )}
      </DataTable>
    </DirectionProvider>
  );
}
