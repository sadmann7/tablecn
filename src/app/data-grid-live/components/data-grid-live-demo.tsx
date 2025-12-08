"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUp, CheckCircle2, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { tasksCollection } from "@/app/data-grid-live/lib/collections";
import { getPriorityIcon, getStatusIcon } from "@/app/lib/utils";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import {
  ActionBar,
  ActionBarClose,
  ActionBarGroup,
  ActionBarItem,
  ActionBarSelection,
  ActionBarSeparator,
} from "@/components/ui/action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tasks } from "@/db/schema";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import type { TaskSchema } from "../lib/validation";

const statusOptions = tasks.status.enumValues.map((status) => ({
  label: status.charAt(0).toUpperCase() + status.slice(1),
  value: status,
  icon: getStatusIcon(status),
}));

const priorityOptions = tasks.priority.enumValues.map((priority) => ({
  label: priority.charAt(0).toUpperCase() + priority.slice(1),
  value: priority,
  icon: getPriorityIcon(priority),
}));

export function DataGridLiveDemo() {
  const { height } = useWindowSize();

  const { data: tasks = [], isLoading } = useLiveQuery((q) =>
    q.from({ task: tasksCollection }),
  );

  const filterFn = React.useMemo(() => getFilterFn<TaskSchema>(), []);

  const columns = React.useMemo<ColumnDef<TaskSchema>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all"
            className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row, table }) => (
          <Checkbox
            aria-label="Select row"
            className="after:-inset-2.5 relative transition-[shadow,border] after:absolute after:content-[''] hover:border-primary/40"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => {
              const onRowSelect = table.options.meta?.onRowSelect;
              if (onRowSelect) {
                onRowSelect(row.index, !!value, false);
              } else {
                row.toggleSelected(!!value);
              }
            }}
            onClick={(event: React.MouseEvent) => {
              if (event.shiftKey) {
                event.preventDefault();
                const onRowSelect = table.options.meta?.onRowSelect;
                if (onRowSelect) {
                  onRowSelect(row.index, !row.getIsSelected(), true);
                }
              }
            }}
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
      },
      {
        id: "title",
        accessorKey: "title",
        header: "Title",
        minSize: 250,
        filterFn,
        meta: {
          label: "Title",
          cell: {
            variant: "short-text",
          },
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        minSize: 180,
        filterFn,
        meta: {
          label: "Status",
          cell: {
            variant: "select",
            options: [
              { label: "Todo", value: "todo" },
              { label: "In Progress", value: "in-progress" },
              { label: "Done", value: "done" },
              { label: "Canceled", value: "canceled" },
            ],
          },
        },
      },
      {
        id: "priority",
        accessorKey: "priority",
        header: "Priority",
        minSize: 160,
        filterFn,
        meta: {
          label: "Priority",
          cell: {
            variant: "select",
            options: [
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
            ],
          },
        },
      },
      {
        id: "label",
        accessorKey: "label",
        header: "Label",
        minSize: 180,
        filterFn,
        meta: {
          label: "Label",
          cell: {
            variant: "select",
            options: [
              { label: "Bug", value: "bug" },
              { label: "Feature", value: "feature" },
              { label: "Enhancement", value: "enhancement" },
              { label: "Documentation", value: "documentation" },
            ],
          },
        },
      },
      {
        id: "estimatedHours",
        accessorKey: "estimatedHours",
        header: "Est. Hours",
        minSize: 140,
        filterFn,
        meta: {
          label: "Estimated Hours",
          cell: {
            variant: "number",
            min: 0,
            max: 1000,
            step: 0.5,
          },
        },
      },
      {
        id: "archived",
        accessorKey: "archived",
        header: "Archived",
        minSize: 120,
        filterFn,
        meta: {
          label: "Archived",
          cell: {
            variant: "checkbox",
          },
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Created",
        minSize: 150,
        filterFn,
        meta: {
          label: "Created At",
          cell: {
            variant: "date",
          },
        },
      },
    ],
    [filterFn],
  );

  const onDataChange: NonNullable<
    UseDataGridProps<TaskSchema>["onDataChange"]
  > = React.useCallback(
    (newData) => {
      // Diff and update changed tasks via TanStack DB for optimistic updates
      for (const task of newData) {
        const existingTask = tasks.find((t) => t.id === task.id);
        if (existingTask) {
          // Find the specific fields that changed
          let hasChanges = false;
          for (const key of Object.keys(task) as Array<keyof TaskSchema>) {
            // Skip comparing Date objects by converting to ISO strings
            const existingValue =
              existingTask[key] instanceof Date
                ? (existingTask[key] as Date).toISOString()
                : existingTask[key];
            const newValue =
              task[key] instanceof Date
                ? (task[key] as Date).toISOString()
                : task[key];

            if (existingValue !== newValue) {
              hasChanges = true;
              break;
            }
          }

          if (hasChanges) {
            // Update with the new task data
            tasksCollection.update(task.id, (draft) => {
              Object.assign(draft, task);
            });
          }
        }
      }
    },
    [tasks],
  );

  const onRowAdd: NonNullable<UseDataGridProps<TaskSchema>["onRowAdd"]> =
    React.useCallback(() => {
      const id = crypto.randomUUID();
      const code = `TASK-${String(tasks.length + 1).padStart(4, "0")}`;

      tasksCollection.insert({
        id,
        code,
        title: null,
        status: "todo",
        label: "feature",
        priority: "medium",
        estimatedHours: 0,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        rowIndex: tasks.length,
        columnId: "title",
      };
    }, [tasks.length]);

  const onRowsAdd: NonNullable<UseDataGridProps<TaskSchema>["onRowsAdd"]> =
    React.useCallback(
      (count: number) => {
        for (let i = 0; i < count; i++) {
          const id = crypto.randomUUID();
          const code = `TASK-${String(tasks.length + i + 1).padStart(4, "0")}`;

          tasksCollection.insert({
            id,
            code,
            title: null,
            status: "todo",
            label: "feature",
            priority: "medium",
            estimatedHours: 0,
            archived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      },
      [tasks.length],
    );

  const onRowsDelete: NonNullable<
    UseDataGridProps<TaskSchema>["onRowsDelete"]
  > = React.useCallback((rowsToDelete) => {
    for (const task of rowsToDelete) {
      tasksCollection.delete(task.id);
    }
  }, []);

  const { table, ...dataGridProps } = useDataGrid({
    data: tasks,
    onDataChange,
    onRowAdd,
    onRowsAdd,
    onRowsDelete,
    columns,
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: {
        left: ["select"],
      },
    },
    enableSearch: true,
    enablePaste: true,
  });

  const updateSelectedTasks = React.useCallback(
    (
      field: "status" | "priority",
      value: TaskSchema["status"] | TaskSchema["priority"],
    ) => {
      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        toast.error("No tasks selected");
        return;
      }

      for (const row of selectedRows) {
        tasksCollection.update(row.original.id, (draft) => {
          draft[field] = value as never;
        });
      }

      toast.success(
        `${selectedRows.length} task${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table],
  );

  const deleteSelectedTasks = React.useCallback(() => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("No tasks selected");
      return;
    }

    for (const row of selectedRows) {
      tasksCollection.delete(row.original.id);
    }

    toast.success(
      `${selectedRows.length} task${selectedRows.length === 1 ? "" : "s"} deleted`,
    );
    table.toggleAllRowsSelected(false);
  }, [table]);

  const gridHeight = height ? Math.min(height - 200, 800) : 600;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 self-end"
      >
        <DataGridKeyboardShortcuts />
        <DataGridViewMenu table={table} align="end" />
        <DataGridFilterMenu table={table} align="end" />
        <DataGridSortMenu table={table} align="end" />
        <DataGridRowHeightMenu table={table} align="end" />
      </div>
      <DataGrid {...dataGridProps} table={table} height={gridHeight} />
      <ActionBar
        data-grid-popover
        open={table.getSelectedRowModel().rows.length > 0}
        onOpenChange={(open) => {
          if (!open) table.toggleAllRowsSelected(false);
        }}
      >
        <ActionBarSelection>
          <span className="font-medium">
            {table.getSelectedRowModel().rows.length}
          </span>
          <span>selected</span>
          <ActionBarSeparator />
          <ActionBarClose>
            <X />
          </ActionBarClose>
        </ActionBarSelection>
        <ActionBarSeparator />
        <ActionBarGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionBarItem variant="secondary" size="sm">
                <CheckCircle2 />
                Status
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover align="center">
              {statusOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => updateSelectedTasks("status", option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionBarItem variant="secondary" size="sm">
                <ArrowUp />
                Priority
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover align="center">
              {priorityOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => updateSelectedTasks("priority", option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ActionBarItem
            variant="destructive"
            size="sm"
            onClick={deleteSelectedTasks}
          >
            <Trash2 />
            Delete
          </ActionBarItem>
        </ActionBarGroup>
      </ActionBar>
    </div>
  );
}
