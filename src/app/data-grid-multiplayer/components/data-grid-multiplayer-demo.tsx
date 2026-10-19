"use client";

import type { UserPresence } from "@party/types";
import type { ColumnDef, Row, SortingState } from "@tanstack/react-table";

import { SEED_FILE_ID_PREFIX, TRICKS } from "@party/constants";
import { useLiveQuery } from "@tanstack/react-db";
import { Copy, Languages, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { SkaterSchema } from "@/app/data-grid-multiplayer/lib/validation";
import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { CellPresence, Direction } from "@/lib/data-grid-types";

import { SkatersDataGridActionBar } from "@/app/data-grid-multiplayer/components/skaters-data-grid-action-bar";
import { getInsertOrder } from "@/app/data-grid-multiplayer/lib/order";
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
  useDataGrid,
  type UseDataGridProps,
} from "@/registry/bases/radix/hooks/use-data-grid";
import { DirectionProvider } from "@/registry/bases/radix/ui/direction";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/registry/bases/radix/ui/dropdown-menu";
import { Toggle } from "@/registry/bases/radix/ui/toggle";

import { DataGridPresenceAvatars } from "./data-grid-presence-avatars";
import { DataGridShareMenu } from "./data-grid-share-menu";

type SkaterRows = Array<Row<DataGridFeatures, SkaterSchema>>;

// The server doesn't echo your own cell back, so your presence takes it from the grid
function getPresenceUsers(
  users: Record<string, UserPresence>,
  currentUserId: string,
  activeCell: UserPresence["activeCell"],
) {
  const currentUser = users[currentUserId];
  if (!currentUser) return users;
  return { ...users, [currentUserId]: { ...currentUser, activeCell } };
}

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
  isUploadConfigured: boolean;
}

export function DataGridMultiplayerDemo({
  roomId,
  isUploadConfigured,
}: DataGridMultiplayerDemoProps) {
  const windowSize = useWindowSize();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [dir, setDir] = React.useState<Direction>("ltr");

  const { collection, users, currentUserId, sendActiveCell } =
    useMultiplayerRoom(roomId);

  const { data } = useLiveQuery({
    query: (q) => {
      let query = q.from({ skater: collection });
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
  });

  const undoRedoOnDataChange = React.useCallback(
    (newData: SkaterSchema[]) => {
      const currentIds = new Set(data.map((s) => s.id));
      const newIds = new Set(newData.map((s) => s.id));

      const deletedIds = data
        .filter((skater) => !newIds.has(skater.id))
        .map((skater) => skater.id);
      if (deletedIds.length > 0) collection.delete(deletedIds);

      const insertedRows: SkaterSchema[] = [];
      for (const skater of newData) {
        if (!currentIds.has(skater.id)) {
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
            collection.update(skater.id, (draft) => {
              for (const key of changedKeys) {
                (draft as Record<string, unknown>)[key] = skater[key];
              }
            });
          }
        }
      }
      if (insertedRows.length > 0) collection.insert(insertedRows);
    },
    [collection, data],
  );

  const { trackCellsUpdate, trackRowsAdd, trackRowsDelete } =
    useDataGridUndoRedo<SkaterSchema>({
      data,
      onDataChange: undoRedoOnDataChange,
      getRowId: (row) => row.id,
    });

  const filterFn = React.useMemo(() => getFilterFn<SkaterSchema>(), []);

  const { startUpload } = useUploadThing("skaterMedia");

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

      collection.insert(copies);
      trackRowsAdd(copies);
    },
    [collection, data, trackRowsAdd],
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

  const onDataChange: NonNullable<
    UseDataGridProps<SkaterSchema>["onDataChange"]
  > = React.useCallback(
    (newData) => {
      const cellUpdates: Array<UndoRedoCellUpdate> = [];

      for (const skater of newData) {
        const existing = data.find((s) => s.id === skater.id);

        if (!existing) {
          collection.insert(skater);
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

            collection.update(skater.id, (draft) => {
              (draft as Record<string, unknown>)[key] = skater[key];
            });
          }
        }
      }

      if (cellUpdates.length > 0) trackCellsUpdate(cellUpdates);
    },
    [collection, data, trackCellsUpdate],
  );

  const onRowAdd: NonNullable<UseDataGridProps<SkaterSchema>["onRowAdd"]> =
    React.useCallback(
      (eventDetails) => {
        const afterRowId =
          eventDetails.reason === "insert-below"
            ? eventDetails.afterRowId
            : undefined;
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

        collection.insert(newSkater);
        trackRowsAdd([newSkater]);

        return { rowId: newSkater.id, columnId: "name" };
      },
      [collection, data, trackRowsAdd],
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

        collection.insert(newRows);
        trackRowsAdd(newRows);
      },
      [collection, data, trackRowsAdd],
    );

  const onRowsDelete: NonNullable<
    UseDataGridProps<SkaterSchema>["onRowsDelete"]
  > = React.useCallback(
    (rowsToDelete) => {
      const ids = rowsToDelete.map((s) => s.id);
      trackRowsDelete(rowsToDelete);
      collection.delete(ids);
    },
    [collection, trackRowsDelete],
  );

  const onFilesUpload: NonNullable<
    UseDataGridProps<SkaterSchema>["onFilesUpload"]
  > = React.useCallback(
    async ({ files }) => {
      if (isUploadConfigured) {
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

      // Simulated uploads are blob URLs, so other people in the room can't open them
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
        collection.toArray.flatMap((skater) =>
          skater.id === rowId
            ? []
            : (skater.media?.map((file) => file.id) ?? []),
        ),
      );
      const fileKeys = fileIds.filter(
        (id) => !id.startsWith(SEED_FILE_ID_PREFIX) && !sharedIds.has(id),
      );
      if (fileKeys.length === 0) return;

      const response = await fetch("/api/uploadthing/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKeys }),
      });

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

  const cellPresence = React.useMemo(() => {
    const presence: Array<CellPresence> = [];

    for (const [userId, user] of Object.entries(users)) {
      if (userId === currentUserId) continue;

      const { rowId, columnId } = user.activeCell;
      if (!rowId || !columnId) continue;

      presence.push({ rowId, columnId, color: user.color, name: user.name });
    }
    return presence;
  }, [users, currentUserId]);

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
      columnPinning: { start: ["select"], end: ["actions"] },
    },
    dir,
    state: { cellPresence, sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSearch: true,
    enablePaste: true,
  });

  React.useEffect(() => {
    let prevCellKey: string | null = null;

    function onCellSelectionChange() {
      const focusedCell = table.getFocusedCell();
      const rowId = focusedCell?.row.id ?? null;
      const columnId = focusedCell?.column.id ?? null;
      const cellKey = `${rowId}\u0000${columnId}`;
      if (cellKey === prevCellKey) return;
      prevCellKey = cellKey;
      sendActiveCell(rowId, columnId);
    }

    onCellSelectionChange();
    const subscription = table.atoms.cellSelection.subscribe(
      onCellSelectionChange,
    );
    return () => subscription.unsubscribe();
  }, [table, sendActiveCell]);

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

  const onUserClick = React.useCallback(
    (
      _userId: string,
      user: { activeCell: { rowId: string | null; columnId: string | null } },
    ) => {
      const { rowId, columnId } = user.activeCell;
      if (!rowId || !columnId) return;
      table.scrollToCell(rowId, columnId);
    },
    [table],
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

  return (
    <DirectionProvider dir={dir}>
      <div className="container flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <table.Subscribe
            selector={() => {
              const focusedCell = table.getFocusedCell();
              return {
                rowId: focusedCell?.row.id ?? null,
                columnId: focusedCell?.column.id ?? null,
              };
            }}
          >
            {(focusedCell) => (
              <DataGridPresenceAvatars
                users={getPresenceUsers(users, currentUserId, focusedCell)}
                currentUserId={currentUserId}
                getCellLabel={getCellLabel}
                onUserClick={onUserClick}
              />
            )}
          </table.Subscribe>
          <div
            role="toolbar"
            aria-orientation="horizontal"
            className="ms-auto flex items-center gap-2"
          >
            <DataGridShareMenu roomId={roomId} />
            <Toggle
              aria-label="Toggle text direction"
              dir={dir}
              variant="outline"
              className="bg-background dark:bg-input/30 dark:hover:bg-input/50"
              pressed={dir === "rtl"}
              onPressedChange={(pressed) => setDir(pressed ? "rtl" : "ltr")}
            >
              <Languages className="text-muted-foreground" />
              {dir === "ltr" ? "LTR" : "RTL"}
            </Toggle>
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
        <DataGrid {...dataGridProps} table={table} height={height} />
        <SkatersDataGridActionBar
          table={table}
          statusOptions={statusOptions}
          styleOptions={styleOptions}
          onStatusUpdate={onStatusUpdate}
          onStyleUpdate={onStyleUpdate}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    </DirectionProvider>
  );
}
