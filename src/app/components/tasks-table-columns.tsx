"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarIcon,
  CircleDashed,
  Clock,
  Ellipsis,
  Text,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataTableRowAction } from "@/lib/data-table-types";

import { type Task, tasks } from "@/db/schema";
import { getColumnOptions } from "@/lib/data-table-parsers";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import { DataTableColumnHeader } from "@/registry/bases/radix/components/data-table/data-table-column-header";
import { getDataTableSelectColumn } from "@/registry/bases/radix/components/data-table/data-table-select-column";
import { Badge } from "@/registry/bases/radix/ui/badge";
import { Button } from "@/registry/bases/radix/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";

import { updateTask } from "../lib/actions";
import { getPriorityIcon, getStatusIcon } from "../lib/utils";
import { tasksColumnConfigs } from "../lib/validations";

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

interface GetTasksTableColumnsProps {
  statusCounts: Record<Task["status"], number>;
  priorityCounts: Record<Task["priority"], number>;
  estimatedHoursRange: { min: number; max: number };
  setRowAction: React.Dispatch<
    React.SetStateAction<DataTableRowAction<Task> | null>
  >;
}

export function getTasksTableColumns({
  statusCounts,
  priorityCounts,
  estimatedHoursRange,
  setRowAction,
}: GetTasksTableColumnsProps) {
  return columnHelper.columns([
    getDataTableSelectColumn<Task>(),
    columnHelper.accessor("code", {
      id: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Task" />
      ),
      cell: ({ cell }) => <div>{cell.getValue()}</div>,
      ...getColumnOptions(tasksColumnConfigs.code),
      enableHiding: false,
    }),
    columnHelper.accessor("title", {
      id: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Title" />
      ),
      cell: ({ row, cell }) => {
        const label = tasks.label.enumValues.find(
          (label) => label === row.original.label,
        );

        return (
          <div className="flex items-center gap-2">
            {label && <Badge variant="outline">{label}</Badge>}
            <span className="min-w-0 truncate font-medium">
              {cell.getValue()}
            </span>
          </div>
        );
      },
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
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Status" />
      ),
      cell: ({ cell }) => {
        const status = tasks.status.enumValues.find(
          (status) => status === cell.getValue(),
        );

        if (!status) return null;

        const Icon = getStatusIcon(status);

        return (
          <Badge variant="outline" className="py-1 [&>svg]:size-3.5">
            <Icon />
            <span className="capitalize">{status}</span>
          </Badge>
        );
      },
      meta: {
        label: "Status",
        variant: tasksColumnConfigs.status.variant,
        options: tasks.status.enumValues.map((status) => ({
          label: status.charAt(0).toUpperCase() + status.slice(1),
          value: status,
          count: statusCounts[status],
          icon: getStatusIcon(status),
        })),
        icon: CircleDashed,
      },
      ...getColumnOptions(tasksColumnConfigs.status),
    }),
    columnHelper.accessor("priority", {
      id: "priority",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Priority" />
      ),
      cell: ({ cell }) => {
        const priority = tasks.priority.enumValues.find(
          (priority) => priority === cell.getValue(),
        );

        if (!priority) return null;

        const Icon = getPriorityIcon(priority);

        return (
          <Badge variant="outline" className="py-1 [&>svg]:size-3.5">
            <Icon />
            <span className="capitalize">{priority}</span>
          </Badge>
        );
      },
      meta: {
        label: "Priority",
        variant: tasksColumnConfigs.priority.variant,
        options: tasks.priority.enumValues.map((priority) => ({
          label: priority.charAt(0).toUpperCase() + priority.slice(1),
          value: priority,
          count: priorityCounts[priority],
          icon: getPriorityIcon(priority),
        })),
        icon: ArrowUpDown,
      },
      ...getColumnOptions(tasksColumnConfigs.priority),
    }),
    columnHelper.accessor("estimatedHours", {
      id: "estimatedHours",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Est. Hours" />
      ),
      cell: ({ cell }) => (
        <div className="w-20 text-right">{cell.getValue()}</div>
      ),
      meta: {
        label: "Est. Hours",
        variant: tasksColumnConfigs.estimatedHours.variant,
        range: [estimatedHoursRange.min, estimatedHoursRange.max],
        unit: "hr",
        icon: Clock,
      },
      ...getColumnOptions(tasksColumnConfigs.estimatedHours),
    }),
    columnHelper.accessor("createdAt", {
      id: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} label="Created At" />
      ),
      cell: ({ cell }) => formatDate(cell.getValue()),
      meta: {
        label: "Created At",
        variant: tasksColumnConfigs.createdAt.variant,
        icon: CalendarIcon,
      },
      ...getColumnOptions(tasksColumnConfigs.createdAt),
    }),
    columnHelper.display({
      id: "actions",
      cell: function Cell({ row }) {
        const [isUpdatePending, startUpdateTransition] = React.useTransition();

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open menu"
                variant="ghost"
                className="flex size-8 p-0 data-[state=open]:bg-muted"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onSelect={() => setRowAction({ row, variant: "update" })}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Labels</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={row.original.label}
                    onValueChange={(value) => {
                      startUpdateTransition(() => {
                        toast.promise(
                          updateTask({
                            id: row.original.id,
                            label: value as Task["label"],
                          }),
                          {
                            loading: "Updating...",
                            success: "Label updated",
                            error: (err) => getErrorMessage(err),
                          },
                        );
                      });
                    }}
                  >
                    {tasks.label.enumValues.map((label) => (
                      <DropdownMenuRadioItem
                        key={label}
                        value={label}
                        className="capitalize"
                        disabled={isUpdatePending}
                      >
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setRowAction({ row, variant: "delete" })}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 48,
    }),
  ]);
}
