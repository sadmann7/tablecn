"use client";

import { createColumnHelper, type Row } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarIcon,
  CircleDashed,
  Clock,
  Text,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  DataTableQueryKeys,
  DataTableRowAction,
} from "@/lib/data-table-types";
import type { DataMode, Direction, FilterMode } from "@/lib/flag";

import { type Task, tasks } from "@/db/schema";
import { getColumnOptions } from "@/lib/data-table-parsers";
import { getErrorMessage } from "@/lib/error";
import { formatDate } from "@/lib/format";
import { DataTable } from "@/registry/bases/radix/components/data-table/data-table";
import { getDataTableActionsColumn } from "@/registry/bases/radix/components/data-table/data-table-actions-column";
import { DataTableAdvancedToolbar } from "@/registry/bases/radix/components/data-table/data-table-advanced-toolbar";
import { DataTableColumnHeader } from "@/registry/bases/radix/components/data-table/data-table-column-header";
import { DataTableCommandFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-command-filter-menu";
import { DataTableFilterMenu } from "@/registry/bases/radix/components/data-table/data-table-filter-menu";
import { getDataTableSelectColumn } from "@/registry/bases/radix/components/data-table/data-table-select-column";
import { DataTableSortMenu } from "@/registry/bases/radix/components/data-table/data-table-sort-menu";
import { DataTableToolbar } from "@/registry/bases/radix/components/data-table/data-table-toolbar";
import {
  useDataTable,
  type UseDataTableProps,
} from "@/registry/bases/radix/hooks/use-data-table";
import { Badge } from "@/registry/bases/radix/ui/badge";
import { DirectionProvider } from "@/registry/bases/radix/ui/direction";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";

import type {
  getEstimatedHoursRange,
  getTaskPriorityCounts,
  getTasks,
  getTaskStatusCounts,
} from "../lib/queries";

import { updateTask } from "../lib/actions";
import { getPriorityIcon, getStatusIcon } from "../lib/utils";
import { tasksColumnConfigs, tasksDefaultSorting } from "../lib/validations";
import { DeleteTasksDialog } from "./delete-tasks-dialog";
import { TasksTableActionBar } from "./tasks-table-action-bar";
import { UpdateTaskSheet } from "./update-task-sheet";

const columnHelper = createColumnHelper<DataTableFeatures, Task>();

interface TasksTableProps {
  dataMode: DataMode;
  dir: Direction;
  filterMode: FilterMode;
  promises: Promise<
    [
      Awaited<ReturnType<typeof getTasks>>,
      Awaited<ReturnType<typeof getTaskStatusCounts>>,
      Awaited<ReturnType<typeof getTaskPriorityCounts>>,
      Awaited<ReturnType<typeof getEstimatedHoursRange>>,
    ]
  >;
  queryKeys?: Partial<DataTableQueryKeys>;
}

export function TasksTable({
  dataMode,
  dir,
  filterMode,
  promises,
  queryKeys,
}: TasksTableProps) {
  const enableAdvancedFilter = filterMode !== "plain";

  const [
    { data, pageCount },
    statusCounts,
    priorityCounts,
    estimatedHoursRange,
  ] = React.use(promises);

  const [rowAction, setRowAction] =
    React.useState<DataTableRowAction<Task> | null>(null);

  const countsKey = JSON.stringify([
    statusCounts,
    priorityCounts,
    estimatedHoursRange,
  ]);

  const columns = React.useMemo(
    () =>
      columnHelper.columns([
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
              (option) => option === row.original.label,
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
            filter: tasksColumnConfigs.estimatedHours.filter,
            min: estimatedHoursRange.min,
            max: estimatedHoursRange.max,
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
            filter: tasksColumnConfigs.createdAt.filter,
            icon: CalendarIcon,
          },
          ...getColumnOptions(tasksColumnConfigs.createdAt),
        }),
        getDataTableActionsColumn<Task>({
          actions: ({ row }) => (
            <TaskActions row={row} setRowAction={setRowAction} />
          ),
          getAriaLabel: (row) => `Open actions for ${row.original.code}`,
        }),
      ]),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `countsKey` rebuilds the columns only when the counts change by value
    [countsKey],
  );

  const tableProps: Omit<UseDataTableProps<Task>, "mode" | "pageCount"> = {
    data,
    columns,
    initialState: {
      sorting: tasksDefaultSorting,
      columnPinning: { start: ["select"], end: ["actions"] },
    },
    queryKeys,
    getRowId: (originalRow) => originalRow.id,
    shallow: false,
    clearOnDefault: true,
    enableRowRangeSelection: true,
  };

  const { table } = useDataTable(
    dataMode === "client"
      ? { ...tableProps, mode: "client" }
      : { ...tableProps, pageCount },
  );

  return (
    <DirectionProvider dir={dir}>
      <DataTable
        aria-label="Tasks"
        table={table}
        actionBar={<TasksTableActionBar table={table} />}
      >
        {enableAdvancedFilter ? (
          <DataTableAdvancedToolbar table={table}>
            <DataTableSortMenu table={table} align="start" />
            {filterMode === "advanced" ? (
              <DataTableFilterMenu table={table} align="start" />
            ) : (
              <DataTableCommandFilterMenu table={table} align="start" />
            )}
          </DataTableAdvancedToolbar>
        ) : (
          <DataTableToolbar table={table}>
            <DataTableSortMenu table={table} align="end" />
          </DataTableToolbar>
        )}
      </DataTable>
      <UpdateTaskSheet
        open={rowAction?.variant === "update"}
        onOpenChange={() => setRowAction(null)}
        task={rowAction?.row.original ?? null}
      />
      <DeleteTasksDialog
        open={rowAction?.variant === "delete"}
        onOpenChange={() => setRowAction(null)}
        tasks={rowAction ? [rowAction.row.original] : []}
        showTrigger={false}
        onSuccess={() => rowAction?.row.toggleSelected(false)}
      />
    </DirectionProvider>
  );
}

interface TaskActionsProps {
  row: Row<DataTableFeatures, Task>;
  setRowAction: React.Dispatch<
    React.SetStateAction<DataTableRowAction<Task> | null>
  >;
}

function TaskActions({ row, setRowAction }: TaskActionsProps) {
  const [isUpdatePending, startUpdateTransition] = React.useTransition();

  return (
    <>
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
    </>
  );
}
