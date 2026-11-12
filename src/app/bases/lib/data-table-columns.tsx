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

import type { BasesColumnCopy } from "./fixtures";

import { getPriorityIcon, getStatusIcon } from "../../lib/utils";

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

interface GetBasesDataTableColumnsOptions {
  data: Task[];
  copy: BasesColumnCopy;
  selectColumn: ColumnDef<DataTableFeatures, Task>;
  actionsColumn: ColumnDef<DataTableFeatures, Task>;
  renderHeader: <TValue>(
    column: Column<DataTableFeatures, Task, TValue>,
  ) => React.ReactNode;
  renderBadge: (children: React.ReactNode) => React.ReactNode;
}

export function getBasesDataTableColumns({
  data,
  copy,
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
      meta: { label: copy.labels.code },
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
        label: copy.labels.title,
        placeholder: copy.titlePlaceholder,
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
        label: copy.labels.status,
        options: tasks.status.enumValues.map((status) => ({
          label: copy.statusLabels[status],
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
        label: copy.labels.priority,
        options: tasks.priority.enumValues.map((priority) => ({
          label: copy.priorityLabels[priority],
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
        label: copy.labels.estimatedHours,
        ...copy.hours,
        icon: Clock,
      },
    }),
    columnHelper.accessor("createdAt", {
      header: ({ column }) => renderHeader(column),
      cell: ({ cell }) => formatDate(cell.getValue()),
      meta: {
        label: copy.labels.createdAt,
        icon: CalendarIcon,
      },
    }),
    actionsColumn,
  ]);
}
