"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import * as React from "react";
import { use } from "react";
import { toast } from "sonner";
import {
  generateRandomSkater,
  getSkaterStatusIcon,
  getStanceIcon,
  getStyleIcon,
} from "@/app/lib/utils";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridExportMenu } from "@/components/data-grid/data-grid-export-menu";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import {
  DataGridFilterPresets,
  type FilterPreset,
} from "@/components/data-grid/data-grid-filter-presets";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { skaters } from "@/db/schema";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import {
  type UndoRedoCellUpdate,
  useDataGridUndoRedo,
} from "@/hooks/use-data-grid-undo-redo";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { generateId } from "@/lib/id";
import type { CellSelectOptionColor } from "@/types/data-grid";
import { skatersCollection } from "../lib/collections";
import type { SkaterSchema } from "../lib/validation";
import { DataGridActionBar } from "./data-grid-action-bar";

const stanceOptions = skaters.stance.enumValues.map((stance) => ({
  label: stance.charAt(0).toUpperCase() + stance.slice(1),
  value: stance,
  icon: getStanceIcon(stance),
  color: (
    { regular: "blue", goofy: "purple" } satisfies Record<
      string,
      CellSelectOptionColor
    >
  )[stance],
}));

const styleOptions = skaters.style.enumValues.map((style) => ({
  label: style.charAt(0).toUpperCase() + style.slice(1).replace("-", " "),
  value: style,
  icon: getStyleIcon(style),
  color: (
    {
      street: "green",
      vert: "orange",
      park: "cyan",
      freestyle: "indigo",
      "all-around": "amber",
    } satisfies Record<string, CellSelectOptionColor>
  )[style],
}));

const statusOptions = skaters.status.enumValues.map((status) => ({
  label: status.charAt(0).toUpperCase() + status.slice(1),
  value: status,
  icon: getSkaterStatusIcon(status),
  color: (
    {
      amateur: "secondary",
      sponsored: "blue",
      pro: "green",
      legend: "yellow",
    } satisfies Record<string, CellSelectOptionColor>
  )[status],
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

const filterPresets: FilterPreset<SkaterSchema>[] = [
  {
    id: "all",
    label: "All Skaters",
    filters: [],
    columnVisibility: {},
    sorting: [],
  },
  {
    id: "pros",
    label: "Pro Skaters",
    filters: [{ id: "isPro", value: true }],
    sorting: [{ id: "yearsSkating", desc: true }],
    className:
      "border-blue-300 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950 dark:hover:text-blue-300",
    activeClassName:
      "bg-blue-600 text-white ring-blue-400 hover:bg-blue-700 dark:bg-blue-700 dark:text-white dark:ring-blue-500 dark:hover:bg-blue-800",
  },
  {
    id: "street",
    label: "Street Style",
    filters: [{ id: "style", value: "street" }],
    columnVisibility: { stance: false, startedSkating: false, isPro: false },
    sorting: [{ id: "name", desc: true }],
    className:
      "border-green-300 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950 dark:hover:text-green-300",
    activeClassName:
      "bg-green-600 text-white ring-green-400 hover:bg-green-700 dark:bg-green-700 dark:text-white dark:ring-green-500 dark:hover:bg-green-800",
  },
  {
    id: "veterans",
    label: "10+ Years",
    filters: [],
    sorting: [{ id: "yearsSkating", desc: true }],
    className:
      "border-orange-300 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950 dark:hover:text-orange-300",
    activeClassName:
      "bg-orange-600 text-white ring-orange-400 hover:bg-orange-700 dark:bg-orange-700 dark:text-white dark:ring-orange-500 dark:hover:bg-orange-800",
  },
];

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
            readOnly: true,
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
        id: "notes",
        accessorKey: "notes",
        header: "Notes",
        minSize: 300,
        filterFn,
        meta: {
          label: "Notes",
          cell: {
            variant: "long-text",
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
              rowId: existingSkater.id,
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
      trackRowsAdd([skaterWithOrder]);

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
            notes: null,
            order: maxOrder + i + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          newRows.push(newSkater);
          skatersCollection.insert(newSkater);
        }

        // Track for undo/redo
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

  const { table, tableMeta, ...dataGridProps } = useDataGrid({
    data,
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
      sorting,
    },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSearch: true,
    enablePaste: true,
  });

  const onStatusUpdate = React.useCallback(
    (value: string) => {
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
            draft.status = value as never;
          }
        },
      );

      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table],
  );

  const onStyleUpdate = React.useCallback(
    (value: string) => {
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
            draft.style = value as never;
          }
        },
      );

      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table],
  );

  const onDelete = React.useCallback(() => {
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

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Maybe use "container" in classname for the parent div */}
      <div
        role="toolbar"
        aria-orientation="horizontal"
        className="flex items-center gap-2"
      >
        <DataGridFilterPresets table={table} presets={filterPresets} />
        <div className="ml-auto flex items-center gap-2">
          <DataGridKeyboardShortcuts
            enableSearch
            enableUndoRedo
            enablePaste
            enableRowAdd
            enableRowsDelete
          />
          <DataGridExportMenu
            table={table}
            filename="skaters"
            excludeColumns={["select"]}
            align="end"
          />
          <DataGridFilterMenu table={table} align="end" />
          <DataGridSortMenu table={table} align="end" />
          <DataGridRowHeightMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
      </div>
      <DataGrid
        {...dataGridProps}
        table={table}
        tableMeta={tableMeta}
        height={height}
        getRowClassName={({ status }) =>
          status === "amateur" ? "bg-green-500/10" : ""
        }
      />
      <DataGridActionBar
        table={table}
        tableMeta={tableMeta}
        statusOptions={statusOptions}
        styleOptions={styleOptions}
        onStatusUpdate={onStatusUpdate}
        onStyleUpdate={onStyleUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}
