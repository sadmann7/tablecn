"use client";

import type { ColumnDef } from "@tanstack/react-table";

import {
  ArrowUpDown,
  CalendarIcon,
  CircleDashed,
  Clock,
  Text,
} from "lucide-react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { formatDate } from "@/lib/format";
import { DataTableColumnHeader } from "@/registry/bases/radix/components/data-table/data-table-column-header";
import { Badge } from "@/registry/bases/radix/ui/badge";

import {
  getLaunchPriorityIcon,
  getLaunchStatusIcon,
  launchHoursRange,
  launchPriorityOptions,
  launchStatusOptions,
  type LaunchTask,
} from "../lib/data";

export const launchColumns: ColumnDef<DataTableFeatures, LaunchTask>[] = [
  {
    id: "title",
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Title" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {row.original.label}
        </Badge>
        <span className="max-w-90 truncate font-medium">
          {row.original.title}
        </span>
      </div>
    ),
    meta: {
      label: "Title",
      placeholder: "Search titles...",
      variant: "text",
      icon: Text,
    },
    enableColumnFilter: true,
  },
  {
    id: "status",
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Status" />
    ),
    cell: ({ row }) => {
      const Icon = getLaunchStatusIcon(row.original.status);

      return (
        <Badge variant="outline" className="py-1 capitalize [&>svg]:size-3.5">
          <Icon />
          {row.original.status}
        </Badge>
      );
    },
    meta: {
      label: "Status",
      variant: "multiSelect",
      options: launchStatusOptions,
      icon: CircleDashed,
    },
    enableColumnFilter: true,
  },
  {
    id: "priority",
    accessorKey: "priority",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Priority" />
    ),
    cell: ({ row }) => {
      const Icon = getLaunchPriorityIcon(row.original.priority);

      return (
        <Badge variant="outline" className="py-1 capitalize [&>svg]:size-3.5">
          <Icon />
          {row.original.priority}
        </Badge>
      );
    },
    meta: {
      label: "Priority",
      variant: "multiSelect",
      options: launchPriorityOptions,
      icon: ArrowUpDown,
    },
    enableColumnFilter: true,
  },
  {
    id: "estimatedHours",
    accessorKey: "estimatedHours",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Est. Hours" />
    ),
    cell: ({ row }) => (
      <div className="w-20 text-right tabular-nums">
        {row.original.estimatedHours}
      </div>
    ),
    meta: {
      label: "Est. Hours",
      variant: "range",
      range: launchHoursRange,
      unit: "hr",
      icon: Clock,
    },
    enableColumnFilter: true,
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Created At" />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt, { timeZone: "UTC" }),
    meta: {
      label: "Created At",
      variant: "dateRange",
      icon: CalendarIcon,
    },
    enableColumnFilter: true,
  },
];
