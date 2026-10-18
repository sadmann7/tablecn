"use client";

import type { ColumnDef, Row, SortingState } from "@tanstack/react-table";

import { useLiveQuery } from "@tanstack/react-db";
import { Copy, Trash2 } from "lucide-react";
import * as React from "react";
import { use } from "react";
import { toast } from "sonner";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import {
  getSkaterStatusIcon,
  getStanceIcon,
  getStyleIcon,
} from "@/app/lib/utils";
import { skaters } from "@/db/schema";
import {
  type UndoRedoCellUpdate,
  useDataGridUndoRedo,
} from "@/hooks/use-data-grid-undo-redo";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { generateId } from "@/lib/id";
import { useUploadThing } from "@/lib/uploadthing";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { getDataGridActionsColumn } from "@/registry/bases/radix/components/data-grid/data-grid-actions-column";
import { DataGridFilterMenu } from "@/registry/bases/radix/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/registry/bases/radix/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/registry/bases/radix/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/registry/bases/radix/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/registry/bases/radix/components/data-grid/data-grid-view-menu";
import {
  type UseDataGridProps,
  useDataGrid,
} from "@/registry/bases/radix/hooks/use-data-grid";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/registry/bases/radix/ui/dropdown-menu";

import type { SkaterSchema } from "../lib/validation";

import { skatersCollection } from "../lib/collections";
import { getInsertOrder } from "../lib/order";
import { SkatersGridActionBar } from "./skaters-grid-action-bar";

type SkaterRows = Array<Row<DataGridFeatures, SkaterSchema>>;

const TRICKS = [
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

const trickOptions = TRICKS.map((trick) => ({
  label: trick,
  value: trick,
}));

function getComparableValue(value: unknown) {
  return JSON.stringify(value instanceof Date ? value.toISOString() : value);
}

function getChangedKeys(previous: SkaterSchema, next: SkaterSchema) {
  return (Object.keys(next) as Array<keyof SkaterSchema>).filter(
    (key) =>
      getComparableValue(previous[key]) !== getComparableValue(next[key]),
  );
}

interface DataGridLiveDemoProps {
  isUploadConfigured: boolean;
}

export function DataGridLiveDemo({
  isUploadConfigured,
}: DataGridLiveDemoProps) {
  use(skatersCollection.preload());

  const windowSize = useWindowSize();
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { data } = useLiveQuery({
    query: (q) => {
      let query = q.from({ skater: skatersCollection });

      for (const sort of sorting) {
        const field = sort.id as keyof SkaterSchema;
        const direction = sort.desc ? "desc" : "asc";
        query = query.orderBy((t) => t.skater[field], direction);
      }

      // Always sort by order as implicit default / tiebreaker
      query = query.orderBy((t) => t.skater.order, "asc");

      return query;
    },
  });

  const { startUpload } = useUploadThing("skaterMedia");

  const filterFn = React.useMemo(() => getFilterFn<SkaterSchema>(), []);

  const undoRedoOnDataChange = React.useCallback(
    (newData: SkaterSchema[]) => {
      const currentById = new Map(data.map((skater) => [skater.id, skater]));
      const newIds = new Set(newData.map((skater) => skater.id));

      // Undo of an add, or redo of a delete
      const deletedIds = data
        .filter((skater) => !newIds.has(skater.id))
        .map((skater) => skater.id);
      // Undo of a delete, or redo of an add
      const inserted = newData.filter((skater) => !currentById.has(skater.id));
      const updated = newData.filter((skater) => {
        const existingSkater = currentById.get(skater.id);
        return (
          existingSkater !== undefined &&
          getChangedKeys(existingSkater, skater).length > 0
        );
      });

      if (deletedIds.length > 0) skatersCollection.delete(deletedIds);
      if (inserted.length > 0) skatersCollection.insert(inserted);
      if (updated.length > 0) {
        const updatedById = new Map(
          updated.map((skater) => [skater.id, skater]),
        );
        skatersCollection.update([...updatedById.keys()], (drafts) => {
          for (const draft of drafts) {
            Object.assign(draft, updatedById.get(draft.id));
          }
        });
      }
    },
    [data],
  );

  const { trackCellsUpdate, trackRowsAdd, trackRowsDelete } =
    useDataGridUndoRedo<SkaterSchema>({
      data,
      onDataChange: undoRedoOnDataChange,
      getRowId: (row) => row.id,
    });

  const onDataChange: NonNullable<
    UseDataGridProps<SkaterSchema>["onDataChange"]
  > = React.useCallback(
    (newData) => {
      const cellUpdates: Array<UndoRedoCellUpdate> = [];
      const changesById = new Map<string, Partial<SkaterSchema>>();

      for (const skater of newData) {
        // Rows inserted since the last render aren't in `data` yet
        const existingSkater = skatersCollection.get(skater.id);
        if (!existingSkater) continue;

        const changedKeys = getChangedKeys(existingSkater, skater);
        if (changedKeys.length === 0) continue;

        const changes: Partial<SkaterSchema> = {};
        for (const key of changedKeys) {
          cellUpdates.push({
            rowId: existingSkater.id,
            columnId: key,
            previousValue: existingSkater[key],
            newValue: skater[key],
          });
          (changes as Record<string, unknown>)[key] = skater[key];
        }
        changesById.set(skater.id, changes);
      }

      if (changesById.size === 0) return;

      // Batched so a paste stays under the API rate limit
      skatersCollection.update([...changesById.keys()], (drafts) => {
        for (const draft of drafts) {
          Object.assign(draft, changesById.get(draft.id));
        }
      });
      trackCellsUpdate(cellUpdates);
    },
    [trackCellsUpdate],
  );

  const onRowAdd: NonNullable<UseDataGridProps<SkaterSchema>["onRowAdd"]> =
    React.useCallback(
      (eventDetails) => {
        const afterRowId =
          eventDetails.reason === "insert-below"
            ? eventDetails.afterRowId
            : undefined;
        // Shift+Enter passes the focused row, so the new skater goes right below it
        const order = getInsertOrder(data, afterRowId);
        const newSkater: SkaterSchema = {
          id: generateId(),
          name: null,
          email: null,
          stance: null,
          style: null,
          status: null,
          yearsSkating: null,
          startedSkating: null,
          isPro: false,
          tricks: null,
          media: null,
          order,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        skatersCollection.insert(newSkater);

        trackRowsAdd([newSkater]);

        return {
          rowId: newSkater.id,
          columnId: "name",
        };
      },
      [data, trackRowsAdd],
    );

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
            stance: null,
            style: null,
            status: null,
            yearsSkating: null,
            startedSkating: null,
            isPro: false,
            tricks: null,
            media: null,
            order: maxOrder + i + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          newRows.push(newSkater);
        }

        skatersCollection.insert(newRows);
        trackRowsAdd(newRows);
      },
      [data, trackRowsAdd],
    );

  const onRowsDelete: NonNullable<
    UseDataGridProps<SkaterSchema>["onRowsDelete"]
  > = React.useCallback(
    (rowsToDelete) => {
      // Track for undo/redo (before deletion to capture the rows)
      trackRowsDelete(rowsToDelete);

      // Use batch delete - single transaction for all deletions
      skatersCollection.delete(rowsToDelete.map((skater) => skater.id));
    },
    [trackRowsDelete],
  );

  const onFilesUpload: NonNullable<
    UseDataGridProps<SkaterSchema>["onFilesUpload"]
  > = React.useCallback(
    async ({ files }) => {
      if (isUploadConfigured) {
        // The file cell shows thrown errors and drops the pending files
        const uploadedFiles = await startUpload(files);
        if (!uploadedFiles) {
          throw new Error("Upload failed, please try again.");
        }

        return uploadedFiles.map((file) => ({
          id: file.key,
          name: file.name,
          size: file.size,
          type: file.type,
          url: file.ufsUrl,
        }));
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      return files.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }));
    },
    [isUploadConfigured, startUpload],
  );

  const onFilesDelete: NonNullable<
    UseDataGridProps<SkaterSchema>["onFilesDelete"]
  > = React.useCallback(
    async ({ fileIds, rowId }) => {
      // Simulated uploads only exist in the browser
      if (!isUploadConfigured) return;

      // Duplicated rows share their files, so keep any file another row still uses
      const sharedIds = new Set(
        skatersCollection.toArray.flatMap((skater) =>
          skater.id === rowId
            ? []
            : (skater.media?.map((file) => file.id) ?? []),
        ),
      );
      const fileKeys = fileIds.filter((id) => !sharedIds.has(id));
      if (fileKeys.length === 0) return;

      const response = await fetch("/api/uploadthing/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKeys }),
      });

      // Throwing keeps the file in the cell instead of orphaning it in storage
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Too many requests, please try again in a few seconds."
            : "Couldn't delete the file, please try again.",
        );
      }
    },
    [isUploadConfigured],
  );

  // Each copy lands between its row and the next one, so it shows up right below the original
  const onRowsDuplicate = React.useCallback(
    (rows: SkaterSchema[]) => {
      const orders = data.map((skater) => skater.order).sort((a, b) => a - b);
      const now = new Date();
      const copies = rows.map((row) => {
        const nextOrder = orders.find((order) => order > row.order);
        return {
          ...row,
          id: generateId(),
          order:
            nextOrder === undefined
              ? row.order + 1
              : (row.order + nextOrder) / 2,
          createdAt: now,
          updatedAt: now,
        };
      });

      skatersCollection.insert(copies);
      trackRowsAdd(copies);
    },
    [data, trackRowsAdd],
  );

  const columns = React.useMemo<ColumnDef<DataGridFeatures, SkaterSchema>[]>(
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
            options: trickOptions,
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
      getDataGridActionsColumn<SkaterSchema>({
        actions: ({ row, table }) => (
          <>
            <DropdownMenuItem onSelect={() => onRowsDuplicate([row.original])}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => void table.deleteRows([row.id])}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        ),
      }),
    ],
    [filterFn, onRowsDuplicate],
  );

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
        start: ["select"],
        end: ["actions"],
      },
    },
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSearch: true,
    enablePaste: true,
  });

  // Through the grid so bulk changes can be undone
  const onStatusUpdate = React.useCallback(
    (value: string, selectedRows: SkaterRows) => {
      table.updateCells(
        selectedRows.map((row) => ({
          rowId: row.id,
          columnId: "status",
          value,
        })),
      );

      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table],
  );

  const onStyleUpdate = React.useCallback(
    (value: string, selectedRows: SkaterRows) => {
      table.updateCells(
        selectedRows.map((row) => ({
          rowId: row.id,
          columnId: "style",
          value,
        })),
      );

      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table],
  );

  const onDuplicate = React.useCallback(
    (selectedRows: SkaterRows) => {
      onRowsDuplicate(selectedRows.map((row) => row.original));
      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} duplicated`,
      );
    },
    [onRowsDuplicate],
  );

  const onDelete = React.useCallback(
    (selectedRows: SkaterRows) => {
      void table.deleteRows(selectedRows.map((row) => row.id));

      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} deleted`,
      );
      table.toggleAllRowsSelected(false);
    },
    [table],
  );

  const height = Math.max(400, windowSize.height - 150);

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2 self-end"
      >
        <DataGridKeyboardShortcuts
          enableSearch
          enableUndoRedo
          enablePaste
          enableRowAdd
          enableRowsDelete
        />
        <DataGridFilterMenu table={table} align="end" />
        <DataGridSortMenu table={table} align="end" />
        <DataGridRowHeightMenu table={table} align="end" />
        <DataGridViewMenu table={table} align="end" />
      </div>
      <DataGrid {...dataGridProps} table={table} height={height} />
      <SkatersGridActionBar
        table={table}
        statusOptions={statusOptions}
        styleOptions={styleOptions}
        onStatusUpdate={onStatusUpdate}
        onStyleUpdate={onStyleUpdate}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </div>
  );
}
