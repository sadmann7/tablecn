"use client";

import type { UserPresence } from "@party/types";

import { SEED_FILE_ID_PREFIX, TRICKS } from "@party/constants";
import { useLiveQuery } from "@tanstack/react-db";
import {
  createColumnHelper,
  type Row,
  type SortingState,
  type Table,
} from "@tanstack/react-table";
import { Copy, Languages, Trash2, WifiOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { CellPresence, Direction } from "@/lib/data-grid-types";

import { SkatersDataGridActionBar } from "@/app/data-grid-multiplayer/components/skaters-data-grid-action-bar";
import { getInsertOrder } from "@/app/data-grid-multiplayer/lib/order";
import {
  SKATER_STANCES,
  SKATER_STATUSES,
  SKATER_STYLES,
  type SkaterSchema,
} from "@/app/data-grid-multiplayer/lib/validation";
import {
  getSkaterStatusIcon,
  getStanceIcon,
  getStyleIcon,
} from "@/app/lib/utils";
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/registry/bases/radix/ui/alert";
import { DirectionProvider } from "@/registry/bases/radix/ui/direction";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/registry/bases/radix/ui/dropdown-menu";
import { Toggle } from "@/registry/bases/radix/ui/toggle";

import { DataGridPresenceAvatars } from "./data-grid-presence-avatars";
import { DataGridShareMenu } from "./data-grid-share-menu";

type SkaterRows = Array<Row<DataGridFeatures, SkaterSchema>>;

const stanceOptions = SKATER_STANCES.map((stance) => ({
  label: stance.charAt(0).toUpperCase() + stance.slice(1),
  value: stance,
  icon: getStanceIcon(stance),
}));

const styleOptions = SKATER_STYLES.map((style) => ({
  label: style.charAt(0).toUpperCase() + style.slice(1).replace("-", " "),
  value: style,
  icon: getStyleIcon(style),
}));

const statusOptions = SKATER_STATUSES.map((status) => ({
  label: status.charAt(0).toUpperCase() + status.slice(1),
  value: status,
  icon: getSkaterStatusIcon(status),
}));

const trickOptions = TRICKS.map((trick) => ({
  label: trick,
  value: trick,
}));

const columnHelper = createColumnHelper<DataGridFeatures, SkaterSchema>();

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

  const { data, isError } = useLiveQuery({
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

  const filterFn = React.useMemo(() => getFilterFn<SkaterSchema>(), []);

  const { startUpload } = useUploadThing("skaterMedia");

  const columns = React.useMemo(
    () =>
      columnHelper.columns([
        getDataGridSelectColumn<SkaterSchema>({ enableRowMarkers: true }),
        columnHelper.accessor("name", {
          id: "name",
          header: "Name",
          minSize: 200,
          filterFn,
          meta: { label: "Name", cell: { variant: "short-text" } },
        }),
        columnHelper.accessor("email", {
          id: "email",
          header: "Email",
          minSize: 250,
          filterFn,
          meta: { label: "Email", cell: { variant: "short-text" } },
        }),
        columnHelper.accessor("stance", {
          id: "stance",
          header: "Stance",
          minSize: 140,
          filterFn,
          meta: {
            label: "Stance",
            cell: { variant: "select", options: stanceOptions },
          },
        }),
        columnHelper.accessor("style", {
          id: "style",
          header: "Style",
          minSize: 160,
          filterFn,
          meta: {
            label: "Style",
            cell: { variant: "select", options: styleOptions },
          },
        }),
        columnHelper.accessor("status", {
          id: "status",
          header: "Status",
          minSize: 160,
          filterFn,
          meta: {
            label: "Status",
            cell: { variant: "select", options: statusOptions },
          },
        }),
        columnHelper.accessor("tricks", {
          id: "tricks",
          header: "Tricks",
          minSize: 240,
          filterFn,
          meta: {
            label: "Tricks",
            cell: { variant: "multi-select", options: trickOptions },
          },
        }),
        columnHelper.accessor("yearsSkating", {
          id: "yearsSkating",
          header: "Years Skating",
          minSize: 160,
          filterFn,
          meta: {
            label: "Years Skating",
            cell: { variant: "number", min: 0, max: 50, step: 1 },
          },
        }),
        columnHelper.accessor("startedSkating", {
          id: "startedSkating",
          header: "Skating Since",
          minSize: 170,
          filterFn,
          meta: { label: "Skating Since", cell: { variant: "date" } },
        }),
        columnHelper.accessor("isPro", {
          id: "isPro",
          header: "Pro",
          minSize: 90,
          filterFn,
          meta: { label: "Pro", cell: { variant: "checkbox" } },
        }),
        columnHelper.accessor("media", {
          id: "media",
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
        }),
        getDataGridActionsColumn<SkaterSchema>({
          actions: ({ row, table }) => (
            <>
              <DropdownMenuItem onSelect={() => duplicateSkaters(table, [row])}>
                <Copy />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => table.deleteRows([row.id])}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          ),
        }),
      ]),
    [filterFn],
  );

  const onDataChange: NonNullable<
    UseDataGridProps<SkaterSchema>["onDataChange"]
  > = React.useCallback(
    (_newData, { changes, addedRows, removedRows }) => {
      if (removedRows.length > 0) {
        collection.delete(removedRows.map((skater) => skater.id));
      }
      if (addedRows.length > 0) collection.insert(addedRows);
      for (const { rowId, columnId, newValue } of changes) {
        collection.update(rowId, (draft) => {
          (draft as Record<string, unknown>)[columnId] = newValue;
        });
      }
    },
    [collection],
  );

  const createRow: NonNullable<UseDataGridProps<SkaterSchema>["createRow"]> =
    React.useCallback(
      (eventDetails) => {
        const afterRowId =
          eventDetails.reason === "insert-below"
            ? eventDetails.afterRowId
            : undefined;
        const now = new Date();
        return {
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
          order: getInsertOrder(data, afterRowId),
          createdAt: now,
          updatedAt: now,
        };
      },
      [data],
    );

  const uploadFiles: NonNullable<
    UseDataGridProps<SkaterSchema>["uploadFiles"]
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

  const deleteFiles: NonNullable<
    UseDataGridProps<SkaterSchema>["deleteFiles"]
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
    [collection, isUploadConfigured],
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
    columns,
    getRowId: (row) => row.id,
    onDataChange,
    createRow,
    uploadFiles,
    deleteFiles,
    initialState: {
      columnPinning: { start: ["select"], end: ["actions"] },
    },
    dir,
    state: { cellPresence, sorting },
    onSortingChange: setSorting,
    enableRowDeletion: true,
    enableSearch: true,
    enablePaste: true,
    manualSorting: true,
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
      duplicateSkaters(table, selectedRows);
      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} duplicated`,
      );
    },
    [table],
  );

  const onDelete = React.useCallback(
    (selectedRows: SkaterRows) => {
      table.deleteRows(selectedRows.map((row) => row.id));
      toast.success(
        `${selectedRows.length} skater${selectedRows.length === 1 ? "" : "s"} deleted`,
      );
      table.toggleAllRowsSelected(false);
    },
    [table],
  );

  const onUserClick = React.useCallback(
    (_userId: string, user: UserPresence) => {
      const { rowId, columnId } = user.activeCell;
      if (!rowId || !columnId) return;
      table.scrollToCell(rowId, columnId);
    },
    [table],
  );

  const getCellLabel = React.useCallback(
    ({ rowId, columnId }: UserPresence["activeCell"]) => {
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
              enableRowCreation
              enableRowDeletion
            />
            <DataGridFilterMenu table={table} align="end" />
            <DataGridSortMenu table={table} align="end" />
            <DataGridRowHeightMenu table={table} align="end" />
            <DataGridViewMenu table={table} align="end" />
          </div>
        </div>
        {isError && (
          <Alert variant="destructive">
            <WifiOff />
            <AlertTitle>Couldn&apos;t reach the room</AlertTitle>
            <AlertDescription>Retrying in the background.</AlertDescription>
          </Alert>
        )}
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

// Each copy lands between its row and the next one, so it shows up right below the original
function duplicateSkaters(
  table: Table<DataGridFeatures, SkaterSchema>,
  rows: SkaterRows,
) {
  const orders = table.options.data
    .map((skater) => skater.order)
    .sort((a, b) => a - b);
  const now = new Date();
  for (const row of rows) {
    const nextOrder = orders.find((order) => order > row.original.order);
    const copy: SkaterSchema = {
      ...row.original,
      id: generateId(),
      order:
        nextOrder === undefined
          ? row.original.order + 1
          : (row.original.order + nextOrder) / 2,
      createdAt: now,
      updatedAt: now,
    };
    table.addRows([copy], { afterRowId: row.id });
  }
}

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
