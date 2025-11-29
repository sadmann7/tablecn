"use client";

import { useDirection } from "@radix-ui/react-direction";
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type TableMeta,
  type TableOptions,
  type TableState,
  type Updater,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { toast } from "sonner";
import { getCellKey, getRowHeightValue, parseCellKey } from "@/lib/data-grid";
import type {
  CellPosition,
  ContextMenuState,
  Direction,
  FileCellData,
  NavigationDirection,
  PasteDialogState,
  RowHeightValue,
  SearchState,
  SelectionState,
  UpdateCell,
} from "@/types/data-grid";

const DEFAULT_ROW_HEIGHT = "short";
const OVERSCAN = 6;
const VIEWPORT_OFFSET = 1;
const MIN_COLUMN_SIZE = 60;
const MAX_COLUMN_SIZE = 800;
const SEARCH_SHORTCUT_KEY = "f";
const NON_NAVIGABLE_COLUMN_IDS = ["select", "actions"];

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function useLazyRef<T>(fn: () => T): React.RefObject<T> {
  const ref = React.useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = fn();
  }
  return ref as React.RefObject<T>;
}

function useAsRef<T>(data: T) {
  const ref = React.useRef<T>(data);

  useIsomorphicLayoutEffect(() => {
    ref.current = data;
  });

  return ref;
}

interface DataGridState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  rowHeight: RowHeightValue;
  rowSelection: RowSelectionState;
  selectionState: SelectionState;
  focusedCell: CellPosition | null;
  editingCell: CellPosition | null;
  cutCells: Set<string>;
  contextMenu: ContextMenuState;
  searchQuery: string;
  searchMatches: CellPosition[];
  matchIndex: number;
  searchOpen: boolean;
  lastClickedRowIndex: number | null;
  pasteDialog: PasteDialogState;
}

interface DataGridStore {
  subscribe: (callback: () => void) => () => void;
  getState: () => DataGridState;
  setState: <K extends keyof DataGridState>(
    key: K,
    value: DataGridState[K],
  ) => void;
  notify: () => void;
  batch: (fn: () => void) => void;
}

function useStore<T>(
  store: DataGridStore,
  selector: (state: DataGridState) => T,
): T {
  const getSnapshot = React.useCallback(
    () => selector(store.getState()),
    [store, selector],
  );

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

interface UseDataGridProps<TData>
  extends Omit<TableOptions<TData>, "pageCount" | "getCoreRowModel"> {
  onDataChange?: (data: TData[]) => void;
  onRowAdd?: (event?: React.MouseEvent<HTMLDivElement>) =>
    | Partial<CellPosition>
    | Promise<Partial<CellPosition>>
    | null
    // biome-ignore lint/suspicious/noConfusingVoidType: void is needed here to allow functions without explicit return
    | void;
  onRowsAdd?: (count: number) => void | Promise<void>;
  onRowsDelete?: (rows: TData[], rowIndices: number[]) => void | Promise<void>;
  onPaste?: (updates: Array<UpdateCell>) => void | Promise<void>;
  onFilesUpload?: (params: {
    files: File[];
    rowIndex: number;
    columnId: string;
  }) => Promise<FileCellData[]>;
  onFilesDelete?: (params: {
    fileIds: string[];
    rowIndex: number;
    columnId: string;
  }) => void | Promise<void>;
  overscan?: number;
  rowHeight?: RowHeightValue;
  dir?: Direction;
  autoFocus?: boolean | Partial<CellPosition>;
  enableColumnSelection?: boolean;
  enableSearch?: boolean;
  enablePaste?: boolean;
  readOnly?: boolean;
}

function useDataGrid<TData>({
  data,
  columns,
  overscan = OVERSCAN,
  rowHeight: rowHeightProp = DEFAULT_ROW_HEIGHT,
  dir: dirProp = "ltr",
  initialState,
  ...props
}: UseDataGridProps<TData>) {
  const dir = useDirection(dirProp);
  const dataGridRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<ReturnType<typeof useReactTable<TData>>>(null);
  const rowVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const rowMapRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const cellMapRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const footerRef = React.useRef<HTMLDivElement>(null);

  const propsRef = useAsRef({
    ...props,
    data,
    columns,
    initialState,
  });
  const listenersRef = useLazyRef(() => new Set<() => void>());

  const stateRef = useLazyRef<DataGridState>(() => {
    return {
      sorting: initialState?.sorting ?? [],
      columnFilters: initialState?.columnFilters ?? [],
      rowHeight: rowHeightProp,
      rowSelection: initialState?.rowSelection ?? {},
      selectionState: {
        selectedCells: new Set(),
        selectionRange: null,
        isSelecting: false,
      },
      focusedCell: null,
      editingCell: null,
      cutCells: new Set(),
      contextMenu: {
        open: false,
        x: 0,
        y: 0,
      },
      searchQuery: "",
      searchMatches: [],
      matchIndex: -1,
      searchOpen: false,
      lastClickedRowIndex: null,
      pasteDialog: {
        open: false,
        rowsNeeded: 0,
        clipboardText: "",
      },
    };
  });

  const store = React.useMemo<DataGridStore>(() => {
    let isBatching = false;
    let pendingNotification = false;

    return {
      subscribe: (callback) => {
        listenersRef.current.add(callback);
        return () => listenersRef.current.delete(callback);
      },
      getState: () => stateRef.current,
      setState: (key, value) => {
        if (Object.is(stateRef.current[key], value)) return;
        stateRef.current[key] = value;

        if (isBatching) {
          pendingNotification = true;
        } else {
          if (!pendingNotification) {
            pendingNotification = true;
            queueMicrotask(() => {
              pendingNotification = false;
              store.notify();
            });
          }
        }
      },
      notify: () => {
        for (const listener of listenersRef.current) {
          listener();
        }
      },
      batch: (fn) => {
        if (isBatching) {
          fn();
          return;
        }

        isBatching = true;
        const wasPending = pendingNotification;
        pendingNotification = false;

        try {
          fn();
        } finally {
          isBatching = false;
          if (pendingNotification || wasPending) {
            pendingNotification = false;
            store.notify();
          }
        }
      },
    };
  }, [listenersRef, stateRef]);

  const focusedCell = useStore(store, (state) => state.focusedCell);
  const editingCell = useStore(store, (state) => state.editingCell);
  const selectionState = useStore(store, (state) => state.selectionState);
  const searchQuery = useStore(store, (state) => state.searchQuery);
  const searchMatches = useStore(store, (state) => state.searchMatches);
  const matchIndex = useStore(store, (state) => state.matchIndex);
  const searchOpen = useStore(store, (state) => state.searchOpen);
  const sorting = useStore(store, (state) => state.sorting);
  const columnFilters = useStore(store, (state) => state.columnFilters);
  const rowSelection = useStore(store, (state) => state.rowSelection);
  const rowHeight = useStore(store, (state) => state.rowHeight);
  const contextMenu = useStore(store, (state) => state.contextMenu);
  const pasteDialog = useStore(store, (state) => state.pasteDialog);

  const rowHeightValue = getRowHeightValue(rowHeight);

  const columnIds = React.useMemo(() => {
    return columns
      .map((c) => {
        if (c.id) return c.id;
        if ("accessorKey" in c) return c.accessorKey as string;
        return undefined;
      })
      .filter((id): id is string => Boolean(id));
  }, [columns]);

  const navigableColumnIds = React.useMemo(() => {
    return columnIds.filter((c) => !NON_NAVIGABLE_COLUMN_IDS.includes(c));
  }, [columnIds]);

  const onDataUpdate = React.useCallback(
    (updates: UpdateCell | Array<UpdateCell>) => {
      if (propsRef.current.readOnly) return;

      const updateArray = Array.isArray(updates) ? updates : [updates];

      if (updateArray.length === 0) return;

      const currentTable = tableRef.current;
      const currentData = propsRef.current.data;
      const rows = currentTable?.getRowModel().rows;

      const rowUpdatesMap = new Map<
        number,
        Array<Omit<UpdateCell, "rowIndex">>
      >();

      for (const update of updateArray) {
        if (!rows || !currentTable) {
          const existingUpdates = rowUpdatesMap.get(update.rowIndex) ?? [];
          existingUpdates.push({
            columnId: update.columnId,
            value: update.value,
          });
          rowUpdatesMap.set(update.rowIndex, existingUpdates);
        } else {
          const row = rows[update.rowIndex];
          if (!row) continue;

          const originalData = row.original;
          const originalRowIndex = currentData.indexOf(originalData);

          const targetIndex =
            originalRowIndex !== -1 ? originalRowIndex : update.rowIndex;

          const existingUpdates = rowUpdatesMap.get(targetIndex) ?? [];
          existingUpdates.push({
            columnId: update.columnId,
            value: update.value,
          });
          rowUpdatesMap.set(targetIndex, existingUpdates);
        }
      }

      const tableRowCount = rows?.length ?? currentData.length;
      const newData: TData[] = new Array(tableRowCount);

      for (let i = 0; i < tableRowCount; i++) {
        const updates = rowUpdatesMap.get(i);
        const existingRow = currentData[i];
        const tableRow = rows?.[i];

        if (updates) {
          const baseRow = existingRow ?? tableRow?.original ?? ({} as TData);
          const updatedRow = { ...baseRow } as Record<string, unknown>;
          for (const { columnId, value } of updates) {
            updatedRow[columnId] = value;
          }
          newData[i] = updatedRow as TData;
        } else {
          newData[i] = existingRow ?? tableRow?.original ?? ({} as TData);
        }
      }

      propsRef.current.onDataChange?.(newData);
    },
    [propsRef],
  );

  const getIsCellSelected = React.useCallback(
    (rowIndex: number, columnId: string) => {
      return selectionState.selectedCells.has(getCellKey(rowIndex, columnId));
    },
    [selectionState.selectedCells],
  );

  const clearSelection = React.useCallback(() => {
    store.batch(() => {
      store.setState("selectionState", {
        selectedCells: new Set(),
        selectionRange: null,
        isSelecting: false,
      });
      store.setState("rowSelection", {});
    });
  }, [store]);

  const selectAll = React.useCallback(() => {
    const allCells = new Set<string>();
    const currentTable = tableRef.current;
    const rows = currentTable?.getRowModel().rows ?? [];
    const rowCount = rows.length ?? propsRef.current.data.length;

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      for (const columnId of columnIds) {
        allCells.add(getCellKey(rowIndex, columnId));
      }
    }

    const firstColumnId = columnIds[0];
    const lastColumnId = columnIds[columnIds.length - 1];

    store.setState("selectionState", {
      selectedCells: allCells,
      selectionRange:
        columnIds.length > 0 && rowCount > 0 && firstColumnId && lastColumnId
          ? {
              start: { rowIndex: 0, columnId: firstColumnId },
              end: { rowIndex: rowCount - 1, columnId: lastColumnId },
            }
          : null,
      isSelecting: false,
    });
  }, [columnIds, propsRef, store]);

  const selectColumn = React.useCallback(
    (columnId: string) => {
      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows ?? [];
      const rowCount = rows.length ?? propsRef.current.data.length;

      if (rowCount === 0) return;

      const selectedCells = new Set<string>();

      for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
        selectedCells.add(getCellKey(rowIndex, columnId));
      }

      store.setState("selectionState", {
        selectedCells,
        selectionRange: {
          start: { rowIndex: 0, columnId },
          end: { rowIndex: rowCount - 1, columnId },
        },
        isSelecting: false,
      });
    },
    [propsRef, store],
  );

  const selectRange = React.useCallback(
    (start: CellPosition, end: CellPosition, isSelecting = false) => {
      const startColIndex = columnIds.indexOf(start.columnId);
      const endColIndex = columnIds.indexOf(end.columnId);

      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      const minCol = Math.min(startColIndex, endColIndex);
      const maxCol = Math.max(startColIndex, endColIndex);

      const selectedCells = new Set<string>();

      for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
        for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
          const columnId = columnIds[colIndex];
          if (columnId) {
            selectedCells.add(getCellKey(rowIndex, columnId));
          }
        }
      }

      store.setState("selectionState", {
        selectedCells,
        selectionRange: { start, end },
        isSelecting,
      });
    },
    [columnIds, store],
  );

  const onCellsCopy = React.useCallback(async () => {
    const currentState = store.getState();

    let selectedCellsArray: string[];
    if (!currentState.selectionState.selectedCells.size) {
      if (!currentState.focusedCell) return;
      const focusedCellKey = getCellKey(
        currentState.focusedCell.rowIndex,
        currentState.focusedCell.columnId,
      );
      selectedCellsArray = [focusedCellKey];
    } else {
      selectedCellsArray = Array.from(
        currentState.selectionState.selectedCells,
      );
    }

    const currentTable = tableRef.current;
    const rows = currentTable?.getRowModel().rows;
    if (!rows) return;

    const selectedColumnIds: string[] = [];

    for (const cellKey of selectedCellsArray) {
      const { columnId } = parseCellKey(cellKey);
      if (columnId && !selectedColumnIds.includes(columnId)) {
        selectedColumnIds.push(columnId);
      }
    }

    const cellData = new Map<string, string>();
    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      const row = rows[rowIndex];
      if (row) {
        const cell = row
          .getVisibleCells()
          .find((c) => c.column.id === columnId);
        if (cell) {
          const value = cell.getValue();
          const cellVariant = cell.column.columnDef?.meta?.cell?.variant;

          let serializedValue = "";
          if (cellVariant === "file" || cellVariant === "multi-select") {
            serializedValue = value ? JSON.stringify(value) : "";
          } else if (value instanceof Date) {
            serializedValue = value.toISOString();
          } else {
            serializedValue = String(value ?? "");
          }

          cellData.set(cellKey, serializedValue);
        }
      }
    }

    const rowIndices = new Set<number>();
    const colIndices = new Set<number>();

    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      rowIndices.add(rowIndex);
      const colIndex = selectedColumnIds.indexOf(columnId);
      if (colIndex >= 0) {
        colIndices.add(colIndex);
      }
    }

    const sortedRowIndices = Array.from(rowIndices).sort((a, b) => a - b);
    const sortedColIndices = Array.from(colIndices).sort((a, b) => a - b);
    const sortedColumnIds = sortedColIndices.map((i) => selectedColumnIds[i]);

    const tsvData = sortedRowIndices
      .map((rowIndex) =>
        sortedColumnIds
          .map((columnId) => {
            const cellKey = `${rowIndex}:${columnId}`;
            return cellData.get(cellKey) ?? "";
          })
          .join("\t"),
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(tsvData);

      const currentState = store.getState();
      if (currentState.cutCells.size > 0) {
        store.setState("cutCells", new Set());
      }

      toast.success(
        `${selectedCellsArray.length} cell${
          selectedCellsArray.length !== 1 ? "s" : ""
        } copied`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to copy to clipboard",
      );
    }
  }, [store]);

  const onCellsCut = React.useCallback(async () => {
    if (propsRef.current.readOnly) return;

    const currentState = store.getState();

    let selectedCellsArray: string[];
    if (!currentState.selectionState.selectedCells.size) {
      if (!currentState.focusedCell) return;
      const focusedCellKey = getCellKey(
        currentState.focusedCell.rowIndex,
        currentState.focusedCell.columnId,
      );
      selectedCellsArray = [focusedCellKey];
    } else {
      selectedCellsArray = Array.from(
        currentState.selectionState.selectedCells,
      );
    }

    const currentTable = tableRef.current;
    const rows = currentTable?.getRowModel().rows;
    if (!rows) return;

    const selectedColumnIds: string[] = [];

    for (const cellKey of selectedCellsArray) {
      const { columnId } = parseCellKey(cellKey);
      if (columnId && !selectedColumnIds.includes(columnId)) {
        selectedColumnIds.push(columnId);
      }
    }

    const cellData = new Map<string, string>();
    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      const row = rows[rowIndex];
      if (row) {
        const cell = row
          .getVisibleCells()
          .find((c) => c.column.id === columnId);
        if (cell) {
          const value = cell.getValue();
          const cellVariant = cell.column.columnDef?.meta?.cell?.variant;

          let serializedValue = "";
          if (cellVariant === "file" || cellVariant === "multi-select") {
            serializedValue = value ? JSON.stringify(value) : "";
          } else if (value instanceof Date) {
            serializedValue = value.toISOString();
          } else {
            serializedValue = String(value ?? "");
          }

          cellData.set(cellKey, serializedValue);
        }
      }
    }

    const rowIndices = new Set<number>();
    const colIndices = new Set<number>();

    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      rowIndices.add(rowIndex);
      const colIndex = selectedColumnIds.indexOf(columnId);
      if (colIndex >= 0) {
        colIndices.add(colIndex);
      }
    }

    const sortedRowIndices = Array.from(rowIndices).sort((a, b) => a - b);
    const sortedColIndices = Array.from(colIndices).sort((a, b) => a - b);
    const sortedColumnIds = sortedColIndices.map((i) => selectedColumnIds[i]);

    const tsvData = sortedRowIndices
      .map((rowIndex) =>
        sortedColumnIds
          .map((columnId) => {
            const cellKey = `${rowIndex}:${columnId}`;
            return cellData.get(cellKey) ?? "";
          })
          .join("\t"),
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(tsvData);

      store.setState("cutCells", new Set(selectedCellsArray));

      toast.success(
        `${selectedCellsArray.length} cell${
          selectedCellsArray.length !== 1 ? "s" : ""
        } cut`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cut to clipboard",
      );
    }
  }, [store, propsRef]);

  const onCellsPaste = React.useCallback(
    async (expandRows = false) => {
      if (propsRef.current.readOnly) return;

      const currentState = store.getState();
      if (!currentState.focusedCell) return;

      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows;
      if (!rows) return;

      try {
        let clipboardText = currentState.pasteDialog.clipboardText;

        if (!clipboardText) {
          clipboardText = await navigator.clipboard.readText();
          if (!clipboardText) return;
        }

        const pastedRows = clipboardText
          .split("\n")
          .filter((row) => row.length > 0);
        const pastedData = pastedRows.map((row) => row.split("\t"));

        const startRowIndex = currentState.focusedCell.rowIndex;
        const startColIndex = navigableColumnIds.indexOf(
          currentState.focusedCell.columnId,
        );

        if (startColIndex === -1) return;

        const rowCount = rows.length ?? propsRef.current.data.length;
        const rowsNeeded = startRowIndex + pastedData.length - rowCount;

        if (
          rowsNeeded > 0 &&
          !expandRows &&
          propsRef.current.onRowAdd &&
          !currentState.pasteDialog.clipboardText
        ) {
          store.setState("pasteDialog", {
            open: true,
            rowsNeeded,
            clipboardText,
          });
          return;
        }

        if (expandRows && rowsNeeded > 0) {
          const expectedRowCount = rowCount + rowsNeeded;

          if (propsRef.current.onRowsAdd) {
            await propsRef.current.onRowsAdd(rowsNeeded);
          } else if (propsRef.current.onRowAdd) {
            for (let i = 0; i < rowsNeeded; i++) {
              await propsRef.current.onRowAdd();
            }
          }

          let attempts = 0;
          const maxAttempts = 50;
          let currentTableRowCount =
            tableRef.current?.getRowModel().rows.length ?? 0;

          while (
            currentTableRowCount < expectedRowCount &&
            attempts < maxAttempts
          ) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            currentTableRowCount =
              tableRef.current?.getRowModel().rows.length ?? 0;
            attempts++;
          }
        }

        const updates: Array<UpdateCell> = [];
        const tableColumns = currentTable?.getAllColumns() ?? [];
        let cellsUpdated = 0;
        let endRowIndex = startRowIndex;
        let endColIndex = startColIndex;

        const updatedTable = tableRef.current;
        const updatedRows = updatedTable?.getRowModel().rows;
        const currentRowCount = updatedRows?.length ?? 0;

        for (
          let pasteRowIdx = 0;
          pasteRowIdx < pastedData.length;
          pasteRowIdx++
        ) {
          const pasteRow = pastedData[pasteRowIdx];
          if (!pasteRow) continue;

          const targetRowIndex = startRowIndex + pasteRowIdx;
          if (targetRowIndex >= currentRowCount) break;

          for (
            let pasteColIdx = 0;
            pasteColIdx < pasteRow.length;
            pasteColIdx++
          ) {
            const targetColIndex = startColIndex + pasteColIdx;
            if (targetColIndex >= navigableColumnIds.length) break;

            const targetColumnId = navigableColumnIds[targetColIndex];
            if (!targetColumnId) continue;

            const pastedValue = pasteRow[pasteColIdx] ?? "";

            const column = tableColumns.find(
              (col) => col.id === targetColumnId,
            );
            const cellVariant = column?.columnDef?.meta?.cell?.variant;

            let processedValue: unknown = pastedValue;

            if (cellVariant === "number") {
              const numValue = Number.parseFloat(pastedValue);
              processedValue = Number.isNaN(numValue) ? null : numValue;
            } else if (cellVariant === "checkbox") {
              if (!pastedValue) {
                processedValue = false;
              } else {
                processedValue =
                  pastedValue.toLowerCase() === "true" ||
                  pastedValue === "1" ||
                  pastedValue.toLowerCase() === "yes";
              }
            } else if (cellVariant === "date") {
              if (pastedValue) {
                const date = new Date(pastedValue);
                processedValue = Number.isNaN(date.getTime()) ? null : date;
              } else {
                processedValue = null;
              }
            } else if (cellVariant === "multi-select") {
              try {
                processedValue = JSON.parse(pastedValue);
              } catch {
                processedValue = pastedValue
                  ? pastedValue.split(",").map((v) => v.trim())
                  : [];
              }
            } else if (cellVariant === "file") {
              try {
                const parsed = JSON.parse(pastedValue);
                if (Array.isArray(parsed)) {
                  processedValue = parsed.filter(
                    (item) =>
                      item &&
                      typeof item === "object" &&
                      "id" in item &&
                      "name" in item &&
                      "size" in item &&
                      "type" in item,
                  );
                } else {
                  processedValue = [];
                }
              } catch {
                processedValue = [];
              }
            }

            updates.push({
              rowIndex: targetRowIndex,
              columnId: targetColumnId,
              value: processedValue,
            });
            cellsUpdated++;

            endRowIndex = Math.max(endRowIndex, targetRowIndex);
            endColIndex = Math.max(endColIndex, targetColIndex);
          }
        }

        if (updates.length > 0) {
          if (propsRef.current.onPaste) {
            await propsRef.current.onPaste(updates);
          }

          const allUpdates = [...updates];

          if (currentState.cutCells.size > 0) {
            for (const cellKey of currentState.cutCells) {
              const { rowIndex, columnId } = parseCellKey(cellKey);

              const column = tableColumns.find((col) => col.id === columnId);
              const cellVariant = column?.columnDef?.meta?.cell?.variant;

              let emptyValue: unknown = "";
              if (cellVariant === "multi-select" || cellVariant === "file") {
                emptyValue = [];
              } else if (cellVariant === "number" || cellVariant === "date") {
                emptyValue = null;
              } else if (cellVariant === "checkbox") {
                emptyValue = false;
              }

              allUpdates.push({ rowIndex, columnId, value: emptyValue });
            }

            store.setState("cutCells", new Set());
          }

          onDataUpdate(allUpdates);

          toast.success(
            `${cellsUpdated} cell${cellsUpdated !== 1 ? "s" : ""} pasted`,
          );

          const endColumnId = navigableColumnIds[endColIndex];
          if (endColumnId) {
            selectRange(
              {
                rowIndex: startRowIndex,
                columnId: currentState.focusedCell.columnId,
              },
              { rowIndex: endRowIndex, columnId: endColumnId },
            );
          }
        }

        if (currentState.pasteDialog.open) {
          store.setState("pasteDialog", {
            open: false,
            rowsNeeded: 0,
            clipboardText: "",
          });
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to paste. Please try again.",
        );
      }
    },
    [store, navigableColumnIds, propsRef, onDataUpdate, selectRange],
  );

  const focusCellWrapper = React.useCallback(
    (rowIndex: number, columnId: string) => {
      requestAnimationFrame(() => {
        const cellKey = getCellKey(rowIndex, columnId);
        const cellWrapperElement = cellMapRef.current.get(cellKey);

        if (!cellWrapperElement) return;

        cellWrapperElement.focus();
      });
    },
    [],
  );

  const focusCell = React.useCallback(
    (rowIndex: number, columnId: string) => {
      store.batch(() => {
        store.setState("focusedCell", { rowIndex, columnId });
        store.setState("editingCell", null);
      });

      const currentState = store.getState();

      if (currentState.searchOpen) return;

      focusCellWrapper(rowIndex, columnId);
    },
    [store, focusCellWrapper],
  );

  const onRowsDelete = React.useCallback(
    async (rowIndices: number[]) => {
      if (
        propsRef.current.readOnly ||
        !propsRef.current.onRowsDelete ||
        rowIndices.length === 0
      )
        return;

      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows;

      if (!rows || rows.length === 0) return;

      const currentState = store.getState();
      const currentFocusedColumn =
        currentState.focusedCell?.columnId ?? navigableColumnIds[0];

      const minDeletedRowIndex = Math.min(...rowIndices);

      const rowsToDelete: TData[] = [];
      for (const rowIndex of rowIndices) {
        const row = rows[rowIndex];
        if (row) {
          rowsToDelete.push(row.original);
        }
      }

      await propsRef.current.onRowsDelete(rowsToDelete, rowIndices);

      store.batch(() => {
        store.setState("selectionState", {
          selectedCells: new Set(),
          selectionRange: null,
          isSelecting: false,
        });
        store.setState("rowSelection", {});
        store.setState("editingCell", null);
      });

      requestAnimationFrame(() => {
        const currentTable = tableRef.current;
        const currentRows = currentTable?.getRowModel().rows ?? [];
        const newRowCount = currentRows.length ?? propsRef.current.data.length;

        if (newRowCount > 0 && currentFocusedColumn) {
          const targetRowIndex = Math.min(minDeletedRowIndex, newRowCount - 1);
          focusCell(targetRowIndex, currentFocusedColumn);
        }
      });
    },
    [propsRef, store, navigableColumnIds, focusCell],
  );

  const navigateCell = React.useCallback(
    (direction: NavigationDirection) => {
      const currentState = store.getState();
      if (!currentState.focusedCell) return;

      const { rowIndex, columnId } = currentState.focusedCell;
      const currentColIndex = navigableColumnIds.indexOf(columnId);
      const rowVirtualizer = rowVirtualizerRef.current;
      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows ?? [];
      const rowCount = rows.length ?? propsRef.current.data.length;

      let newRowIndex = rowIndex;
      let newColumnId = columnId;

      const isRtl = dir === "rtl";

      switch (direction) {
        case "up":
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case "down":
          newRowIndex = Math.min(rowCount - 1, rowIndex + 1);
          break;
        case "left":
          if (isRtl) {
            if (currentColIndex < navigableColumnIds.length - 1) {
              const nextColumnId = navigableColumnIds[currentColIndex + 1];
              if (nextColumnId) newColumnId = nextColumnId;
            }
          } else {
            if (currentColIndex > 0) {
              const prevColumnId = navigableColumnIds[currentColIndex - 1];
              if (prevColumnId) newColumnId = prevColumnId;
            }
          }
          break;
        case "right":
          if (isRtl) {
            if (currentColIndex > 0) {
              const prevColumnId = navigableColumnIds[currentColIndex - 1];
              if (prevColumnId) newColumnId = prevColumnId;
            }
          } else {
            if (currentColIndex < navigableColumnIds.length - 1) {
              const nextColumnId = navigableColumnIds[currentColIndex + 1];
              if (nextColumnId) newColumnId = nextColumnId;
            }
          }
          break;
        case "home":
          if (navigableColumnIds.length > 0) {
            newColumnId = navigableColumnIds[0] ?? columnId;
          }
          break;
        case "end":
          if (navigableColumnIds.length > 0) {
            newColumnId =
              navigableColumnIds[navigableColumnIds.length - 1] ?? columnId;
          }
          break;
        case "ctrl+home":
          newRowIndex = 0;
          if (navigableColumnIds.length > 0) {
            newColumnId = navigableColumnIds[0] ?? columnId;
          }
          break;
        case "ctrl+end":
          newRowIndex = Math.max(0, rowCount - 1);
          if (navigableColumnIds.length > 0) {
            newColumnId =
              navigableColumnIds[navigableColumnIds.length - 1] ?? columnId;
          }
          break;
        case "pageup":
          if (rowVirtualizer) {
            const visibleRange = rowVirtualizer.getVirtualItems();
            const pageSize = visibleRange.length ?? 10;
            newRowIndex = Math.max(0, rowIndex - pageSize);
          } else {
            newRowIndex = Math.max(0, rowIndex - 10);
          }
          break;
        case "pagedown":
          if (rowVirtualizer) {
            const visibleRange = rowVirtualizer.getVirtualItems();
            const pageSize = visibleRange.length ?? 10;
            newRowIndex = Math.min(rowCount - 1, rowIndex + pageSize);
          } else {
            newRowIndex = Math.min(rowCount - 1, rowIndex + 10);
          }
          break;
      }

      if (newRowIndex !== rowIndex || newColumnId !== columnId) {
        const rowDiff = newRowIndex - rowIndex;

        // For single-row vertical navigation (up/down arrows)
        if (
          Math.abs(rowDiff) === 1 &&
          (direction === "up" || direction === "down")
        ) {
          const container = dataGridRef.current;
          const currentRow = rowMapRef.current.get(rowIndex);
          const targetRow = rowMapRef.current.get(newRowIndex);

          if (!container || !currentRow) {
            focusCell(newRowIndex, newColumnId);
            return;
          }

          const containerRect = container.getBoundingClientRect();
          const headerHeight =
            headerRef.current?.getBoundingClientRect().height ?? 0;
          const footerHeight =
            footerRef.current?.getBoundingClientRect().height ?? 0;

          const viewportTop =
            containerRect.top + headerHeight + VIEWPORT_OFFSET;
          const viewportBottom =
            containerRect.bottom - footerHeight - VIEWPORT_OFFSET;

          if (targetRow) {
            const rowRect = targetRow.getBoundingClientRect();
            const isFullyVisible =
              rowRect.top >= viewportTop && rowRect.bottom <= viewportBottom;

            if (isFullyVisible) {
              focusCell(newRowIndex, newColumnId);
              return;
            }

            focusCell(newRowIndex, newColumnId);

            if (direction === "down") {
              const scrollNeeded = rowRect.bottom - viewportBottom;
              container.scrollTop += scrollNeeded;
            } else {
              const scrollNeeded = viewportTop - rowRect.top;
              container.scrollTop -= scrollNeeded;
            }
            return;
          }

          focusCell(newRowIndex, newColumnId);

          if (direction === "down") {
            container.scrollTop += rowHeightValue;
          } else {
            const currentScrollTop = container.scrollTop;
            const targetScrollTop = Math.max(
              0,
              currentScrollTop - rowHeightValue,
            );
            container.scrollTop = targetScrollTop;
          }
          return;
        }

        // For larger jumps (page up/down, ctrl+home/end, etc.)
        if (rowVirtualizer && Math.abs(rowDiff) > 1) {
          const align =
            direction === "pageup" || direction === "ctrl+home"
              ? "start"
              : direction === "pagedown" || direction === "ctrl+end"
                ? "end"
                : "center";
          rowVirtualizer.scrollToIndex(newRowIndex, { align });
          requestAnimationFrame(() => {
            focusCell(newRowIndex, newColumnId);
          });
          return;
        }

        // For horizontal navigation or when row is already visible
        focusCell(newRowIndex, newColumnId);
      }
    },
    [dir, store, navigableColumnIds, focusCell, propsRef, rowHeightValue],
  );

  const onCellEditingStart = React.useCallback(
    (rowIndex: number, columnId: string) => {
      if (propsRef.current.readOnly) return;

      store.batch(() => {
        store.setState("focusedCell", { rowIndex, columnId });
        store.setState("editingCell", { rowIndex, columnId });
      });
    },
    [store, propsRef],
  );

  const onCellEditingStop = React.useCallback(
    (opts?: { moveToNextRow?: boolean; direction?: NavigationDirection }) => {
      const currentState = store.getState();
      const currentEditing = currentState.editingCell;

      store.setState("editingCell", null);

      if (opts?.moveToNextRow && currentEditing) {
        const { rowIndex, columnId } = currentEditing;
        const currentTable = tableRef.current;
        const rows = currentTable?.getRowModel().rows ?? [];
        const rowCount = rows.length ?? propsRef.current.data.length;

        const nextRowIndex = rowIndex + 1;
        if (nextRowIndex < rowCount) {
          requestAnimationFrame(() => {
            focusCell(nextRowIndex, columnId);
          });
        }
      } else if (opts?.direction && currentEditing) {
        const { rowIndex, columnId } = currentEditing;
        focusCell(rowIndex, columnId);
        requestAnimationFrame(() => {
          navigateCell(opts.direction ?? "right");
        });
      } else if (currentEditing) {
        const { rowIndex, columnId } = currentEditing;
        focusCellWrapper(rowIndex, columnId);
      }
    },
    [store, propsRef, focusCell, navigateCell, focusCellWrapper],
  );

  const onSearchOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        store.setState("searchOpen", true);
        return;
      }

      const currentState = store.getState();
      const currentMatch =
        currentState.matchIndex >= 0 &&
        currentState.searchMatches[currentState.matchIndex];

      store.batch(() => {
        store.setState("searchOpen", false);
        store.setState("searchQuery", "");
        store.setState("searchMatches", []);
        store.setState("matchIndex", -1);

        if (currentMatch) {
          store.setState("focusedCell", {
            rowIndex: currentMatch.rowIndex,
            columnId: currentMatch.columnId,
          });
        }
      });

      if (
        dataGridRef.current &&
        document.activeElement !== dataGridRef.current
      ) {
        dataGridRef.current.focus();
      }
    },
    [store],
  );

  const onSearch = React.useCallback(
    (query: string) => {
      if (!query.trim()) {
        store.batch(() => {
          store.setState("searchMatches", []);
          store.setState("matchIndex", -1);
        });
        return;
      }

      const matches: CellPosition[] = [];
      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows ?? [];

      const lowerQuery = query.toLowerCase();

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!row) continue;

        for (const columnId of columnIds) {
          const cell = row
            .getVisibleCells()
            .find((c) => c.column.id === columnId);
          if (!cell) continue;

          const value = cell.getValue();
          const stringValue = String(value ?? "").toLowerCase();

          if (stringValue.includes(lowerQuery)) {
            matches.push({ rowIndex, columnId });
          }
        }
      }

      store.batch(() => {
        store.setState("searchMatches", matches);
        store.setState("matchIndex", matches.length > 0 ? 0 : -1);
      });

      if (matches.length > 0 && matches[0]) {
        const firstMatch = matches[0];
        rowVirtualizerRef.current?.scrollToIndex(firstMatch.rowIndex, {
          align: "center",
        });
      }
    },
    [columnIds, store],
  );

  const onSearchQueryChange = React.useCallback(
    (query: string) => store.setState("searchQuery", query),
    [store],
  );

  const onNavigateToPrevMatch = React.useCallback(() => {
    const currentState = store.getState();
    if (currentState.searchMatches.length === 0) return;

    const prevIndex =
      currentState.matchIndex - 1 < 0
        ? currentState.searchMatches.length - 1
        : currentState.matchIndex - 1;
    const match = currentState.searchMatches[prevIndex];

    if (match) {
      rowVirtualizerRef.current?.scrollToIndex(match.rowIndex, {
        align: "center",
      });

      requestAnimationFrame(() => {
        store.setState("matchIndex", prevIndex);
        requestAnimationFrame(() => {
          focusCell(match.rowIndex, match.columnId);
        });
      });
    }
  }, [store, focusCell]);

  const onNavigateToNextMatch = React.useCallback(() => {
    const currentState = store.getState();
    if (currentState.searchMatches.length === 0) return;

    const nextIndex =
      (currentState.matchIndex + 1) % currentState.searchMatches.length;
    const match = currentState.searchMatches[nextIndex];

    if (match) {
      rowVirtualizerRef.current?.scrollToIndex(match.rowIndex, {
        align: "center",
      });

      requestAnimationFrame(() => {
        store.setState("matchIndex", nextIndex);
        requestAnimationFrame(() => {
          focusCell(match.rowIndex, match.columnId);
        });
      });
    }
  }, [store, focusCell]);

  const getIsSearchMatch = React.useCallback(
    (rowIndex: number, columnId: string) => {
      return searchMatches.some(
        (match) => match.rowIndex === rowIndex && match.columnId === columnId,
      );
    },
    [searchMatches],
  );

  const getIsActiveSearchMatch = React.useCallback(
    (rowIndex: number, columnId: string) => {
      if (matchIndex < 0) return false;
      const currentMatch = searchMatches[matchIndex];
      return (
        currentMatch?.rowIndex === rowIndex &&
        currentMatch?.columnId === columnId
      );
    },
    [searchMatches, matchIndex],
  );

  const blurCell = React.useCallback(() => {
    const currentState = store.getState();
    if (
      currentState.editingCell &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }

    store.batch(() => {
      store.setState("focusedCell", null);
      store.setState("editingCell", null);
    });
  }, [store]);

  const onCellClick = React.useCallback(
    (rowIndex: number, columnId: string, event?: React.MouseEvent) => {
      if (event?.button === 2) {
        return;
      }

      const currentState = store.getState();
      const currentFocused = currentState.focusedCell;

      if (event) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          const cellKey = getCellKey(rowIndex, columnId);
          const newSelectedCells = new Set(
            currentState.selectionState.selectedCells,
          );

          if (newSelectedCells.has(cellKey)) {
            newSelectedCells.delete(cellKey);
          } else {
            newSelectedCells.add(cellKey);
          }

          store.setState("selectionState", {
            selectedCells: newSelectedCells,
            selectionRange: null,
            isSelecting: false,
          });
          focusCell(rowIndex, columnId);
          return;
        }

        if (event.shiftKey && currentState.focusedCell) {
          event.preventDefault();
          selectRange(currentState.focusedCell, { rowIndex, columnId });
          return;
        }
      }

      const hasSelectedCells =
        currentState.selectionState.selectedCells.size > 0;
      const hasSelectedRows = Object.keys(currentState.rowSelection).length > 0;

      if (hasSelectedCells && !currentState.selectionState.isSelecting) {
        const cellKey = getCellKey(rowIndex, columnId);
        const isClickingSelectedCell =
          currentState.selectionState.selectedCells.has(cellKey);

        if (!isClickingSelectedCell) {
          clearSelection();
        } else {
          focusCell(rowIndex, columnId);
          return;
        }
      } else if (hasSelectedRows && columnId !== "select") {
        clearSelection();
      }

      if (
        currentFocused?.rowIndex === rowIndex &&
        currentFocused?.columnId === columnId
      ) {
        onCellEditingStart(rowIndex, columnId);
      } else {
        focusCell(rowIndex, columnId);
      }
    },
    [store, focusCell, onCellEditingStart, selectRange, clearSelection],
  );

  const onCellDoubleClick = React.useCallback(
    (rowIndex: number, columnId: string, event?: React.MouseEvent) => {
      if (event?.defaultPrevented) return;

      onCellEditingStart(rowIndex, columnId);
    },
    [onCellEditingStart],
  );

  const onCellMouseDown = React.useCallback(
    (rowIndex: number, columnId: string, event: React.MouseEvent) => {
      if (event.button === 2) {
        return;
      }

      event.preventDefault();

      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        store.batch(() => {
          store.setState("selectionState", {
            selectedCells: new Set(),
            selectionRange: {
              start: { rowIndex, columnId },
              end: { rowIndex, columnId },
            },
            isSelecting: true,
          });
          store.setState("rowSelection", {});
        });
      }
    },
    [store],
  );

  const onCellMouseEnter = React.useCallback(
    (rowIndex: number, columnId: string, _event: React.MouseEvent) => {
      const currentState = store.getState();
      if (
        currentState.selectionState.isSelecting &&
        currentState.selectionState.selectionRange
      ) {
        const start = currentState.selectionState.selectionRange.start;
        const end = { rowIndex, columnId };

        if (
          currentState.focusedCell?.rowIndex !== start.rowIndex ||
          currentState.focusedCell?.columnId !== start.columnId
        ) {
          focusCell(start.rowIndex, start.columnId);
        }

        selectRange(start, end, true);
      }
    },
    [store, selectRange, focusCell],
  );

  const onCellMouseUp = React.useCallback(() => {
    const currentState = store.getState();
    store.setState("selectionState", {
      ...currentState.selectionState,
      isSelecting: false,
    });
  }, [store]);

  const onCellContextMenu = React.useCallback(
    (rowIndex: number, columnId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const currentState = store.getState();
      const cellKey = getCellKey(rowIndex, columnId);
      const isTargetCellSelected =
        currentState.selectionState.selectedCells.has(cellKey);

      if (!isTargetCellSelected) {
        store.batch(() => {
          store.setState("selectionState", {
            selectedCells: new Set([cellKey]),
            selectionRange: {
              start: { rowIndex, columnId },
              end: { rowIndex, columnId },
            },
            isSelecting: false,
          });
          store.setState("focusedCell", { rowIndex, columnId });
        });
      }

      store.setState("contextMenu", {
        open: true,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [store],
  );

  const onContextMenuOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        const currentMenu = store.getState().contextMenu;
        store.setState("contextMenu", {
          open: false,
          x: currentMenu.x,
          y: currentMenu.y,
        });
      }
    },
    [store],
  );

  const onDataGridKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      const currentState = store.getState();
      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isCtrlPressed = ctrlKey || metaKey;

      if (
        propsRef.current.enableSearch &&
        isCtrlPressed &&
        !shiftKey &&
        key === SEARCH_SHORTCUT_KEY
      ) {
        event.preventDefault();
        onSearchOpenChange(true);
        return;
      }

      if (
        propsRef.current.enableSearch &&
        currentState.searchOpen &&
        !currentState.editingCell
      ) {
        if (key === "Enter") {
          event.preventDefault();
          if (shiftKey) {
            onNavigateToPrevMatch();
          } else {
            onNavigateToNextMatch();
          }
          return;
        }
        if (key === "Escape") {
          event.preventDefault();
          onSearchOpenChange(false);
          return;
        }
        return;
      }

      if (currentState.editingCell) return;

      if (!currentState.focusedCell) return;

      let direction: NavigationDirection | null = null;

      if (isCtrlPressed && key === "a") {
        event.preventDefault();
        selectAll();
        return;
      }

      if (isCtrlPressed && key === "c") {
        event.preventDefault();
        onCellsCopy();
        return;
      }

      if (isCtrlPressed && key === "x" && !propsRef.current.readOnly) {
        event.preventDefault();
        onCellsCut();
        return;
      }

      if (
        propsRef.current.enablePaste &&
        isCtrlPressed &&
        key === "v" &&
        !propsRef.current.readOnly
      ) {
        event.preventDefault();
        onCellsPaste();
        return;
      }

      if (
        (key === "Delete" || key === "Backspace") &&
        !propsRef.current.readOnly
      ) {
        if (currentState.selectionState.selectedCells.size > 0) {
          event.preventDefault();

          const updates: Array<{
            rowIndex: number;
            columnId: string;
            value: unknown;
          }> = [];

          const currentTable = tableRef.current;
          const tableColumns = currentTable?.getAllColumns() ?? [];

          currentState.selectionState.selectedCells.forEach((cellKey) => {
            const { rowIndex, columnId } = parseCellKey(cellKey);

            const column = tableColumns.find((col) => col.id === columnId);
            const cellVariant = column?.columnDef?.meta?.cell?.variant;

            let emptyValue: unknown = "";
            if (cellVariant === "multi-select" || cellVariant === "file") {
              emptyValue = [];
            } else if (cellVariant === "number" || cellVariant === "date") {
              emptyValue = null;
            } else if (cellVariant === "checkbox") {
              emptyValue = false;
            }

            updates.push({ rowIndex, columnId, value: emptyValue });
          });

          onDataUpdate(updates);
          clearSelection();

          if (currentState.cutCells.size > 0) {
            store.setState("cutCells", new Set());
          }
        }
        return;
      }

      switch (key) {
        case "ArrowUp":
          direction = "up";
          break;
        case "ArrowDown":
          direction = "down";
          break;
        case "ArrowLeft":
          direction = "left";
          break;
        case "ArrowRight":
          direction = "right";
          break;
        case "Home":
          direction = isCtrlPressed ? "ctrl+home" : "home";
          break;
        case "End":
          direction = isCtrlPressed ? "ctrl+end" : "end";
          break;
        case "PageUp":
          direction = "pageup";
          break;
        case "PageDown":
          direction = "pagedown";
          break;
        case "Escape":
          event.preventDefault();
          if (
            currentState.selectionState.selectedCells.size > 0 ||
            Object.keys(currentState.rowSelection).length > 0
          ) {
            clearSelection();
          } else {
            blurCell();
          }
          return;
        case "Tab":
          event.preventDefault();
          if (dir === "rtl") {
            direction = event.shiftKey ? "right" : "left";
          } else {
            direction = event.shiftKey ? "left" : "right";
          }
          break;
      }

      if (direction) {
        event.preventDefault();

        if (shiftKey && key !== "Tab" && currentState.focusedCell) {
          const currentColIndex = navigableColumnIds.indexOf(
            currentState.focusedCell.columnId,
          );
          let newRowIndex = currentState.focusedCell.rowIndex;
          let newColumnId = currentState.focusedCell.columnId;

          const isRtl = dir === "rtl";

          switch (direction) {
            case "up":
              newRowIndex = Math.max(0, currentState.focusedCell.rowIndex - 1);
              break;
            case "down":
              newRowIndex = Math.min(
                (tableRef.current?.getRowModel().rows.length ||
                  propsRef.current.data.length) - 1,
                currentState.focusedCell.rowIndex + 1,
              );
              break;
            case "left":
              if (isRtl) {
                if (currentColIndex < navigableColumnIds.length - 1) {
                  const nextColumnId = navigableColumnIds[currentColIndex + 1];
                  if (nextColumnId) newColumnId = nextColumnId;
                }
              } else {
                if (currentColIndex > 0) {
                  const prevColumnId = navigableColumnIds[currentColIndex - 1];
                  if (prevColumnId) newColumnId = prevColumnId;
                }
              }
              break;
            case "right":
              if (isRtl) {
                if (currentColIndex > 0) {
                  const prevColumnId = navigableColumnIds[currentColIndex - 1];
                  if (prevColumnId) newColumnId = prevColumnId;
                }
              } else {
                if (currentColIndex < navigableColumnIds.length - 1) {
                  const nextColumnId = navigableColumnIds[currentColIndex + 1];
                  if (nextColumnId) newColumnId = nextColumnId;
                }
              }
              break;
          }

          const selectionStart =
            currentState.selectionState.selectionRange?.start ||
            currentState.focusedCell;
          selectRange(selectionStart, {
            rowIndex: newRowIndex,
            columnId: newColumnId,
          });
          focusCell(newRowIndex, newColumnId);
        } else {
          if (currentState.selectionState.selectedCells.size > 0) {
            clearSelection();
          }
          navigateCell(direction);
        }
      }
    },
    [
      dir,
      store,
      propsRef,
      blurCell,
      navigateCell,
      selectAll,
      onCellsCopy,
      onCellsCut,
      onCellsPaste,
      onDataUpdate,
      clearSelection,
      navigableColumnIds,
      selectRange,
      focusCell,
      onSearchOpenChange,
      onNavigateToNextMatch,
      onNavigateToPrevMatch,
    ],
  );

  const onSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      const currentState = store.getState();
      const newSorting =
        typeof updater === "function" ? updater(currentState.sorting) : updater;
      store.setState("sorting", newSorting);
    },
    [store],
  );

  const onColumnFiltersChange = React.useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      const currentState = store.getState();
      const newColumnFilters =
        typeof updater === "function"
          ? updater(currentState.columnFilters)
          : updater;
      store.setState("columnFilters", newColumnFilters);
    },
    [store],
  );

  const onRowSelectionChange = React.useCallback(
    (updater: Updater<RowSelectionState>) => {
      const currentState = store.getState();
      const newRowSelection =
        typeof updater === "function"
          ? updater(currentState.rowSelection)
          : updater;

      const selectedRows = Object.keys(newRowSelection).filter(
        (key) => newRowSelection[key],
      );

      const selectedCells = new Set<string>();
      const rows = tableRef.current?.getRowModel().rows ?? [];

      for (const rowId of selectedRows) {
        const rowIndex = rows.findIndex((r) => r.id === rowId);
        if (rowIndex === -1) continue;

        for (const columnId of columnIds) {
          selectedCells.add(getCellKey(rowIndex, columnId));
        }
      }

      store.batch(() => {
        store.setState("rowSelection", newRowSelection);
        store.setState("selectionState", {
          selectedCells,
          selectionRange: null,
          isSelecting: false,
        });
        store.setState("focusedCell", null);
        store.setState("editingCell", null);
      });
    },
    [store, columnIds],
  );

  const onRowSelect = React.useCallback(
    (rowIndex: number, selected: boolean, shiftKey: boolean) => {
      const currentState = store.getState();
      const rows = tableRef.current?.getRowModel().rows ?? [];
      const currentRow = rows[rowIndex];
      if (!currentRow) return;

      if (shiftKey && currentState.lastClickedRowIndex !== null) {
        const startIndex = Math.min(currentState.lastClickedRowIndex, rowIndex);
        const endIndex = Math.max(currentState.lastClickedRowIndex, rowIndex);

        const newRowSelection: RowSelectionState = {
          ...currentState.rowSelection,
        };

        for (let i = startIndex; i <= endIndex; i++) {
          const row = rows[i];
          if (row) {
            newRowSelection[row.id] = selected;
          }
        }

        onRowSelectionChange(newRowSelection);
      } else {
        onRowSelectionChange({
          ...currentState.rowSelection,
          [currentRow.id]: selected,
        });
      }

      store.setState("lastClickedRowIndex", rowIndex);
    },
    [store, onRowSelectionChange],
  );

  const onRowHeightChange = React.useCallback(
    (updater: Updater<RowHeightValue>) => {
      const currentState = store.getState();
      const newRowHeight =
        typeof updater === "function"
          ? updater(currentState.rowHeight)
          : updater;
      store.setState("rowHeight", newRowHeight);
    },
    [store],
  );

  const onColumnClick = React.useCallback(
    (columnId: string) => {
      if (!propsRef.current.enableColumnSelection) {
        clearSelection();
        return;
      }

      selectColumn(columnId);
    },
    [propsRef, selectColumn, clearSelection],
  );

  const onPasteDialogOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        store.setState("pasteDialog", {
          open: false,
          rowsNeeded: 0,
          clipboardText: "",
        });
      }
    },
    [store],
  );

  const onPasteWithExpansion = React.useCallback(() => {
    onCellsPaste(true);
  }, [onCellsPaste]);

  const onPasteWithoutExpansion = React.useCallback(() => {
    onCellsPaste(false);
  }, [onCellsPaste]);

  const defaultColumn: Partial<ColumnDef<TData>> = React.useMemo(
    () => ({
      // Note: cell is rendered directly in DataGridRow to bypass flexRender's
      // unstable cell.getContext() (see TanStack Table issue #4794)
      minSize: MIN_COLUMN_SIZE,
      maxSize: MAX_COLUMN_SIZE,
    }),
    [],
  );

  const tableMeta = React.useMemo<TableMeta<TData>>(() => {
    return {
      ...propsRef.current.meta,
      dataGridRef,
      cellMapRef,
      // Use getters for frequently changing state values to avoid recreating meta
      get focusedCell() {
        return store.getState().focusedCell;
      },
      get editingCell() {
        return store.getState().editingCell;
      },
      get selectionState() {
        return store.getState().selectionState;
      },
      get searchOpen() {
        return store.getState().searchOpen;
      },
      get contextMenu() {
        return store.getState().contextMenu;
      },
      get pasteDialog() {
        return store.getState().pasteDialog;
      },
      get rowHeight() {
        return store.getState().rowHeight;
      },
      get readOnly() {
        return propsRef.current.readOnly;
      },
      getIsCellSelected,
      getIsSearchMatch,
      getIsActiveSearchMatch,
      onRowHeightChange,
      onRowSelect,
      onDataUpdate,
      onRowsDelete: propsRef.current.onRowsDelete ? onRowsDelete : undefined,
      onColumnClick,
      onCellClick,
      onCellDoubleClick,
      onCellMouseDown,
      onCellMouseEnter,
      onCellMouseUp,
      onCellContextMenu,
      onCellEditingStart,
      onCellEditingStop,
      onCellsCopy,
      onCellsCut,
      onFilesUpload: propsRef.current.onFilesUpload
        ? propsRef.current.onFilesUpload
        : undefined,
      onFilesDelete: propsRef.current.onFilesDelete
        ? propsRef.current.onFilesDelete
        : undefined,
      onContextMenuOpenChange,
      onPasteDialogOpenChange,
      onPasteWithExpansion,
      onPasteWithoutExpansion,
    };
  }, [
    propsRef,
    store,
    getIsCellSelected,
    getIsSearchMatch,
    getIsActiveSearchMatch,
    onRowHeightChange,
    onRowSelect,
    onDataUpdate,
    onRowsDelete,
    onColumnClick,
    onCellClick,
    onCellDoubleClick,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onCellContextMenu,
    onCellEditingStart,
    onCellEditingStop,
    onCellsCopy,
    onCellsCut,
    onContextMenuOpenChange,
    onPasteDialogOpenChange,
    onPasteWithExpansion,
    onPasteWithoutExpansion,
  ]);

  const getMemoizedCoreRowModel = React.useMemo(() => getCoreRowModel(), []);
  const getMemoizedFilteredRowModel = React.useMemo(
    () => getFilteredRowModel(),
    [],
  );
  const getMemoizedSortedRowModel = React.useMemo(
    () => getSortedRowModel(),
    [],
  );

  // Memoize state object to reduce shallow equality checks
  const tableState = React.useMemo<Partial<TableState>>(
    () => ({
      ...propsRef.current.state,
      sorting,
      columnFilters,
      rowSelection,
    }),
    [propsRef, sorting, columnFilters, rowSelection],
  );

  const tableOptions = React.useMemo<TableOptions<TData>>(() => {
    return {
      ...propsRef.current,
      data,
      columns,
      defaultColumn,
      initialState: propsRef.current.initialState,
      state: tableState,
      onRowSelectionChange,
      onSortingChange,
      onColumnFiltersChange,
      columnResizeMode: "onChange",
      getCoreRowModel: getMemoizedCoreRowModel,
      getFilteredRowModel: getMemoizedFilteredRowModel,
      getSortedRowModel: getMemoizedSortedRowModel,
      meta: tableMeta,
    };
  }, [
    propsRef,
    data,
    columns,
    defaultColumn,
    tableState,
    onRowSelectionChange,
    onSortingChange,
    onColumnFiltersChange,
    getMemoizedCoreRowModel,
    getMemoizedFilteredRowModel,
    getMemoizedSortedRowModel,
    tableMeta,
  ]);

  const table = useReactTable(tableOptions);

  if (!tableRef.current) {
    tableRef.current = table;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: columnSizingInfo and columnSizing are used for calculating the column size vars
  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }, [table.getState().columnSizingInfo, table.getState().columnSizing]);

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: () => rowHeightValue,
    overscan,
    isScrollingResetDelay: 150,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  if (!rowVirtualizerRef.current) {
    rowVirtualizerRef.current = rowVirtualizer;
  }

  const onScrollToRow = React.useCallback(
    async (opts: Partial<CellPosition>) => {
      const rowIndex = opts?.rowIndex ?? 0;
      const columnId = opts?.columnId;

      rowVirtualizer.scrollToIndex(rowIndex, {
        align: "center",
      });

      const navigableIds = propsRef.current.columns
        .map((c) => {
          if (c.id) return c.id;
          if ("accessorKey" in c) return c.accessorKey as string;
          return undefined;
        })
        .filter((id): id is string => Boolean(id))
        .filter((c) => !NON_NAVIGABLE_COLUMN_IDS.includes(c));

      const targetColumnId = columnId ?? navigableIds[0];

      if (!targetColumnId) return;

      requestAnimationFrame(() => {
        store.batch(() => {
          store.setState("focusedCell", {
            rowIndex,
            columnId: targetColumnId,
          });
          store.setState("editingCell", null);
        });

        focusCellWrapper(rowIndex, targetColumnId);
      });
    },
    [rowVirtualizer, propsRef, store, focusCellWrapper],
  );

  const onRowAdd = React.useCallback(
    async (event?: React.MouseEvent<HTMLDivElement>) => {
      if (propsRef.current.readOnly || !propsRef.current.onRowAdd) return;

      const result = await propsRef.current.onRowAdd(event);

      if (event?.defaultPrevented || result === null) return;

      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows ?? [];

      if (result) {
        const adjustedRowIndex =
          (result.rowIndex ?? 0) >= rows.length ? rows.length : result.rowIndex;

        onScrollToRow({
          rowIndex: adjustedRowIndex,
          columnId: result.columnId,
        });
        return;
      }

      onScrollToRow({ rowIndex: rows.length });
    },
    [propsRef, onScrollToRow],
  );

  const searchState = React.useMemo<SearchState | undefined>(() => {
    if (!propsRef.current.enableSearch) return undefined;

    return {
      searchMatches,
      matchIndex,
      searchOpen,
      onSearchOpenChange,
      searchQuery,
      onSearchQueryChange,
      onSearch,
      onNavigateToNextMatch,
      onNavigateToPrevMatch,
    };
  }, [
    propsRef,
    searchMatches,
    matchIndex,
    searchOpen,
    onSearchOpenChange,
    searchQuery,
    onSearchQueryChange,
    onSearch,
    onNavigateToNextMatch,
    onNavigateToPrevMatch,
  ]);

  React.useEffect(() => {
    const dataGridElement = dataGridRef.current;
    if (!dataGridElement) return;

    dataGridElement.addEventListener("keydown", onDataGridKeyDown);
    return () => {
      dataGridElement.removeEventListener("keydown", onDataGridKeyDown);
    };
  }, [onDataGridKeyDown]);

  React.useEffect(() => {
    function onGlobalKeyDown(event: KeyboardEvent) {
      const dataGridElement = dataGridRef.current;
      if (!dataGridElement) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isCommandPressed = ctrlKey || metaKey;

      if (
        propsRef.current.enableSearch &&
        isCommandPressed &&
        !shiftKey &&
        key === SEARCH_SHORTCUT_KEY
      ) {
        const isInInput =
          target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        const isInDataGrid = dataGridElement.contains(target);
        const isInSearchInput = target.closest('[role="search"]') !== null;

        if (isInDataGrid || isInSearchInput || !isInInput) {
          event.preventDefault();
          event.stopPropagation();
          onSearchOpenChange(true);

          if (!isInDataGrid && !isInSearchInput) {
            requestAnimationFrame(() => {
              dataGridElement.focus();
            });
          }
          return;
        }
      }

      const isInDataGrid = dataGridElement.contains(target);
      if (!isInDataGrid) return;

      if (key === "Escape") {
        const currentState = store.getState();
        const hasSelections =
          currentState.selectionState.selectedCells.size > 0 ||
          Object.keys(currentState.rowSelection).length > 0;

        if (hasSelections) {
          event.preventDefault();
          event.stopPropagation();
          clearSelection();
        }
      }
    }

    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown, true);
    };
  }, [propsRef, onSearchOpenChange, store, clearSelection]);

  React.useEffect(() => {
    const currentState = store.getState();
    const autoFocus = propsRef.current.autoFocus;

    if (
      autoFocus &&
      data.length > 0 &&
      columns.length > 0 &&
      !currentState.focusedCell
    ) {
      if (navigableColumnIds.length > 0) {
        const rafId = requestAnimationFrame(() => {
          if (typeof autoFocus === "object") {
            const { rowIndex, columnId } = autoFocus;
            if (columnId) {
              focusCell(rowIndex ?? 0, columnId);
            }
            return;
          }

          const firstColumnId = navigableColumnIds[0];
          if (firstColumnId) {
            focusCell(0, firstColumnId);
          }
        });
        return () => cancelAnimationFrame(rafId);
      }
    }
  }, [store, propsRef, data, columns, navigableColumnIds, focusCell]);

  React.useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (event.button === 2) {
        return;
      }

      if (
        dataGridRef.current &&
        !dataGridRef.current.contains(event.target as Node)
      ) {
        const target = event.target;
        const isInsidePopover =
          target instanceof HTMLElement &&
          (target.closest("[data-grid-cell-editor]") ||
            target.closest("[data-grid-popover]"));

        if (!isInsidePopover) {
          blurCell();
          const currentState = store.getState();
          if (
            currentState.selectionState.selectedCells.size > 0 ||
            Object.keys(currentState.rowSelection).length > 0
          ) {
            clearSelection();
          }
        }
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [store, blurCell, clearSelection]);

  React.useEffect(() => {
    function onSelectStart(event: Event) {
      event.preventDefault();
    }

    function onContextMenu(event: Event) {
      event.preventDefault();
    }

    function onCleanup() {
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("contextmenu", onContextMenu);
      document.body.style.userSelect = "";
    }

    const onUnsubscribe = store.subscribe(() => {
      const currentState = store.getState();
      if (currentState.selectionState.isSelecting) {
        document.addEventListener("selectstart", onSelectStart);
        document.addEventListener("contextmenu", onContextMenu);
        document.body.style.userSelect = "none";
      } else {
        onCleanup();
      }
    });

    return () => {
      onCleanup();
      onUnsubscribe();
    };
  }, [store]);

  useIsomorphicLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    rowHeight,
    table.getState().columnFilters,
    table.getState().columnOrder,
    table.getState().columnPinning,
    table.getState().columnSizing,
    table.getState().columnVisibility,
    table.getState().expanded,
    table.getState().globalFilter,
    table.getState().grouping,
    table.getState().rowSelection,
    table.getState().sorting,
  ]);

  return React.useMemo(
    () => ({
      dataGridRef,
      headerRef,
      rowMapRef,
      footerRef,
      dir,
      table,
      tableMeta,
      rowVirtualizer,
      columns,
      searchState,
      columnSizeVars,
      focusedCell,
      editingCell,
      selectionState,
      rowHeight,
      contextMenu,
      pasteDialog,
      onRowAdd: propsRef.current.onRowAdd ? onRowAdd : undefined,
    }),
    [
      propsRef,
      dir,
      table,
      tableMeta,
      rowVirtualizer,
      columns,
      searchState,
      columnSizeVars,
      focusedCell,
      editingCell,
      selectionState,
      rowHeight,
      contextMenu,
      pasteDialog,
      onRowAdd,
    ],
  );
}

export {
  useDataGrid,
  //
  type UseDataGridProps,
};
