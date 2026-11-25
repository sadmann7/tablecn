"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarIcon,
  CircleDashed,
  Clock,
  Text,
} from "lucide-react";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataFetcher, DataResult } from "@/lib/data-table-types";

import { type Task, tasks } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { DataTableColumnHeader } from "@/registry/bases/radix/components/data-table/data-table-column-header";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import {
  useDataTable,
  useDataTableQuery,
} from "@/registry/bases/radix/hooks/use-data-table";
import { Badge } from "@/registry/bases/radix/ui/badge";

import { getPriorityIcon, getStatusIcon } from "../../lib/utils";
import { tasksTableConfig } from "../../lib/validations";
import { getQueryStatus } from "../lib/query-status";

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

const columns = columnHelper.columns([
  columnHelper.accessor("code", {
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    meta: { label: "Task" },
    enableHiding: false,
  }),
  columnHelper.accessor("title", {
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ cell }) => (
      <span className="block max-w-120 truncate font-medium">
        {cell.getValue()}
      </span>
    ),
    meta: { label: "Title", placeholder: "Search titles...", icon: Text },
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ cell }) => {
      const Icon = getStatusIcon(cell.getValue());

      return (
        <Badge variant="outline" className="py-1 capitalize [&>svg]:size-3.5">
          <Icon />
          {cell.getValue()}
        </Badge>
      );
    },
    meta: {
      label: "Status",
      options: tasks.status.enumValues.map((status) => ({
        label: status.charAt(0).toUpperCase() + status.slice(1),
        value: status,
        icon: getStatusIcon(status),
      })),
      icon: CircleDashed,
    },
  }),
  columnHelper.accessor("priority", {
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ cell }) => {
      const Icon = getPriorityIcon(cell.getValue());

      return (
        <Badge variant="outline" className="py-1 capitalize [&>svg]:size-3.5">
          <Icon />
          {cell.getValue()}
        </Badge>
      );
    },
    meta: {
      label: "Priority",
      options: tasks.priority.enumValues.map((priority) => ({
        label: priority.charAt(0).toUpperCase() + priority.slice(1),
        value: priority,
        icon: getPriorityIcon(priority),
      })),
      icon: ArrowUpDown,
    },
  }),
  columnHelper.accessor("estimatedHours", {
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ cell }) => (
      <div className="w-20 text-right">{cell.getValue()}</div>
    ),
    meta: { label: "Est. Hours", unit: "hr", icon: Clock },
  }),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ cell }) => formatDate(cell.getValue()),
    meta: { label: "Created At", icon: CalendarIcon },
  }),
]);

const fetchTasks: DataFetcher<Task> = async (query, { signal }) => {
  const response = await fetch(
    `/api/tasks${tasksTableConfig.serialize(query)}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`The tasks request failed with ${response.status}.`);
  }
  return (await response.json()) as DataResult<Task>;
};

export function TasksQueryTable() {
  const query = useDataTableQuery({ config: tasksTableConfig });

  const tasksQuery = useQuery({
    queryKey: ["tasks", query],
    queryFn: ({ signal }) => fetchTasks(query, { signal }),
    placeholderData: keepPreviousData,
  });

  const { table } = useDataTable({
    config: tasksTableConfig,
    columns,
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
