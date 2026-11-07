import type * as React from "react";

import {
  type Column,
  type ColumnDef,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarIcon,
  CircleDashed,
  Clock,
  Text,
} from "lucide-react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { type Task, tasks } from "@/db/schema";
import { getColumnOptions } from "@/lib/data-table-parsers";
import { formatDate } from "@/lib/format";

import { getPriorityIcon, getStatusIcon } from "../../lib/utils";
import { tasksColumnConfigs } from "../../lib/validations";

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

interface GetBasesColumnsOptions {
  data: Task[];
  selectColumn: ColumnDef<DataTableFeatures, Task>;
  actionsColumn: ColumnDef<DataTableFeatures, Task>;
  renderHeader: <TValue>(
    column: Column<DataTableFeatures, Task, TValue>,
    label: string,
  ) => React.ReactNode;
  renderBadge: (children: React.ReactNode) => React.ReactNode;
}

export function getBasesColumns({
  data,
  selectColumn,
  actionsColumn,
  renderHeader,
  renderBadge,
}: GetBasesColumnsOptions) {
  return columnHelper.columns([
    selectColumn,
    columnHelper.accessor("code", {
      id: "code",
      header: ({ column }) => renderHeader(column, "Task"),
      cell: ({ cell }) => <div>{cell.getValue()}</div>,
      ...getColumnOptions(tasksColumnConfigs.code),
      enableHiding: false,
    }),
    columnHelper.accessor("title", {
      id: "title",
      header: ({ column }) => renderHeader(column, "Title"),
      cell: ({ row, cell }) => (
        <div className="flex items-center gap-2">
          {renderBadge(row.original.label)}
          <span className="min-w-0 truncate font-medium">
            {cell.getValue()}
          </span>
        </div>
      ),
      meta: {
        label: "Title",
        placeholder: "Search titles...",
        variant: tasksColumnConfigs.title.variant,
        icon: Text,
      },
      ...getColumnOptions(tasksColumnConfigs.title),
      size: 500,
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: ({ column }) => renderHeader(column, "Status"),
      cell: ({ cell }) => {
        const status = cell.getValue();
        const Icon = getStatusIcon(status);

        return renderBadge(
          <>
            <Icon />
            <span className="capitalize">{status}</span>
          </>,
        );
      },
      meta: {
        label: "Status",
        variant: tasksColumnConfigs.status.variant,
        options: tasks.status.enumValues.map((status) => ({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          value: status,
          count: data.filter((task) => task.status === status).length,
          icon: getStatusIcon(status),
        })),
        icon: CircleDashed,
      },
      ...getColumnOptions(tasksColumnConfigs.status),
    }),
    columnHelper.accessor("priority", {
      id: "priority",
      header: ({ column }) => renderHeader(column, "Priority"),
      cell: ({ cell }) => {
        const priority = cell.getValue();
        const Icon = getPriorityIcon(priority);

        return renderBadge(
          <>
            <Icon />
            <span className="capitalize">{priority}</span>
          </>,
        );
      },
      meta: {
        label: "Priority",
        variant: tasksColumnConfigs.priority.variant,
        options: tasks.priority.enumValues.map((priority) => ({
          label: priority.charAt(0).toUpperCase() + priority.slice(1),
          value: priority,
          count: data.filter((task) => task.priority === priority).length,
          icon: getPriorityIcon(priority),
        })),
        icon: ArrowUpDown,
      },
      ...getColumnOptions(tasksColumnConfigs.priority),
    }),
    columnHelper.accessor("estimatedHours", {
      id: "estimatedHours",
      header: ({ column }) => renderHeader(column, "Est. Hours"),
      cell: ({ cell }) => (
        <div className="w-20 text-right">{cell.getValue()}</div>
      ),
      meta: {
        label: "Est. Hours",
        variant: tasksColumnConfigs.estimatedHours.variant,
        filter: tasksColumnConfigs.estimatedHours.filter,
        min: 1,
        max: 24,
        unit: "hr",
        icon: Clock,
      },
      ...getColumnOptions(tasksColumnConfigs.estimatedHours),
    }),
    columnHelper.accessor("createdAt", {
      id: "createdAt",
      header: ({ column }) => renderHeader(column, "Created At"),
      cell: ({ cell }) => formatDate(cell.getValue()),
      meta: {
        label: "Created At",
        variant: tasksColumnConfigs.createdAt.variant,
        filter: tasksColumnConfigs.createdAt.filter,
        icon: CalendarIcon,
      },
      ...getColumnOptions(tasksColumnConfigs.createdAt),
    }),
    actionsColumn,
  ]);
}
