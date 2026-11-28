"use client";

import { RefreshCw } from "lucide-react";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";
import { Button } from "@/registry/bases/radix/ui/button";

import { tasksApiColumns } from "../../components/tasks-api-columns";
import { fetchTasks } from "../../lib/fetch-tasks";
import { tasksTableConfig } from "../../lib/validations";

export function TasksFetcherTable() {
  const { table, status, refetch } = useDataTable({
    config: tasksTableConfig,
    columns: tasksApiColumns,
    fetcher: fetchTasks,
    getRowId: (row) => row.id,
  });
  const isFetching = status === "loading" || status === "refreshing";

  return (
    <DataTable aria-label="Tasks" table={table}>
      <DataTableToolbar table={table}>
        <DataTableSortMenu table={table} align="end" />
        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={refetch}
        >
          <RefreshCw className={isFetching ? "motion-safe:animate-spin" : ""} />
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
      </DataTableToolbar>
    </DataTable>
  );
}
