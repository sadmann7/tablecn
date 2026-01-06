"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { CheckCircle2, Palette, Trash2, X } from "lucide-react";
import * as React from "react";
import { use } from "react";
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
import { getDataGridSelectColumn } from "@/components/data-grid/data-grid-select-column";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { skaters } from "@/db/schema";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import {
  type UndoRedoCellUpdate,
  useDataGridUndoRedo,
} from "@/hooks/use-data-grid-undo-redo";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { generateId } from "@/lib/id";
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
  use(skatersCollection.preload());

  const windowSize = useWindowSize();
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { data = [] } = useLiveQuery(
    (q) => {
      let query = q.from({ skater: skatersCollection });

      // Apply user-specified sorting first (primary)
      for (const sort of sorting) {
        const field = sort.id as keyof SkaterSchema;
        const direction = sort.desc ? "desc" : "asc";
        query = query.orderBy((t) => t.skater[field], direction);
      }

      // Always sort by order as implicit default / tiebreaker
      query = query.orderBy((t) => t.skater.order, "asc");

      return query;
    },
    [sorting],
  );

  const { startUpload } = useUploadThing("skaterMedia");

  const filterFn = React.useMemo(() => getFilterFn<SkaterSchema>(), []);

  const columns = React.useMemo<ColumnDef<SkaterSchema>[]>(
    () => [
      getDataGridSelectColumn<SkaterSchema>({ enableRowMarkers: true }),
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

  // Undo/redo support - wraps data changes to track history
  // and allows reverting changes via keyboard shortcuts
  const undoRedoOnDataChange = React.useCallback(
    (newData: SkaterSchema[]) => {
      const currentIds = new Set(data.map((s) => s.id));
      const newIds = new Set(newData.map((s) => s.id));

      // Delete rows that exist in current but not in new (undo add / redo delete)
      for (const skater of data) {
        if (!newIds.has(skater.id)) {
          skatersCollection.delete(skater.id);
        }
      }

      // Insert or update rows
      for (const skater of newData) {
        if (!currentIds.has(skater.id)) {
          // Insert new row (undo delete / redo add)
          skatersCollection.insert(skater);
        } else {
          // Update existing row
          const existingSkater = data.find((s) => s.id === skater.id);
          if (!existingSkater) continue;

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
      }
    },
    [data],
  );

  const { trackCellsUpdate, trackRowsAdd, trackRowsDelete } =
    useDataGridUndoRedo({
      data,
      onDataChange: undoRedoOnDataChange,
      getRowId: (row) => row.id,
    });

  const onDataChange: NonNullable<
    UseDataGridProps<SkaterSchema>["onDataChange"]
  > = React.useCallback(
    (newData) => {
      // Track cell updates for undo/redo
      const cellUpdates: Array<UndoRedoCellUpdate> = [];

      // Diff and update changed skaters via TanStack DB for optimistic updates
      for (const skater of newData) {
        const existingSkater = data.find((s) => s.id === skater.id);
        const rowIndex = data.findIndex((s) => s.id === skater.id);

        // For new rows (not yet in our stale closure data), still update them
        // because onRowsAdd already created them in the collection
        if (!existingSkater) {
          skatersCollection.update(skater.id, (draft) => {
            Object.assign(draft, skater);
          });
          continue;
        }

        // Check if any field changed using JSON comparison for arrays/objects
        for (const key of Object.keys(skater) as Array<keyof SkaterSchema>) {
          const existingValue =
            existingSkater[key] instanceof Date
              ? (existingSkater[key] as Date).toISOString()
              : existingSkater[key];
          const newValue =
            skater[key] instanceof Date
              ? (skater[key] as Date).toISOString()
              : skater[key];

          if (JSON.stringify(existingValue) !== JSON.stringify(newValue)) {
            cellUpdates.push({
              rowIndex,
              columnId: key,
              previousValue: existingSkater[key],
              newValue: skater[key],
            });

            skatersCollection.update(skater.id, (draft) => {
              (draft as Record<string, unknown>)[key] = skater[key];
            });
          }
        }
      }

      // Track cell updates if there are any
      if (cellUpdates.length > 0) {
        trackCellsUpdate(cellUpdates);
      }
    },
    [data, trackCellsUpdate],
  );

  const onRowAdd: NonNullable<UseDataGridProps<SkaterSchema>["onRowAdd"]> =
    React.useCallback(() => {
      const maxOrder = data.reduce((max, s) => Math.max(max, s.order), 0);
      const newSkater = generateRandomSkater();
      const skaterWithOrder = { ...newSkater, order: maxOrder + 1 };

      skatersCollection.insert(skaterWithOrder);

      // Track for undo/redo
      trackRowsAdd({ startIndex: data.length, rows: [skaterWithOrder] });

      return {
        rowIndex: data.length,
        columnId: "name",
      };
    }, [data, trackRowsAdd]);

  const onRowsAdd: NonNullable<UseDataGridProps<SkaterSchema>["onRowsAdd"]> =
    React.useCallback(
      (count: number) => {
        const maxOrder = data.reduce((max, s) => Math.max(max, s.order), 0);
        const newRows: SkaterSchema[] = [];

        for (let i = 0; i < count; i++) {
          const newSkater: SkaterSchema = {
            id: generateId(),
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
            order: maxOrder + i + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          newRows.push(newSkater);
          skatersCollection.insert(newSkater);
        }

        // Track for undo/redo
        trackRowsAdd({ startIndex: data.length, rows: newRows });
      },
      [data, trackRowsAdd],
    );

  const onRowsDelete: NonNullable<
    UseDataGridProps<SkaterSchema>["onRowsDelete"]
  > = React.useCallback(
    (rowsToDelete, rowIndices) => {
      // Track for undo/redo (before deletion to capture the rows)
      trackRowsDelete({ indices: rowIndices, rows: rowsToDelete });

      // Use batch delete - single transaction for all deletions
      skatersCollection.delete(rowsToDelete.map((skater) => skater.id));
    },
    [trackRowsDelete],
  );

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

  const { table, tableMeta, ...dataGridProps } = useDataGrid({
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
    onSortingChange: setSorting,
    manualSorting: true,
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

    const rowIndices = selectedRows.map((row) => row.index);

    tableMeta.onRowsDelete?.(rowIndices);

    toast.success(
      `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} deleted`,
    );
    table.toggleAllRowsSelected(false);
  }, [table, tableMeta]);

  const height = Math.max(400, windowSize.height - 150);
  const selectedCellCount = tableMeta.selectionState?.selectedCells.size ?? 0;

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 self-end"
      >
        <DataGridKeyboardShortcuts enableUndoRedo />
        <DataGridFilterMenu table={table} align="end" />
        <DataGridSortMenu table={table} align="end" />
        <DataGridRowHeightMenu table={table} align="end" />
        <DataGridViewMenu table={table} align="end" />
      </div>
      <DataGrid
        {...dataGridProps}
        table={table}
        tableMeta={tableMeta}
        height={height}
      />
      <ActionBar
        data-grid-popover
        open={selectedCellCount > 0}
        onOpenChange={(open) => {
          if (!open) {
            table.toggleAllRowsSelected(false);
            tableMeta.onSelectionClear?.();
          }
        }}
      >
        <ActionBarSelection>
          <span className="font-medium">{selectedCellCount}</span>
          <span>{selectedCellCount === 1 ? "cell" : "cells"} selected</span>
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
                <Palette />
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
