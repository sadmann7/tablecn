"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import { SelectTrigger } from "@radix-ui/react-select";
import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUp, CheckCircle2, Languages, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";
import { tasksCollection } from "@/lib/collections";
import { getFilterFn } from "@/lib/data-grid-filters";
import type { TaskSchema } from "@/lib/task-schema";
import { cn } from "@/lib/utils";
import type { Direction } from "@/types/data-grid";

const statusOptions = [
  { label: "Todo", value: "todo" },
  { label: "In Progress", value: "in-progress" },
  { label: "Done", value: "done" },
  { label: "Canceled", value: "canceled" },
] as const;

const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
] as const;

export function DataGridTasksDemo() {
  const { height } = useWindowSize();
  const [dir, setDir] = React.useState<Direction>("ltr");

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

  const { table, ...dataGridProps } = useDataGrid({
    data: tasks,
    onDataChange,
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
    <DirectionProvider dir={dir}>
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
          <Toggle
            aria-label="Toggle direction"
            variant="outline"
            size="sm"
            className="bg-background dark:bg-input/30 dark:hover:bg-input/50"
            pressed={dir === "rtl"}
            onPressedChange={(pressed) => setDir(pressed ? "rtl" : "ltr")}
          >
            <Languages className="text-muted-foreground" />
            {dir === "ltr" ? "LTR" : "RTL"}
          </Toggle>
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
            <Select
              onValueChange={(value: TaskSchema["status"]) =>
                updateSelectedTasks("status", value)
              }
            >
              <SelectTrigger asChild>
                <ActionBarItem variant="secondary" size="icon-sm">
                  <CheckCircle2 />
                </ActionBarItem>
              </SelectTrigger>
              <SelectContent data-grid-popover align="center">
                <SelectGroup>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value: TaskSchema["priority"]) =>
                updateSelectedTasks("priority", value)
              }
            >
              <SelectTrigger asChild>
                <ActionBarItem variant="secondary" size="icon-sm">
                  <ArrowUp />
                </ActionBarItem>
              </SelectTrigger>
              <SelectContent data-grid-popover align="center">
                <SelectGroup>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <ActionBarItem size="icon-sm" onClick={deleteSelectedTasks}>
              <Trash2 />
            </ActionBarItem>
          </ActionBarGroup>
        </ActionBar>
      </div>
    </DirectionProvider>
  );
}
