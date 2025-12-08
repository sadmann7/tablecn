"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { toast } from "sonner";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Toggle } from "@/components/ui/toggle";
import { useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";
import { tasksCollection } from "@/lib/collections";
import { getFilterFn } from "@/lib/data-grid-filters";
import type { TaskSchema } from "@/lib/task-schema";
import type { Direction } from "@/types/data-grid";

// Data grid options that will be passed to useDataGrid
const dataGridOptions = {
  enableColumnResizing: true,
  columnResizeMode: "onChange" as const,
  columnResizeDirection: "ltr" as const,
};

export function DataGridTasksDemo() {
  const { height } = useWindowSize();
  const [direction, setDirection] = React.useState<Direction>("ltr");

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
        id: "code",
        accessorKey: "code",
        header: "Code",
        minSize: 120,
        filterFn,
        meta: {
          label: "Code",
          cell: {
            variant: "short-text",
          },
        },
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

  // Handle data changes through TanStack DB
  const onDataChange = React.useCallback(
    (updater: TaskSchema[] | ((prev: TaskSchema[]) => TaskSchema[])) => {
      const newData = typeof updater === "function" ? updater(tasks) : updater;

      // Diff and update changed tasks via TanStack DB for optimistic updates
      for (const task of newData) {
        const existingTask = tasks.find((t) => t.id === task.id);
        if (
          existingTask &&
          JSON.stringify(existingTask) !== JSON.stringify(task)
        ) {
          tasksCollection.update(task.id, () => task);
        }
      }
    },
    [tasks],
  );

  const { table, ...dataGridProps } = useDataGrid({
    ...dataGridOptions,
    data: tasks,
    columns,
    getRowId: (row) => row.id,
    onDataChange,
    initialState: {
      columnPinning: {
        left: ["select"],
      },
    },
    enableSearch: true,
    enablePaste: true,
  });

  // Update a task with optimistic mutation
  const updateTaskStatus = React.useCallback(
    (taskId: string, status: TaskSchema["status"]) => {
      tasksCollection.update(taskId, (draft) => {
        draft.status = status;
      });
      toast.success("Task updated");
    },
    [],
  );

  // Update task priority with optimistic mutation
  const updateTaskPriority = React.useCallback(
    (taskId: string, priority: TaskSchema["priority"]) => {
      tasksCollection.update(taskId, (draft) => {
        draft.priority = priority;
      });
      toast.success("Task priority updated");
    },
    [],
  );

  const gridHeight = height ? Math.min(height - 200, 800) : 600;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  console.log({ tasks });

  return (
    <DirectionProvider dir={direction}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-2xl">Tasks with TanStack DB</h2>
            <p className="text-muted-foreground text-sm">
              Real-time data grid powered by TanStack DB + Drizzle ORM with
              optimistic updates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DataGridKeyboardShortcuts />
            <DataGridViewMenu table={table} align="end" />
            <DataGridFilterMenu table={table} align="end" />
            <DataGridSortMenu table={table} align="end" />
            <DataGridRowHeightMenu table={table} align="end" />
            <Toggle
              variant="outline"
              aria-label="Toggle direction"
              pressed={direction === "rtl"}
              onPressedChange={(pressed) =>
                setDirection(pressed ? "rtl" : "ltr")
              }
            >
              RTL
            </Toggle>
          </div>
        </div>

        <div className="rounded-lg border">
          <DataGrid {...dataGridProps} table={table} height={gridHeight} />
        </div>

        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="flex items-center gap-1">
            <span className="font-medium">{tasks.length}</span>
            <span>total tasks</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <span className="font-medium">
              {table.getFilteredRowModel().rows.length}
            </span>
            <span>filtered</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <span className="font-medium">
              {table.getSelectedRowModel().rows.length}
            </span>
            <span>selected</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Quick Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selected = table.getSelectedRowModel().rows;
                if (selected.length === 0) {
                  toast.error("No tasks selected");
                  return;
                }
                for (const row of selected) {
                  updateTaskStatus(row.original.id, "done");
                }
              }}
            >
              Mark Selected as Done
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selected = table.getSelectedRowModel().rows;
                if (selected.length === 0) {
                  toast.error("No tasks selected");
                  return;
                }
                for (const row of selected) {
                  updateTaskStatus(row.original.id, "in-progress");
                }
              }}
            >
              Mark Selected as In Progress
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selected = table.getSelectedRowModel().rows;
                if (selected.length === 0) {
                  toast.error("No tasks selected");
                  return;
                }
                for (const row of selected) {
                  updateTaskPriority(row.original.id, "high");
                }
              }}
            >
              Set Selected to High Priority
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const selected = table.getSelectedRowModel().rows;
                if (selected.length === 0) {
                  toast.error("No tasks selected");
                  return;
                }
                for (const row of selected) {
                  tasksCollection.delete(row.original.id);
                }
                toast.success(`${selected.length} tasks deleted`);
              }}
            >
              Delete Selected
            </Button>
          </div>
        </div>
      </div>
    </DirectionProvider>
  );
}
