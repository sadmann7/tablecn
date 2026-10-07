"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";

import { TRICKS } from "@party/constants";
import { useLiveQuery } from "@tanstack/react-db";
import * as React from "react";
import { toast } from "sonner";

import type { SkaterSchema } from "@/app/data-grid-live/lib/validation";
import type { DataGridFeatures } from "@/lib/data-grid-features";

import { DataGridActionBar } from "@/app/data-grid-live/components/data-grid-action-bar";
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
import { useMultiplayerRoom } from "@/hooks/use-multiplayer-room";
import { useWindowSize } from "@/hooks/use-window-size";
import { getFilterFn } from "@/lib/data-grid-filters";
import { getCellKey } from "@/lib/data-grid-utils";
import { generateId } from "@/lib/id";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { DataGridFilterMenu } from "@/registry/bases/radix/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/registry/bases/radix/components/data-grid/data-grid-keyboard-shortcuts";
import {
  type DataGridCellPresence,
  DataGridPresenceProvider,
} from "@/registry/bases/radix/components/data-grid/data-grid-presence";
import { DataGridRowHeightMenu } from "@/registry/bases/radix/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/registry/bases/radix/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/registry/bases/radix/components/data-grid/data-grid-view-menu";
import {
  type UseDataGridProps,
  useDataGrid,
} from "@/registry/bases/radix/hooks/use-data-grid";

import {
  multiplayerCollection,
  serializeSkater,
} from "../lib/multiplayer-collection";
import { DataGridPresenceAvatars } from "./data-grid-presence-avatars";
import { DataGridShareMenu } from "./data-grid-share-menu";

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

interface DataGridMultiplayerDemoProps {
  roomId: string;
}

export function DataGridMultiplayerDemo({
  roomId,
}: DataGridMultiplayerDemoProps) {
  const windowSize = useWindowSize();
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const { data } = useLiveQuery(
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
      if (insertedRows.length > 0)
        sendRowsAdd(insertedRows.map(serializeSkater));
    },
    [data, sendRowsDelete, sendRowsAdd, sendCellUpdate],
  );

  const { trackCellsUpdate, trackRowsAdd, trackRowsDelete } =
    useDataGridUndoRedo<SkaterSchema>({
      data,
      onDataChange: undoRedoOnDataChange,
      getRowId: (row) => row.id,
    });

  const filterFn = React.useMemo(() => getFilterFn<SkaterSchema>(), []);

  const columns = React.useMemo<ColumnDef<DataGridFeatures, SkaterSchema>[]>(
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
          cell: { variant: "multi-select", options: trickOptions },
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
        order: maxOrder + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      multiplayerCollection.insert(newSkater);
      sendRowAdd(serializeSkater(newSkater));
      trackRowsAdd([newSkater]);

      return { rowId: newSkater.id, columnId: "name" };
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
          multiplayerCollection.insert(newSkater);
        }

        sendRowsAdd(newRows.map(serializeSkater));
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

  const { table, scrollToCell, ...dataGridProps } = useDataGrid({
    data,
    onDataChange,
    onRowAdd,
    onRowsAdd,
    onRowsDelete,
    columns,
    getRowId: (row) => row.id,
    initialState: {
      columnPinning: { start: ["select"], end: [] },
      sorting,
    },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSearch: true,
    enablePaste: true,
  });

  const focusedRowId = dataGridProps.focusedCell?.rowId ?? null;
  const focusedColumnId = dataGridProps.focusedCell?.columnId ?? null;

  React.useEffect(() => {
    sendActiveCell(focusedRowId, focusedColumnId);
  }, [focusedRowId, focusedColumnId, sendActiveCell]);

  // The server doesn't echo your own cell back, so your presence takes it from the grid
  const presenceUsers = React.useMemo(() => {
    const currentUser = users[currentUserId];
    if (!currentUser) return users;
    return {
      ...users,
      [currentUserId]: {
        ...currentUser,
        activeCell: { rowId: focusedRowId, columnId: focusedColumnId },
      },
    };
  }, [users, currentUserId, focusedRowId, focusedColumnId]);

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
    void table.deleteRows(selectedRows.map((row) => row.id));
    toast.success(
      `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} deleted`,
    );
    table.toggleAllRowsSelected(false);
  }, [table]);

  const onUserClick = React.useCallback(
    (
      _userId: string,
      user: { activeCell: { rowId: string | null; columnId: string | null } },
    ) => {
      const { rowId, columnId } = user.activeCell;
      if (!rowId || !columnId) return;
      scrollToCell(rowId, columnId);
    },
    [scrollToCell],
  );

  const getCellLabel = React.useCallback(
    ({
      rowId,
      columnId,
    }: {
      rowId: string | null;
      columnId: string | null;
    }) => {
      if (!rowId || !columnId) return null;
      const row = table.getRowModel().rowsById[rowId];
      const column = table.getColumn(columnId);
      if (!row || !column) return null;
      const columnLabel = column.columnDef.meta?.label ?? column.id;
      return `${columnLabel} · row ${row.getDisplayIndex() + 1}`;
    },
    [table],
  );

  const height = Math.max(400, windowSize.height - 150);
  const selectedCellCount = table.getSelectedRangeCellCount();

  const remoteCells = React.useMemo(() => {
    const map = new Map<string, DataGridCellPresence>();

    for (const [userId, user] of Object.entries(users)) {
      if (userId === currentUserId) continue;

      const { rowId, columnId } = user.activeCell;
      if (!rowId || !columnId) continue;

      map.set(getCellKey(rowId, columnId), {
        color: user.color,
        name: user.name,
      });
    }
    return map;
  }, [users, currentUserId]);

  return (
    <div className="container flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <DataGridPresenceAvatars
          users={presenceUsers}
          currentUserId={currentUserId}
          getCellLabel={getCellLabel}
          onUserClick={onUserClick}
        />
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className="flex items-center gap-2"
        >
          <DataGridShareMenu roomId={roomId} />
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
        <DataGrid {...dataGridProps} table={table} height={height} />
      </DataGridPresenceProvider>
      <DataGridActionBar
        table={table}
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
