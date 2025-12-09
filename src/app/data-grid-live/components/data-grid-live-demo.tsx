"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUp, CheckCircle2, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { tasksCollection } from "@/app/data-grid-live/lib/collections";
import {
  generateRandomTask,
  getLabelIcon,
  getPriorityIcon,
  getStatusIcon,
} from "@/app/lib/utils";
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
import { useUploadThing } from "@/lib/uploadthing";
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

const labelOptions = tasks.label.enumValues.map((label) => ({
  label: label.charAt(0).toUpperCase() + label.slice(1),
  value: label,
  icon: getLabelIcon(label),
}));

const tagOptions = [
  "frontend",
  "backend",
  "api",
  "database",
  "ui",
  "ux",
  "performance",
  "security",
  "testing",
  "deployment",
] as const;

const tagSelectOptions = tagOptions.map((tag) => ({
  label: tag.charAt(0).toUpperCase() + tag.slice(1),
  value: tag,
}));

export function DataGridLiveDemo() {
  const { height } = useWindowSize();

  const { data = [], isLoading } = useLiveQuery((q) =>
    q.from({ task: tasksCollection }),
  );

  const { startUpload } = useUploadThing("taskAttachment");

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
            options: statusOptions,
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
            options: priorityOptions,
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
            options: labelOptions,
          },
        },
      },
      {
        id: "tags",
        accessorKey: "tags",
        header: "Tags",
        minSize: 240,
        filterFn,
        meta: {
          label: "Tags",
          cell: {
            variant: "multi-select",
            options: tagSelectOptions,
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
        id: "files",
        accessorKey: "files",
        header: "Files",
        minSize: 240,
        filterFn,
        meta: {
          label: "Files",
          cell: {
            variant: "file",
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            accept:
              "image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
            multiple: true,
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
        const existingTask = data.find((t) => t.id === task.id);
        if (!existingTask) continue;

        // Check if any field changed using JSON comparison for arrays/objects
        const hasChanges = (Object.keys(task) as Array<keyof TaskSchema>).some(
          (key) => {
            const existingValue =
              existingTask[key] instanceof Date
                ? (existingTask[key] as Date).toISOString()
                : existingTask[key];
            const newValue =
              task[key] instanceof Date
                ? (task[key] as Date).toISOString()
                : task[key];

            return JSON.stringify(existingValue) !== JSON.stringify(newValue);
          },
        );

        if (hasChanges) {
          tasksCollection.update(task.id, (draft) => {
            Object.assign(draft, task);
          });
        }
      }
    },
    [data],
  );

  const onRowAdd: NonNullable<UseDataGridProps<TaskSchema>["onRowAdd"]> =
    React.useCallback(() => {
      tasksCollection.insert(
        generateRandomTask({
          title: "",
        }),
      );

      return {
        rowIndex: data.length,
        columnId: "title",
      };
    }, [data.length]);

  const onRowsAdd: NonNullable<UseDataGridProps<TaskSchema>["onRowsAdd"]> =
    React.useCallback(
      (count: number) => {
        for (let i = 0; i < count; i++) {
          const id = crypto.randomUUID();
          const code = `TASK-${String(data.length + i + 1).padStart(4, "0")}`;

          tasksCollection.insert({
            id,
            code,
            title: null,
            status: "todo",
            label: "feature",
            priority: "medium",
            estimatedHours: 0,
            archived: false,
            tags: null,
            files: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      },
      [data.length],
    );

  const onRowsDelete: NonNullable<
    UseDataGridProps<TaskSchema>["onRowsDelete"]
  > = React.useCallback((rowsToDelete) => {
    // Use batch delete - single transaction for all deletions
    tasksCollection.delete(rowsToDelete.map((task) => task.id));
  }, []);

  const onFilesUpload: NonNullable<
    UseDataGridProps<TaskSchema>["onFilesUpload"]
  > = React.useCallback(
    async ({ files }) => {
      // Try to upload via UploadThing, fall back to simulation if not configured
      try {
        const uploadedFiles = await startUpload(files);

        if (uploadedFiles) {
          return uploadedFiles.map((file) => ({
            id: file.key,
            name: file.name,
            size: file.size,
            type: file.type,
            url: file.ufsUrl,
          }));
        }
      } catch {
        // UploadThing not configured, fall back to simulation
      }

      // Simulate upload for demo/development without UploadThing
      await new Promise((resolve) => setTimeout(resolve, 800));

      return files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }));
    },
    [startUpload],
  );

  const onFilesDelete: NonNullable<
    UseDataGridProps<TaskSchema>["onFilesDelete"]
  > = React.useCallback(async ({ fileIds }) => {
    try {
      await fetch("/api/uploadthing/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKeys: fileIds }),
      });
    } catch {
      // UploadThing not configured or delete failed, ignore
    }
  }, []);

  const { table, ...dataGridProps } = useDataGrid({
    data,
    onDataChange,
    onRowAdd,
    onRowsAdd,
    onRowsDelete,
    onFilesUpload,
    onFilesDelete,
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

      // Use batch update - single transaction for all updates
      tasksCollection.update(
        selectedRows.map((row) => row.original.id),
        (drafts) => {
          for (const draft of drafts) {
            draft[field] = value as never;
          }
        },
      );

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

    // Use batch delete - single transaction for all deletions
    tasksCollection.delete(selectedRows.map((row) => row.original.id));

    toast.success(
      `${selectedRows.length} task${selectedRows.length === 1 ? "" : "s"} deleted`,
    );
    table.toggleAllRowsSelected(false);
  }, [table]);

  const gridHeight = height ? Math.min(height - 170, 800) : 600;

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
            <DropdownMenuContent data-grid-popover>
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
            <DropdownMenuContent data-grid-popover>
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
