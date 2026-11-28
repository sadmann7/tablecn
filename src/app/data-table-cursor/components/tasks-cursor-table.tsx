"use client";

import type { DataTableColumnConfigs } from "@/lib/data-table-types";

import { type Task } from "@/db/schema";
import { createDataTableConfig } from "@/lib/data-table-config";
import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

import { tasksApiColumns } from "../../components/tasks-api-columns";
import { fetchTasksByCursor } from "../../lib/fetch-tasks";

const tasksCursorTableConfig = createDataTableConfig({
  columns: {
    title: { variant: "text", enableSorting: false },
    status: { variant: "select", enableSorting: false },
    priority: { variant: "select", enableSorting: false },
    estimatedHours: { variant: "number", enableSorting: false },
    createdAt: { variant: "date" },
  } satisfies DataTableColumnConfigs<Task>,
  defaultSorting: [{ id: "createdAt", desc: true }],
  enableGlobalFilter: false,
});

export function TasksCursorTable() {
  const { table } = useDataTable({
    config: tasksCursorTableConfig,
    columns: tasksApiColumns,
    fetcher: fetchTasksByCursor,
    pagination: "cursor",
    getRowId: (row) => row.id,
  });

  return (
    <DataTable aria-label="Tasks" table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
