"use client";

import * as React from "react";

import type { Task } from "@/db/schema";
import type { DataTableRowAction, QueryKeys } from "@/lib/data-table-types";
import type { DataMode, FilterMode } from "@/lib/flag";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/registry/bases/radix/components/data-table/data-table-advanced-toolbar";
import { DataTableCommandFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-command-filter-menu";
import { DataTableFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import {
  useDataTable,
  UseDataTableProps,
} from "@/registry/bases/radix/hooks/use-data-table";

import type {
  getEstimatedHoursRange,
  getTaskPriorityCounts,
  getTasks,
  getTaskStatusCounts,
} from "../lib/queries";

import { DeleteTasksDialog } from "./delete-tasks-dialog";
import { TasksTableActionBar } from "./tasks-table-action-bar";
import { getTasksTableColumns } from "./tasks-table-columns";
import { UpdateTaskSheet } from "./update-task-sheet";

interface TasksTableProps {
  dataMode: DataMode;
  filterMode: FilterMode;
  promises: Promise<
    [
      Awaited<ReturnType<typeof getTasks>>,
      Awaited<ReturnType<typeof getTaskStatusCounts>>,
      Awaited<ReturnType<typeof getTaskPriorityCounts>>,
      Awaited<ReturnType<typeof getEstimatedHoursRange>>,
    ]
  >;
  queryKeys?: Partial<QueryKeys>;
}

export function TasksTable({
  dataMode,
  filterMode,
  promises,
  queryKeys,
}: TasksTableProps) {
  const enableAdvancedFilter = filterMode !== "plain";

  const [
    { data, pageCount },
    statusCounts,
    priorityCounts,
    estimatedHoursRange,
  ] = React.use(promises);

  const [rowAction, setRowAction] =
    React.useState<DataTableRowAction<Task> | null>(null);

  const columns = React.useMemo(
    () =>
      getTasksTableColumns({
        statusCounts,
        priorityCounts,
        estimatedHoursRange,
        setRowAction,
      }),
    [statusCounts, priorityCounts, estimatedHoursRange],
  );

  const tableProps: Omit<UseDataTableProps<Task>, "mode" | "pageCount"> = {
    data,
    columns,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
      columnPinning: { start: [], end: ["actions"] },
    },
    queryKeys,
    getRowId: (originalRow) => originalRow.id,
    enableRowRangeSelection: true,
    shallow: false,
    clearOnDefault: true,
  };

  const { table } = useDataTable(
    dataMode === "client"
      ? { ...tableProps, mode: "client" }
      : { ...tableProps, pageCount },
  );

  return (
    <>
      <DataTable
        table={table}
        actionBar={<TasksTableActionBar table={table} />}
      >
        {enableAdvancedFilter ? (
          <DataTableAdvancedToolbar table={table}>
            <DataTableSortMenu table={table} align="start" />
            {filterMode === "advanced" ? (
              <DataTableFilterMenu table={table} align="start" />
            ) : (
              <DataTableCommandFilterMenu table={table} align="start" />
            )}
          </DataTableAdvancedToolbar>
        ) : (
          <DataTableToolbar table={table}>
            <DataTableSortMenu table={table} align="end" />
          </DataTableToolbar>
        )}
      </DataTable>
      <UpdateTaskSheet
        open={rowAction?.variant === "update"}
        onOpenChange={() => setRowAction(null)}
        task={rowAction?.row.original ?? null}
      />
      <DeleteTasksDialog
        open={rowAction?.variant === "delete"}
        onOpenChange={() => setRowAction(null)}
        tasks={rowAction?.row.original ? [rowAction?.row.original] : []}
        showTrigger={false}
        onSuccess={() => rowAction?.row.toggleSelected(false)}
      />
    </>
  );
}
