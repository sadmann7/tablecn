"use client";

import { useLiveQuery } from "@tanstack/react-db";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import * as React from "react";
import { toast } from "sonner";
import { DataGridActionBar } from "@/app/data-grid-live/components/data-grid-action-bar";
import type { SkaterSchema } from "@/app/data-grid-live/lib/validation";
import {
  generateRandomSkater,
  getSkaterStatusIcon,
  getStanceIcon,
  getStyleIcon,
} from "@/app/lib/utils";
import { DataGrid } from "@/components/data-grid/data-grid";
import { DataGridFilterMenu } from "@/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/components/data-grid/data-grid-keyboard-shortcuts";
import {
  type DataGridCellPresence,
  DataGridPresenceProvider,
} from "@/components/data-grid/data-grid-presence";
import { DataGridRowHeightMenu } from "@/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/components/data-grid/data-grid-view-menu";
import { Button } from "@/components/ui/button";
import { skaters } from "@/db/schema";
import { type UseDataGridProps, useDataGrid } from "@/hooks/use-data-grid";
import {
  type UndoRedoCellUpdate,
  useDataGridUndoRedo,
} from "@/hooks/use-data-grid-undo-redo";
import { useMultiplayerRoom } from "@/hooks/use-multiplayer-room";
import { useWindowSize } from "@/hooks/use-window-size";
import { getCellKey } from "@/lib/data-grid";
import { getFilterFn } from "@/lib/data-grid-filters";
import { generateId } from "@/lib/id";
import { multiplayerCollection } from "../lib/multiplayer-collection";
import { DataGridPresenceAvatars } from "./data-grid-presence-avatars";

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

function toWire(row: SkaterSchema): Record<string, unknown> {
  return {
    ...row,
    startedSkating: row.startedSkating?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

interface DataGridMultiplayerDemoProps {
  roomId: string;
}

export function DataGridMultiplayerDemo({
  roomId,
}: DataGridMultiplayerDemoProps) {
  const windowSize = useWindowSize();
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { data = [] } = useLiveQuery(
    (q) => {
      let query = q.from({ skater: multiplayerCollection });
      for (const sort of sorting) {
        const field = sort.id as keyof SkaterSchema;
        query = query.orderBy(
          (t) => t.skater[field],
          sort.desc ? "desc" : "asc",
        );
      }
      query = query.orderBy((t) => t.skater.order, "asc");
      return query;
    },
    [sorting],
  );

  const {
    users,
    currentUserId,
    sendCellUpdate,
    sendRowAdd,
    sendRowsAdd,
    sendRowsDelete,
    sendActiveCell,
  } = useMultiplayerRoom(roomId);

  const undoRedoOnDataChange = React.useCallback(
    (newData: SkaterSchema[]) => {
      const currentIds = new Set(data.map((s) => s.id));
      const newIds = new Set(newData.map((s) => s.id));

      const deletedIds: string[] = [];
      for (const skater of data) {
        if (!newIds.has(skater.id)) {
          multiplayerCollection.delete(skater.id);
          deletedIds.push(skater.id);
        }
      }
      if (deletedIds.length > 0) sendRowsDelete(deletedIds);

      const insertedRows: SkaterSchema[] = [];
      for (const skater of newData) {
        if (!currentIds.has(skater.id)) {
          multiplayerCollection.insert(skater);
          insertedRows.push(skater);
        } else {
          const existing = data.find((s) => s.id === skater.id);
          if (!existing) continue;

          const changedKeys = (
            Object.keys(skater) as Array<keyof SkaterSchema>
          ).filter((key) => {
            const ev =
              existing[key] instanceof Date
                ? (existing[key] as Date).toISOString()
                : existing[key];
            const nv =
              skater[key] instanceof Date
                ? (skater[key] as Date).toISOString()
                : skater[key];
            return JSON.stringify(ev) !== JSON.stringify(nv);
          });

          if (changedKeys.length > 0) {
            multiplayerCollection.update(skater.id, (draft) => {
              Object.assign(draft, skater);
            });
            for (const key of changedKeys) {
              const nv =
                skater[key] instanceof Date
                  ? (skater[key] as Date).toISOString()
                  : skater[key];
              sendCellUpdate(skater.id, key, nv);
            }
          }
        }
      }
      if (insertedRows.length > 0) sendRowsAdd(insertedRows.map(toWire));
    },
    [data, sendRowsDelete, sendRowsAdd, sendCellUpdate],
  );

  const { trackCellsUpdate, trackRowsAdd, trackRowsDelete } =
    useDataGridUndoRedo({
      data,
      onDataChange: undoRedoOnDataChange,
      getRowId: (row) => row.id,
    });

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
        meta: { label: "Name", cell: { variant: "short-text" } },
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        minSize: 250,
        filterFn,
        meta: { label: "Email", cell: { variant: "short-text" } },
      },
      {
        id: "stance",
        accessorKey: "stance",
        header: "Stance",
        minSize: 140,
        filterFn,
        meta: {
          label: "Stance",
          cell: { variant: "select", options: stanceOptions },
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
          cell: { variant: "select", options: styleOptions },
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
          cell: { variant: "select", options: statusOptions },
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
          cell: { variant: "multi-select", options: trickSelectOptions },
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
          cell: { variant: "number", min: 0, max: 50, step: 1 },
        },
      },
      {
        id: "startedSkating",
        accessorKey: "startedSkating",
        header: "Skating Since",
        minSize: 170,
        filterFn,
        meta: { label: "Skating Since", cell: { variant: "date" } },
      },
      {
        id: "isPro",
        accessorKey: "isPro",
        header: "Pro",
        minSize: 90,
        filterFn,
        meta: { label: "Pro", cell: { variant: "checkbox" } },
      },
    ],
    [filterFn],
  );

  const onDataChange: NonNullable<
    UseDataGridProps<SkaterSchema>["onDataChange"]
  > = React.useCallback(
    (newData) => {
      const cellUpdates: Array<UndoRedoCellUpdate> = [];

      for (const skater of newData) {
        const existing = data.find((s) => s.id === skater.id);

        if (!existing) {
          multiplayerCollection.insert(skater);
          continue;
        }

        for (const key of Object.keys(skater) as Array<keyof SkaterSchema>) {
          const ev =
            existing[key] instanceof Date
              ? (existing[key] as Date).toISOString()
              : existing[key];
          const nv =
            skater[key] instanceof Date
              ? (skater[key] as Date).toISOString()
              : skater[key];

          if (JSON.stringify(ev) !== JSON.stringify(nv)) {
            cellUpdates.push({
              rowId: existing.id,
              columnId: key,
              previousValue: existing[key],
              newValue: skater[key],
            });

            multiplayerCollection.update(skater.id, (draft) => {
              (draft as Record<string, unknown>)[key] = skater[key];
            });

            // Broadcast immediately, no Postgres round-trip needed
            sendCellUpdate(existing.id, key, nv);
          }
        }
      }

      if (cellUpdates.length > 0) trackCellsUpdate(cellUpdates);
    },
    [data, trackCellsUpdate, sendCellUpdate],
  );

  const onRowAdd: NonNullable<UseDataGridProps<SkaterSchema>["onRowAdd"]> =
    React.useCallback(() => {
      const maxOrder = data.reduce((max, s) => Math.max(max, s.order), 0);
      const newSkater: SkaterSchema = {
        ...generateRandomSkater(),
        order: maxOrder + 1,
      };

      multiplayerCollection.insert(newSkater);
      sendRowAdd(toWire(newSkater));
      trackRowsAdd([newSkater]);

      return { rowIndex: data.length, columnId: "name" };
    }, [data, trackRowsAdd, sendRowAdd]);

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
          multiplayerCollection.insert(newSkater);
        }

        sendRowsAdd(newRows.map(toWire));
        trackRowsAdd(newRows);
      },
      [data, trackRowsAdd, sendRowsAdd],
    );

  const onRowsDelete: NonNullable<
    UseDataGridProps<SkaterSchema>["onRowsDelete"]
  > = React.useCallback(
    (rowsToDelete) => {
      const ids = rowsToDelete.map((s) => s.id);
      trackRowsDelete(rowsToDelete);
      multiplayerCollection.delete(ids);
      sendRowsDelete(ids);
    },
    [trackRowsDelete, sendRowsDelete],
  );

  const { table, tableMeta, ...dataGridProps } = useDataGrid({
    data,
    onDataChange,
    onRowAdd,
    onRowsAdd,
    onRowsDelete,
    columns,
    getRowId: (row) => row.id,
    initialState: { columnPinning: { left: ["select"] }, sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSearch: true,
    enablePaste: true,
  });

  const focusedRowIndex = tableMeta.focusedCell?.rowIndex ?? null;
  const focusedColumnId = tableMeta.focusedCell?.columnId ?? null;
  const tableRef = React.useRef(table);
  React.useEffect(() => {
    tableRef.current = table;
  });

  React.useEffect(() => {
    if (focusedRowIndex !== null && focusedColumnId !== null) {
      const row = tableRef.current.getRowModel().rows[focusedRowIndex];
      sendActiveCell(row?.id ?? null, focusedColumnId);
    } else {
      sendActiveCell(null, null);
    }
  }, [focusedRowIndex, focusedColumnId, sendActiveCell]);

  const onStatusUpdate = React.useCallback(
    (value: string) => {
      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        toast.error("No skaters selected");
        return;
      }

      const ids = selectedRows.map((row) => row.original.id);
      multiplayerCollection.update(ids, (drafts) => {
        for (const draft of drafts) draft.status = value as never;
      });
      for (const id of ids) sendCellUpdate(id, "status", value);
      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table, sendCellUpdate],
  );

  const onStyleUpdate = React.useCallback(
    (value: string) => {
      const selectedRows = table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        toast.error("No skaters selected");
        return;
      }

      const ids = selectedRows.map((row) => row.original.id);
      multiplayerCollection.update(ids, (drafts) => {
        for (const draft of drafts) draft.style = value as never;
      });
      for (const id of ids) sendCellUpdate(id, "style", value);
      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} updated`,
      );
    },
    [table, sendCellUpdate],
  );

  const onDelete = React.useCallback(() => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("No skaters selected");
      return;
    }
    tableMeta.onRowsDelete?.(selectedRows.map((row) => row.index));
    toast.success(
      `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} deleted`,
    );
    table.toggleAllRowsSelected(false);
  }, [table, tableMeta]);

  const onUserClick = React.useCallback(
    (
      _userId: string,
      user: { activeCell: { rowId: string | null; columnId: string | null } },
    ) => {
      const { rowId, columnId } = user.activeCell;
      if (!rowId || !columnId) return;
      const rowIndex = table
        .getRowModel()
        .rows.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) return;
      tableMeta.scrollToCell?.(rowIndex, columnId);
    },
    [table, tableMeta],
  );

  const onCopyLink = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/data-grid-multiplayer?room=${roomId}`;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Room link copied"));
  }, [roomId]);

  const height = Math.max(400, windowSize.height - 200);
  const selectedCellCount = tableMeta.selectionState?.selectedCells.size ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: data is a proxy for row-order changes
  const remoteCells = React.useMemo(() => {
    const map = new Map<string, DataGridCellPresence>();
    const rows = table.getRowModel().rows;

    for (const [userId, user] of Object.entries(users)) {
      if (userId === currentUserId) continue;

      const { rowId, columnId } = user.activeCell;
      if (!rowId || !columnId) continue;

      const rowIndex = rows.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) continue;

      map.set(getCellKey(rowIndex, columnId), {
        color: user.color,
        name: user.name,
      });
    }
    return map;
  }, [users, currentUserId, data, table]);

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <DataGridPresenceAvatars
          users={users}
          currentUserId={currentUserId}
          onUserClick={onUserClick}
        />
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className="flex items-center gap-2"
        >
          <Button
            variant="outline"
            onClick={onCopyLink}
            className="h-8 gap-1.5 text-xs"
          >
            Share room
          </Button>
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
      </div>
      <DataGridPresenceProvider value={remoteCells}>
        <DataGrid
          {...dataGridProps}
          table={table}
          tableMeta={tableMeta}
          height={height}
        />
      </DataGridPresenceProvider>
      <DataGridActionBar
        table={table}
        tableMeta={tableMeta}
        selectedCellCount={selectedCellCount}
        statusOptions={statusOptions}
        styleOptions={styleOptions}
        onStatusUpdate={onStatusUpdate}
        onStyleUpdate={onStyleUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}
