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
import { formatDate } from "@/lib/format";

import { getPriorityIcon, getStatusIcon } from "../../lib/utils";

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

interface GetBasesDataTableColumnsOptions {
  data: Task[];
  selectColumn: ColumnDef<DataTableFeatures, Task>;
  actionsColumn: ColumnDef<DataTableFeatures, Task>;
  renderHeader: <TValue>(
    column: Column<DataTableFeatures, Task, TValue>,
  ) => React.ReactNode;
  renderBadge: (children: React.ReactNode) => React.ReactNode;
}

export function getBasesDataTableColumns({
  data,
  selectColumn,
  actionsColumn,
  renderHeader,
  renderBadge,
}: GetBasesDataTableColumnsOptions) {
  return columnHelper.columns([
    selectColumn,
    columnHelper.accessor("code", {
      header: ({ column }) => renderHeader(column),
      cell: ({ cell }) => <div>{cell.getValue()}</div>,
      meta: { label: "Task" },
      enableHiding: false,
    }),
    columnHelper.accessor("title", {
      header: ({ column }) => renderHeader(column),
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
        icon: Text,
      },
      size: 500,
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => renderHeader(column),
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
        options: tasks.status.enumValues.map((status) => ({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          value: status,
          count: data.filter((task) => task.status === status).length,
          icon: getStatusIcon(status),
        })),
        icon: CircleDashed,
      },
    }),
    columnHelper.accessor("priority", {
      header: ({ column }) => renderHeader(column),
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
        options: tasks.priority.enumValues.map((priority) => ({
          label: priority.charAt(0).toUpperCase() + priority.slice(1),
          value: priority,
          count: data.filter((task) => task.priority === priority).length,
          icon: getPriorityIcon(priority),
        })),
        icon: ArrowUpDown,
      },
    }),
    columnHelper.accessor("estimatedHours", {
      header: ({ column }) => renderHeader(column),
      cell: ({ cell }) => (
        <div className="w-20 text-right">{cell.getValue()}</div>
      ),
      meta: {
        label: "Est. Hours",
        min: 1,
        max: 24,
        unit: "hr",
        icon: Clock,
      },
    }),
    columnHelper.accessor("createdAt", {
      header: ({ column }) => renderHeader(column),
      cell: ({ cell }) => formatDate(cell.getValue()),
      meta: {
        label: "Created At",
        icon: CalendarIcon,
      },
    }),
    actionsColumn,
  ]);
}
