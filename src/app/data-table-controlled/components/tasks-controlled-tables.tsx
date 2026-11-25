"use client";

import * as React from "react";

import type { DataQuery } from "@/lib/data-table-types";

import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import { useDataTable } from "@/registry/bases/radix/hooks/use-data-table";

import { tasksApiColumns } from "../../components/tasks-api-columns";
import { fetchTasks } from "../../lib/fetch-tasks";
import { tasksTableConfig } from "../../lib/validations";

const openQuery = getStatusQuery(["todo", "in-progress"]);
const closedQuery = getStatusQuery(["done", "canceled"]);

export function TasksControlledTables() {
  return (
    <>
      <TasksSection title="Open tasks" initialQuery={openQuery} />
      <TasksSection title="Closed tasks" initialQuery={closedQuery} />
    </>
  );
}

interface TasksSectionProps {
  title: string;
  initialQuery: DataQuery;
}

function TasksSection({ title, initialQuery }: TasksSectionProps) {
  const headingId = React.useId();
  const [query, setQuery] = React.useState(initialQuery);
  const { table } = useDataTable({
    config: tasksTableConfig,
    columns: tasksApiColumns,
    fetcher: fetchTasks,
    query,
    onQueryChange: setQuery,
    getRowId: (row) => row.id,
  });

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      <DataTable aria-labelledby={headingId} table={table}>
        <DataTableToolbar table={table}>
          <DataTableSortMenu table={table} align="end" />
        </DataTableToolbar>
      </DataTable>
    </section>
  );
}

function getStatusQuery(statuses: string[]): DataQuery {
  return {
    ...tasksTableConfig.defaultQuery,
    filters: [
      {
        id: "status",
        value: statuses,
        variant: "select",
        operator: "inArray",
        filterId: "status-0",
      },
    ],
  };
}
