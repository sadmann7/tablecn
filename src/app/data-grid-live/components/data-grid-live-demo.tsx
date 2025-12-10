"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { CheckCircle2, Sparkles, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { skatersCollection } from "@/app/data-grid-live/lib/collections";
import {
  generateRandomSkater,
  getSkaterStatusIcon,
  getStanceIcon,
  getStyleIcon,
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
import { skaters } from "@/db/schema";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { useUploadThing } from "@/lib/uploadthing";
import type { SkaterSchema } from "../lib/validation";

const stanceOptions = skaters.stance.enumValues.map((stance) => ({
  label: stance.charAt(0).toUpperCase() + stance.slice(1),
  value: stance,
  icon: getStanceIcon(stance),
}));

const styleOptions = skaters.style.enumValues.map((style) => ({
  label: style.charAt(0).toUpperCase() + style.slice(1).replace("-", " "),
  value: style,
  icon: getStyleIcon(style),
}));

const statusOptions = skaters.status.enumValues.map((status) => ({
  label: status.charAt(0).toUpperCase() + status.slice(1),
  value: status,
  icon: getSkaterStatusIcon(status),
}));

const trickOptions = [
  "Kickflip",
  "Heelflip",
  "Tre Flip",
  "Hardflip",
  "Varial Flip",
  "360 Flip",
  "Ollie",
  "Nollie",
  "Pop Shove-it",
  "FS Boardslide",
  "BS Boardslide",
  "50-50 Grind",
  "5-0 Grind",
  "Crooked Grind",
  "Smith Grind",
] as const;

const trickSelectOptions = trickOptions.map((trick) => ({
  label: trick,
  value: trick,
}));

export function DataGridLiveDemo() {
  const windowSize = useWindowSize();
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "createdAt", desc: false },
  ]);

  const { data = [] } = useLiveQuery(
    (q) => {
      let query = q.from({ skater: skatersCollection });

      if (sorting.length > 0) {
        for (const sort of sorting) {
          const field = sort.id as keyof SkaterSchema;
          const direction = sort.desc ? "desc" : "asc";
          query = query.orderBy((t) => t.skater[field], direction);
        }
      } else {
        query = query.orderBy((t) => t.skater.createdAt, "asc");
      }

      return query;
    },
    [sorting],
  );

  const { startUpload } = useUploadThing("skaterMedia");

  const filterFn = React.useMemo(() => getFilterFn<SkaterSchema>(), []);

  const columns = React.useMemo<ColumnDef<SkaterSchema>[]>(
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
        id: "name",
        accessorKey: "name",
        header: "Name",
        minSize: 200,
        filterFn,
        meta: {
          label: "Name",
          cell: {
            variant: "short-text",
          },
        },
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        minSize: 250,
        filterFn,
        meta: {
          label: "Email",
          cell: {
            variant: "short-text",
          },
        },
      },
      {
        id: "stance",
        accessorKey: "stance",
        header: "Stance",
        minSize: 140,
        filterFn,
        meta: {
          label: "Stance",
          cell: {
            variant: "select",
            options: stanceOptions,
          },
        },
      },
      {
        id: "style",
        accessorKey: "style",
        header: "Style",
        minSize: 160,
        filterFn,
        meta: {
          label: "Style",
          cell: {
            variant: "select",
            options: styleOptions,
          },
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        minSize: 160,
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
        id: "tricks",
        accessorKey: "tricks",
        header: "Tricks",
        minSize: 240,
        filterFn,
        meta: {
          label: "Tricks",
          cell: {
            variant: "multi-select",
            options: trickSelectOptions,
          },
        },
      },
      {
        id: "yearsSkating",
        accessorKey: "yearsSkating",
        header: "Years Skating",
        minSize: 160,
        filterFn,
        meta: {
          label: "Years Skating",
          cell: {
            variant: "number",
            min: 0,
            max: 50,
            step: 1,
          },
        },
      },
      {
        id: "startedSkating",
        accessorKey: "startedSkating",
        header: "Skating Since",
        minSize: 170,
        filterFn,
        meta: {
          label: "Skating Since",
          cell: {
            variant: "date",
          },
        },
      },
      {
        id: "createdAt",
        accessorKey: "createdAt",
        header: "Date Added",
        minSize: 170,
        filterFn,
        meta: {
          label: "Date Added",
          cell: {
            variant: "date",
          },
        },
      },
      {
        id: "isPro",
        accessorKey: "isPro",
        header: "Pro",
        minSize: 90,
        filterFn,
        meta: {
          label: "Pro",
          cell: {
            variant: "checkbox",
          },
        },
      },
      {
        id: "media",
        accessorKey: "media",
        header: "Media",
        minSize: 240,
        filterFn,
        meta: {
          label: "Media",
          cell: {
            variant: "file",
            maxFileSize: 10 * 1024 * 1024,
            maxFiles: 5,
            accept: "image/*,pdf/*,audio/*,video/*",
            multiple: true,
          },
        },
      },
    ],
    [filterFn],
  );

  const onDataChange: NonNullable<
    UseDataGridProps<SkaterSchema>["onDataChange"]
  > = React.useCallback(
    (newData) => {
      // Diff and update changed skaters via TanStack DB for optimistic updates
      for (const skater of newData) {
        const existingSkater = data.find((s) => s.id === skater.id);
        if (!existingSkater) continue;

        // Check if any field changed using JSON comparison for arrays/objects
        const hasChanges = (
          Object.keys(skater) as Array<keyof SkaterSchema>
        ).some((key) => {
          const existingValue =
            existingSkater[key] instanceof Date
              ? (existingSkater[key] as Date).toISOString()
              : existingSkater[key];
          const newValue =
            skater[key] instanceof Date
              ? (skater[key] as Date).toISOString()
              : skater[key];

          return JSON.stringify(existingValue) !== JSON.stringify(newValue);
        });

        if (hasChanges) {
          skatersCollection.update(skater.id, (draft) => {
            Object.assign(draft, skater);
          });
        }
      }
    },
    [data],
  );

  const onRowAdd: NonNullable<UseDataGridProps<SkaterSchema>["onRowAdd"]> =
    React.useCallback(() => {
      skatersCollection.insert(generateRandomSkater());

      return {
        rowIndex: data.length,
        columnId: "name",
      };
    }, [data.length]);

  const onRowsAdd: NonNullable<UseDataGridProps<SkaterSchema>["onRowsAdd"]> =
    React.useCallback((count: number) => {
      for (let i = 0; i < count; i++) {
        skatersCollection.insert({
          id: crypto.randomUUID(),
          name: null,
          email: null,
          stance: "regular",
          style: "street",
          status: "amateur",
          yearsSkating: 0,
          startedSkating: null,
          isPro: false,
          tricks: null,
          media: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }, []);

  const onRowsDelete: NonNullable<
    UseDataGridProps<SkaterSchema>["onRowsDelete"]
  > = React.useCallback((rowsToDelete) => {
    // Use batch delete - single transaction for all deletions
    skatersCollection.delete(rowsToDelete.map((skater) => skater.id));
  }, []);

  const onFilesUpload: NonNullable<
    UseDataGridProps<SkaterSchema>["onFilesUpload"]
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
    UseDataGridProps<SkaterSchema>["onFilesDelete"]
  > = React.useCallback(async ({ fileIds }) => {
    // Try to delete from UploadThing, silently fail if not configured
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
      sorting,
    },
    manualSorting: true,
    onSortingChange: setSorting,
    enableSearch: true,
    enablePaste: true,
  });

  const updateSelectedSkaters = React.useCallback(
    (
      field: "status" | "style",
      value: SkaterSchema["status"] | SkaterSchema["style"],
    ) => {
      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        toast.error("No skaters selected");
        return;
      }

      // Use batch update - single transaction for all updates
      skatersCollection.update(
        selectedRows.map((row) => row.original.id),
        (drafts) => {
          for (const draft of drafts) {
            draft[field] = value as never;
          }
        },
      );

      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table],
  );

  const deleteSelectedSkaters = React.useCallback(() => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("No skaters selected");
      return;
    }

    // Use batch delete - single transaction for all deletions
    skatersCollection.delete(selectedRows.map((row) => row.original.id));

    toast.success(
      `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} deleted`,
    );
    table.toggleAllRowsSelected(false);
  }, [table]);

  const height = Math.max(400, windowSize.height - 150);

  return (
    <div className="container flex flex-col gap-4 py-4">
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
      <DataGrid {...dataGridProps} table={table} height={height} />
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
                  onClick={() => updateSelectedSkaters("status", option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionBarItem variant="secondary" size="sm">
                <Sparkles />
                Style
              </ActionBarItem>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-grid-popover>
              {styleOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => updateSelectedSkaters("style", option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ActionBarItem
            variant="destructive"
            size="sm"
            onClick={deleteSelectedSkaters}
          >
            <Trash2 />
            Delete
          </ActionBarItem>
        </ActionBarGroup>
      </ActionBar>
    </div>
  );
}
