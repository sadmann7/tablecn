"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import {
  useDataTable,
  useDataTableQuery,
} from "@/registry/bases/radix/hooks/use-data-table";

import { tasksApiColumns } from "../../components/tasks-api-columns";
import { fetchTasks } from "../../lib/fetch-tasks";
import { tasksTableConfig } from "../../lib/validations";
import { getQueryStatus } from "../lib/query-status";

export function TasksQueryTable() {
  const query = useDataTableQuery({ config: tasksTableConfig });

  const tasksQuery = useQuery({
    queryKey: ["tasks", query],
    queryFn: ({ signal }) => fetchTasks(query, { signal }),
    placeholderData: keepPreviousData,
  });

  const { table } = useDataTable({
    config: tasksTableConfig,
    columns: tasksApiColumns,
    result: tasksQuery.data,
    status: getQueryStatus(tasksQuery),
    error: tasksQuery.error,
    onRetry: () => void tasksQuery.refetch(),
    getRowId: (row) => row.id,
  });

  return (
    <DataTable aria-label="Tasks" table={table}>
      <DataTableToolbar table={table}>
        <DataTableSortMenu table={table} align="end" />
      </DataTableToolbar>
    </DataTable>
  );
}
