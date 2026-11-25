"use client";

import { createColumnHelper } from "@tanstack/react-table";
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
import { DataTableColumnHeader } from "@/registry/bases/radix/components/data-table/data-table-column-header";
import { Badge } from "@/registry/bases/radix/ui/badge";

import { getPriorityIcon, getStatusIcon } from "../lib/utils";

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

export const tasksApiColumns = columnHelper.columns([
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
