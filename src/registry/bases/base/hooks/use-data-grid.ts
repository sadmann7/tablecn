import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnVisibilityState,
  type Row,
  type RowData,
  type RowSelectionState,
  type SortingState,
  type Table,
  type TableOptions,
  type TableState,
  type Updater,
  useTable,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { toast } from "sonner";

import type {
  CellPosition,
  CellUpdate,
  ContextMenuState,
  DataGridTableMeta,
  Direction,
  FileCellData,
  NavigationDirection,
  PasteDialogState,
  SearchState,
  SelectionState,
} from "@/lib/data-grid-types";

import { useAsRef } from "@/hooks/use-as-ref";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { useLazyRef } from "@/hooks/use-lazy-ref";
import {
  type DataGridFeatures,
  dataGridFeatures,
} from "@/lib/data-grid-features";
import {
  getCellFocusTarget,
  getCellKey,
  getEmptyCellValue,
  getIsFileCellData,
  getIsInPopover,
  getRowIndexById,
  getScrollDirection,
  getTabTargetCell,
  getVisibleColumnIds,
  matchSelectOption,
  parseCellKey,
  parseTsv,
  scrollCellIntoView,
  stringifyUnknown,
} from "@/lib/data-grid-utils";
import { useDirection } from "@/registry/bases/base/ui/direction";

const OVERSCAN = 6;
const VIEWPORT_OFFSET = 1;
const HORIZONTAL_PAGE_SIZE = 5;
const SCROLL_SYNC_RETRY_COUNT = 16;
const MIN_COLUMN_SIZE = 60;
const MAX_COLUMN_SIZE = 800;
const SEARCH_SHORTCUT_KEY = "f";
const NON_NAVIGABLE_COLUMN_IDS = new Set(["select", "actions"]);
const AUTO_SCROLL_EDGE_ZONE = 50;
const AUTO_SCROLL_SPEED_RAMP_ZONE = AUTO_SCROLL_EDGE_ZONE * 3;
const AUTO_SCROLL_MIN_SPEED = 8;
const AUTO_SCROLL_MAX_SPEED = 40;
const AUTO_SCROLL_SELECTION_THROTTLE_MS = 32;

const DOMAIN_REGEX = /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/;
const TRUTHY_BOOLEANS = new Set(["true", "1", "yes", "checked"]);
const VALID_BOOLEANS = new Set([
  "true",
  "false",
  "1",
  "0",
  "yes",
  "no",
  "checked",
  "unchecked",
]);

function getIsDataColumn(columnId: string) {
  return !NON_NAVIGABLE_COLUMN_IDS.has(columnId);
}

function getCanEditColumnId<TData extends RowData>(
  table: Table<DataGridFeatures, TData>,
  columnId: string,
) {
  const column = table.getAllFlatColumnsById()[columnId];
  return column
    ? column.getCanEdit()
    : table.options.enableCellEditing !== false;
}

function setRowSelected(
  rowSelection: RowSelectionState,
  rowId: string,
  selected: boolean,
) {
  if (selected) {
    rowSelection[rowId] = true;
  } else {
    delete rowSelection[rowId];
  }
}

interface DataGridState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: ColumnVisibilityState;
  columnPinning: ColumnPinningState;
  columnOrder: ColumnOrderState;
  rowSelection: RowSelectionState;
  selectionState: SelectionState;
  focusedCell: CellPosition | null;
  /** Cut source keys laid out in the same rows and columns as the clipboard text. */
  cutCells: Array<Array<string | null>>;
  contextMenu: ContextMenuState;
  searchQuery: string;
  searchMatches: CellPosition[];
  matchIndex: number;
  searchOpen: boolean;
  lastClickedRowId: string | null;
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

interface UseDataGridProps<TData extends RowData> extends Omit<
  TableOptions<DataGridFeatures, TData>,
  "features"
> {
  onDataChange?: (data: TData[]) => void;
  onRowAdd?: (
    event?: React.MouseEvent<HTMLDivElement>,
  ) => Partial<CellPosition> | Promise<Partial<CellPosition> | null> | null;
  onRowsAdd?: (count: number) => void | Promise<void>;
  onRowsDelete?: (rows: TData[], rowIds: string[]) => void | Promise<void>;
  onPaste?: (updates: Array<CellUpdate>) => void | Promise<void>;
  onFilesUpload?: (params: {
    files: File[];
    rowId: string;
    columnId: string;
  }) => Promise<FileCellData[]>;
  onFilesDelete?: (params: {
    fileIds: string[];
    rowId: string;
    columnId: string;
  }) => void | Promise<void>;
  overscan?: number;
  dir?: Direction;
  autoFocus?: boolean | Partial<CellPosition>;
  enableSingleCellSelection?: boolean;
  enableColumnSelection?: boolean;
  enableSearch?: boolean;
  enablePaste?: boolean;
  readOnly?: boolean;
}

function useDataGrid<TData extends RowData>({
  data,
  columns,
  overscan = OVERSCAN,
  dir: dirProp,
  initialState,
  ...props
}: UseDataGridProps<TData>) {
  const contextDir = useDirection();
  const dir = dirProp ?? contextDir;
  const dataGridRef = React.useRef<HTMLDivElement>(null);
  const tableRef =
    React.useRef<ReturnType<typeof useTable<DataGridFeatures, TData>>>(null);
  const rowVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const rowMapRef = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const cellMapRef = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const footerRef = React.useRef<HTMLDivElement>(null);
  const focusGuardRef = React.useRef(false);

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
      columnVisibility: initialState?.columnVisibility ?? {},
      columnPinning: {
        start: initialState?.columnPinning?.start ?? [],
        end: initialState?.columnPinning?.end ?? [],
      },
      columnOrder: initialState?.columnOrder ?? [],
      rowSelection: initialState?.rowSelection ?? {},
      selectionState: {
        selectedCells: new Set(),
        selectionRange: null,
        isSelecting: false,
      },
      focusedCell: null,
      cutCells: [],
      contextMenu: {
        open: false,
        x: 0,
        y: 0,
      },
      searchQuery: "",
      searchMatches: [],
      matchIndex: -1,
      searchOpen: false,
      lastClickedRowId: null,
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
  const selectionState = useStore(store, (state) => state.selectionState);
  const searchQuery = useStore(store, (state) => state.searchQuery);
  const searchMatches = useStore(store, (state) => state.searchMatches);
  const matchIndex = useStore(store, (state) => state.matchIndex);
  const searchOpen = useStore(store, (state) => state.searchOpen);
  const sorting = useStore(store, (state) => state.sorting);
  const columnFilters = useStore(store, (state) => state.columnFilters);
  const storeColumnVisibility = useStore(
    store,
    (state) => state.columnVisibility,
  );
  const storeColumnPinning = useStore(store, (state) => state.columnPinning);
  const storeColumnOrder = useStore(store, (state) => state.columnOrder);
  const columnVisibility =
    props.state?.columnVisibility ?? storeColumnVisibility;
  const columnPinning = props.state?.columnPinning ?? storeColumnPinning;
  const columnOrder = props.state?.columnOrder ?? storeColumnOrder;
  const rowSelection = useStore(store, (state) => state.rowSelection);
  const contextMenu = useStore(store, (state) => state.contextMenu);
  const pasteDialog = useStore(store, (state) => state.pasteDialog);

  const prevCellSelectionMapRef = useLazyRef(
    () => new Map<string, Set<string>>(),
  );

  // Memoize per-row selection sets to prevent unnecessary row re-renders
  // Each row gets a stable Set reference that only changes when its cells' selection changes
  const cellSelectionMap = React.useMemo(() => {
    const selectedCells = selectionState.selectedCells;

    if (selectedCells.size === 0) {
      prevCellSelectionMapRef.current.clear();
      return null;
    }

    const newRowCells = new Map<string, Set<string>>();
    for (const cellKey of selectedCells) {
      const { rowId } = parseCellKey(cellKey);
      let rowSet = newRowCells.get(rowId);
      if (!rowSet) {
        rowSet = new Set<string>();
        newRowCells.set(rowId, rowSet);
      }
      rowSet.add(cellKey);
    }

    const stableMap = new Map<string, Set<string>>();
    for (const [rowId, newSet] of newRowCells) {
      const prevSet = prevCellSelectionMapRef.current.get(rowId);
      if (
        prevSet &&
        prevSet.size === newSet.size &&
        [...newSet].every((key) => prevSet.has(key))
      ) {
        stableMap.set(rowId, prevSet);
      } else {
        stableMap.set(rowId, newSet);
      }
    }

    prevCellSelectionMapRef.current = stableMap;
    return stableMap;
  }, [selectionState.selectedCells, prevCellSelectionMapRef]);

  const getRowIndex = React.useCallback((rowId: string) => {
    const currentTable = tableRef.current;
    return currentTable ? getRowIndexById(currentTable, rowId) : -1;
  }, []);

  const getRowIdAt = React.useCallback(
    (rowIndex: number) => tableRef.current?.getRowModel().rows[rowIndex]?.id,
    [],
  );

  const columnIds = React.useMemo(() => {
    return getVisibleColumnIds({
      columnIds: columns
        .map((c) => {
          if (c.id) return c.id;
          if ("accessorKey" in c) return c.accessorKey as string;
          return undefined;
        })
        .filter((id): id is string => Boolean(id)),
      columnVisibility,
      columnPinning,
      columnOrder,
    });
  }, [columns, columnVisibility, columnPinning, columnOrder]);

  const navigableColumnIds = React.useMemo(() => {
    return columnIds.filter((c) => !NON_NAVIGABLE_COLUMN_IDS.has(c));
  }, [columnIds]);

  const onDataUpdate = React.useCallback(
    (updates: CellUpdate | Array<CellUpdate>) => {
      if (propsRef.current.readOnly) return;

      const updateArray = Array.isArray(updates) ? updates : [updates];

      if (updateArray.length === 0) return;

      const currentTable = tableRef.current;
      if (!currentTable) return;

      const rowsById = currentTable.getCoreRowModel().rowsById;
      const currentData = propsRef.current.data;
      const rowUpdatesMap = new Map<
        number,
        { original: TData; updates: Array<Omit<CellUpdate, "rowId">> }
      >();

      for (const update of updateArray) {
        const row = rowsById[update.rowId];
        if (!row || !getCanEditColumnId(currentTable, update.columnId)) {
          continue;
        }

        let rowUpdates = rowUpdatesMap.get(row.index);
        if (!rowUpdates) {
          rowUpdates = { original: row.original, updates: [] };
          rowUpdatesMap.set(row.index, rowUpdates);
        }
        rowUpdates.updates.push({
          columnId: update.columnId,
          value: update.value,
        });
      }

      if (rowUpdatesMap.size === 0) return;

      const newData = [...currentData];

      for (const [dataIndex, { original, updates }] of rowUpdatesMap) {
        const updatedRow = Object.assign(
          {},
          (currentData[dataIndex] ?? original) as Record<string, unknown>,
        );
        for (const { columnId, value } of updates) {
          updatedRow[columnId] = value;
        }
        newData[dataIndex] = updatedRow as TData;
      }

      propsRef.current.onDataChange?.(newData);
    },
    [propsRef],
  );

  const getIsCellSelected = React.useCallback(
    (rowId: string, columnId: string) => {
      const currentSelectionState = store.getState().selectionState;
      return currentSelectionState.selectedCells.has(
        getCellKey(rowId, columnId),
      );
    },
    [store],
  );

  const onSelectionClear = React.useCallback(() => {
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
    const rows = tableRef.current?.getRowModel().rows ?? [];

    for (const row of rows) {
      for (const columnId of navigableColumnIds) {
        allCells.add(getCellKey(row.id, columnId));
      }
    }

    const firstRowId = rows[0]?.id;
    const lastRowId = rows[rows.length - 1]?.id;
    const firstColumnId = navigableColumnIds[0];
    const lastColumnId = navigableColumnIds[navigableColumnIds.length - 1];

    store.setState("selectionState", {
      selectedCells: allCells,
      selectionRange:
        firstRowId && lastRowId && firstColumnId && lastColumnId
          ? {
              start: { rowId: firstRowId, columnId: firstColumnId },
              end: { rowId: lastRowId, columnId: lastColumnId },
            }
          : null,
      isSelecting: false,
    });
  }, [navigableColumnIds, store]);

  const selectColumn = React.useCallback(
    (columnId: string) => {
      const rows = tableRef.current?.getRowModel().rows ?? [];
      const firstRowId = rows[0]?.id;
      const lastRowId = rows[rows.length - 1]?.id;

      if (!firstRowId || !lastRowId) return;

      const selectedCells = new Set<string>();

      for (const row of rows) {
        selectedCells.add(getCellKey(row.id, columnId));
      }

      store.setState("selectionState", {
        selectedCells,
        selectionRange: {
          start: { rowId: firstRowId, columnId },
          end: { rowId: lastRowId, columnId },
        },
        isSelecting: false,
      });
    },
    [store],
  );

  const selectRange = React.useCallback(
    (start: CellPosition, end: CellPosition, isSelecting = false) => {
      const rows = tableRef.current?.getRowModel().rows ?? [];
      const startRowIndex = getRowIndex(start.rowId);
      const endRowIndex = getRowIndex(end.rowId);
      const startColIndex = columnIds.indexOf(start.columnId);
      const endColIndex = columnIds.indexOf(end.columnId);

      const selectedCells = new Set<string>();

      if (startRowIndex !== -1 && endRowIndex !== -1) {
        const minRow = Math.min(startRowIndex, endRowIndex);
        const maxRow = Math.max(startRowIndex, endRowIndex);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);

        for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
          const rowId = rows[rowIndex]?.id;
          if (!rowId) continue;

          for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
            const columnId = columnIds[colIndex];
            if (columnId) {
              selectedCells.add(getCellKey(rowId, columnId));
            }
          }
        }
      }

      store.setState("selectionState", {
        selectedCells,
        selectionRange: { start, end },
        isSelecting,
      });
    },
    [columnIds, store, getRowIndex],
  );

  const serializeCellsToTsv = React.useCallback(() => {
    const currentState = store.getState();

    let selectedCellsArray: string[];
    if (!currentState.selectionState.selectedCells.size) {
      if (!currentState.focusedCell) return null;
      const focusedCellKey = getCellKey(
        currentState.focusedCell.rowId,
        currentState.focusedCell.columnId,
      );
      selectedCellsArray = [focusedCellKey];
    } else {
      selectedCellsArray = Array.from(
        currentState.selectionState.selectedCells,
      );
    }

    const currentTable = tableRef.current;
    const rowsById = currentTable?.getRowModel().rowsById;
    if (!rowsById) return null;

    const selectedColumnIds: string[] = [];
    const seenColumnIds = new Set<string>();
    const cellData = new Map<string, string>();
    const selectedRows = new Map<string, Row<DataGridFeatures, TData>>();
    const rowCellMaps = new Map<
      string,
      Map<
        string,
        ReturnType<Row<DataGridFeatures, TData>["getVisibleCells"]>[number]
      >
    >();
    const navigableCells: string[] = [];

    for (const cellKey of selectedCellsArray) {
      const { rowId, columnId } = parseCellKey(cellKey);

      if (columnId && NON_NAVIGABLE_COLUMN_IDS.has(columnId)) {
        continue;
      }

      navigableCells.push(cellKey);

      if (columnId && !seenColumnIds.has(columnId)) {
        seenColumnIds.add(columnId);
        selectedColumnIds.push(columnId);
      }

      const row = rowsById[rowId];
      if (row) {
        selectedRows.set(rowId, row);
        let cellMap = rowCellMaps.get(rowId);
        if (!cellMap) {
          cellMap = new Map(row.getVisibleCells().map((c) => [c.column.id, c]));
          rowCellMaps.set(rowId, cellMap);
        }
        const cell = cellMap.get(columnId);
        if (cell) {
          const value = cell.getValue();
          const cellVariant = cell.column.columnDef?.meta?.cell?.variant;

          let serializedValue = "";
          if (cellVariant === "file" || cellVariant === "multi-select") {
            serializedValue = value ? JSON.stringify(value) : "";
          } else if (value instanceof Date) {
            serializedValue = value.toISOString();
          } else {
            serializedValue = stringifyUnknown(value);
          }

          cellData.set(cellKey, serializedValue);
        }
      }
    }

    const colIndices = new Set<number>();
    for (const cellKey of navigableCells) {
      const { columnId } = parseCellKey(cellKey);
      const colIndex = selectedColumnIds.indexOf(columnId);
      if (colIndex >= 0) {
        colIndices.add(colIndex);
      }
    }

    const sortedRows = Array.from(selectedRows.values()).sort(
      (a, b) => a.getDisplayIndex() - b.getDisplayIndex(),
    );
    const sortedColIndices = Array.from(colIndices).sort((a, b) => a - b);
    const sortedColumnIds = sortedColIndices.map((i) => selectedColumnIds[i]);

    const navigableCellSet = new Set(navigableCells);
    const cellGrid = sortedRows.map((row) =>
      sortedColumnIds.map((columnId) => {
        if (!columnId) return null;
        const cellKey = getCellKey(row.id, columnId);
        return navigableCellSet.has(cellKey) ? cellKey : null;
      }),
    );

    const tsvData = sortedRows
      .map((row) =>
        sortedColumnIds
          .map((columnId) =>
            columnId ? (cellData.get(getCellKey(row.id, columnId)) ?? "") : "",
          )
          .join("\t"),
      )
      .join("\n");

    return { tsvData, cellGrid, selectedCellsArray: navigableCells };
  }, [store]);

  const onCellsCopy = React.useCallback(async () => {
    const result = serializeCellsToTsv();
    if (!result) return;

    const { tsvData, selectedCellsArray } = result;

    try {
      await navigator.clipboard.writeText(tsvData);

      const currentState = store.getState();
      if (currentState.cutCells.length > 0) {
        store.setState("cutCells", []);
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
  }, [store, serializeCellsToTsv]);

  const onCellsCut = React.useCallback(async () => {
    if (propsRef.current.readOnly) return;

    const result = serializeCellsToTsv();
    if (!result) return;

    const { tsvData, cellGrid, selectedCellsArray } = result;

    try {
      await navigator.clipboard.writeText(tsvData);

      store.setState("cutCells", cellGrid);

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
  }, [store, propsRef, serializeCellsToTsv]);

  const restoreFocus = React.useCallback((element: HTMLDivElement | null) => {
    if (element && document.activeElement !== element) {
      requestAnimationFrame(() => {
        element.focus();
      });
    }
  }, []);

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

        const rawPastedData = parseTsv(
          clipboardText,
          navigableColumnIds.length,
        );

        // Fill entire selection when clipboard has a single value and multiple cells are selected
        const selectionCells = currentState.selectionState.selectedCells;
        const isSingleCellClipboard =
          rawPastedData.length === 1 && (rawPastedData[0]?.length ?? 0) === 1;

        let pastedData = rawPastedData;
        let isFillPaste = false;
        let startRowIndex = getRowIndex(currentState.focusedCell.rowId);
        let startColIndex = navigableColumnIds.indexOf(
          currentState.focusedCell.columnId,
        );

        if (isSingleCellClipboard && selectionCells.size > 1) {
          const singleValue = rawPastedData[0]?.[0] ?? "";
          let minRow = Infinity;
          let maxRow = -Infinity;
          let minColIdx = Infinity;
          let maxColIdx = -Infinity;

          for (const cellKey of selectionCells) {
            const { rowId, columnId } = parseCellKey(cellKey);
            const rowIndex = getRowIndex(rowId);
            const colIdx = navigableColumnIds.indexOf(columnId);
            if (rowIndex === -1 || colIdx === -1) continue;
            minRow = Math.min(minRow, rowIndex);
            maxRow = Math.max(maxRow, rowIndex);
            minColIdx = Math.min(minColIdx, colIdx);
            maxColIdx = Math.max(maxColIdx, colIdx);
          }

          if (minRow !== Infinity) {
            startRowIndex = minRow;
            startColIndex = minColIdx;
            const numRows = maxRow - minRow + 1;
            const numCols = maxColIdx - minColIdx + 1;
            pastedData = Array.from({ length: numRows }, () =>
              Array.from({ length: numCols }, () => singleValue),
            );
            isFillPaste = true;
          }
        }

        if (startRowIndex === -1 || startColIndex === -1) return;

        const rowCount = rows.length;
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

        const updates: Array<CellUpdate> = [];
        const tableColumns = currentTable?.getAllColumns() ?? [];
        let cellsUpdated = 0;
        let endRowIndex = startRowIndex;
        let endColIndex = startColIndex;

        const updatedTable = tableRef.current;
        const updatedRows = updatedTable?.getRowModel().rows;

        let cellsSkipped = 0;
        const writtenCellKeys = new Set<string>();
        const movedSourceCellKeys = new Set<string>();

        const columnMap = new Map(tableColumns.map((c) => [c.id, c]));

        for (
          let pasteRowIdx = 0;
          pasteRowIdx < pastedData.length;
          pasteRowIdx++
        ) {
          const pasteRow = pastedData[pasteRowIdx];
          if (!pasteRow) continue;

          const targetRowIndex = startRowIndex + pasteRowIdx;
          const targetRowId = updatedRows?.[targetRowIndex]?.id;
          if (!targetRowId) break;

          for (
            let pasteColIdx = 0;
            pasteColIdx < pasteRow.length;
            pasteColIdx++
          ) {
            const targetColIndex = startColIndex + pasteColIdx;
            if (targetColIndex >= navigableColumnIds.length) break;

            const targetColumnId = navigableColumnIds[targetColIndex];
            if (!targetColumnId) continue;

            if (
              currentTable &&
              !getCanEditColumnId(currentTable, targetColumnId)
            ) {
              cellsSkipped++;
              endRowIndex = Math.max(endRowIndex, targetRowIndex);
              endColIndex = Math.max(endColIndex, targetColIndex);
              continue;
            }

            const pastedValue = pasteRow[pasteColIdx] ?? "";
            const column = columnMap.get(targetColumnId);
            const cellOpts = column?.columnDef?.meta?.cell;
            const cellVariant = cellOpts?.variant;

            let processedValue: unknown = pastedValue;
            let shouldSkip = false;

            switch (cellVariant) {
              case "number": {
                if (!pastedValue) {
                  processedValue = null;
                } else {
                  const num = Number.parseFloat(pastedValue);
                  if (Number.isNaN(num)) shouldSkip = true;
                  else processedValue = num;
                }
                break;
              }

              case "checkbox": {
                if (!pastedValue) {
                  processedValue = false;
                } else {
                  const lower = pastedValue.toLowerCase();
                  if (VALID_BOOLEANS.has(lower)) {
                    processedValue = TRUTHY_BOOLEANS.has(lower);
                  } else {
                    shouldSkip = true;
                  }
                }
                break;
              }

              case "date": {
                if (!pastedValue) {
                  processedValue = null;
                } else {
                  const date = new Date(pastedValue);
                  if (Number.isNaN(date.getTime())) shouldSkip = true;
                  else processedValue = date;
                }
                break;
              }

              case "select": {
                const options = cellOpts?.options ?? [];
                if (!pastedValue) {
                  processedValue = null;
                } else {
                  const matched = matchSelectOption(pastedValue, options);
                  if (matched) processedValue = matched;
                  else shouldSkip = true;
                }
                break;
              }

              case "multi-select": {
                const options = cellOpts?.options ?? [];
                let values: string[] = [];
                try {
                  const parsed = JSON.parse(pastedValue);
                  if (Array.isArray(parsed)) {
                    values = parsed.filter(
                      (v): v is string => typeof v === "string",
                    );
                  }
                } catch {
                  values = pastedValue
                    ? pastedValue.split(",").map((v) => v.trim())
                    : [];
                }

                const validated = values
                  .map((v) => matchSelectOption(v, options))
                  .filter(Boolean) as string[];

                if (values.length > 0 && validated.length === 0) {
                  shouldSkip = true;
                } else {
                  processedValue = validated;
                }
                break;
              }

              case "file": {
                if (!pastedValue) {
                  processedValue = [];
                } else {
                  try {
                    const parsed = JSON.parse(pastedValue);
                    if (!Array.isArray(parsed)) {
                      shouldSkip = true;
                    } else {
                      const validFiles = parsed.filter(getIsFileCellData);
                      if (parsed.length > 0 && validFiles.length === 0) {
                        shouldSkip = true;
                      } else {
                        processedValue = validFiles;
                      }
                    }
                  } catch {
                    shouldSkip = true;
                  }
                }
                break;
              }

              case "url": {
                if (!pastedValue) {
                  processedValue = "";
                } else {
                  const firstChar = pastedValue[0];
                  if (firstChar === "[" || firstChar === "{") {
                    shouldSkip = true;
                  } else {
                    try {
                      new URL(pastedValue);
                      processedValue = pastedValue;
                    } catch {
                      if (DOMAIN_REGEX.test(pastedValue)) {
                        processedValue = pastedValue;
                      } else {
                        shouldSkip = true;
                      }
                    }
                  }
                }
                break;
              }

              default: {
                if (!pastedValue) {
                  processedValue = "";
                  break;
                }

                if (ISO_DATE_REGEX.test(pastedValue)) {
                  const date = new Date(pastedValue);
                  if (!Number.isNaN(date.getTime())) {
                    processedValue = date.toLocaleDateString();
                    break;
                  }
                }

                const firstChar = pastedValue[0];
                if (
                  firstChar === "[" ||
                  firstChar === "{" ||
                  firstChar === "t" ||
                  firstChar === "f"
                ) {
                  try {
                    const parsed = JSON.parse(pastedValue);

                    if (Array.isArray(parsed)) {
                      if (
                        parsed.length > 0 &&
                        parsed.every(getIsFileCellData)
                      ) {
                        processedValue = parsed.map((f) => f.name).join(", ");
                      } else if (parsed.every((v) => typeof v === "string")) {
                        processedValue = (parsed as string[]).join(", ");
                      }
                    } else if (typeof parsed === "boolean") {
                      processedValue = parsed ? "Checked" : "Unchecked";
                    }
                  } catch {
                    const lower = pastedValue.toLowerCase();
                    if (lower === "true" || lower === "false") {
                      processedValue =
                        lower === "true" ? "Checked" : "Unchecked";
                    }
                  }
                }
              }
            }

            if (shouldSkip) {
              cellsSkipped++;
              endRowIndex = Math.max(endRowIndex, targetRowIndex);
              endColIndex = Math.max(endColIndex, targetColIndex);
              continue;
            }

            updates.push({
              rowId: targetRowId,
              columnId: targetColumnId,
              value: processedValue,
            });
            cellsUpdated++;
            writtenCellKeys.add(getCellKey(targetRowId, targetColumnId));

            const sourceCellKey = isFillPaste
              ? currentState.cutCells[0]?.[0]
              : currentState.cutCells[pasteRowIdx]?.[pasteColIdx];
            if (sourceCellKey) movedSourceCellKeys.add(sourceCellKey);

            endRowIndex = Math.max(endRowIndex, targetRowIndex);
            endColIndex = Math.max(endColIndex, targetColIndex);
          }
        }

        if (updates.length > 0) {
          if (propsRef.current.onPaste) {
            await propsRef.current.onPaste(updates);
          }

          const allUpdates = [...updates];

          if (currentState.cutCells.length > 0) {
            const columnById = new Map(tableColumns.map((c) => [c.id, c]));

            for (const cellKey of movedSourceCellKeys) {
              if (writtenCellKeys.has(cellKey)) continue;

              const { rowId, columnId } = parseCellKey(cellKey);
              const column = columnById.get(columnId);
              const cellVariant = column?.columnDef?.meta?.cell?.variant;
              const emptyValue = getEmptyCellValue(cellVariant);
              allUpdates.push({ rowId, columnId, value: emptyValue });
            }

            store.setState("cutCells", []);
          }

          onDataUpdate(allUpdates);

          if (cellsSkipped > 0) {
            toast.success(
              `${cellsUpdated} cell${
                cellsUpdated !== 1 ? "s" : ""
              } pasted, ${cellsSkipped} skipped`,
            );
          } else {
            toast.success(
              `${cellsUpdated} cell${cellsUpdated !== 1 ? "s" : ""} pasted`,
            );
          }

          const startRowId = updatedRows?.[startRowIndex]?.id;
          const endRowId = updatedRows?.[endRowIndex]?.id;
          const endColumnId = navigableColumnIds[endColIndex];
          if (startRowId && endRowId && endColumnId) {
            selectRange(
              {
                rowId: startRowId,
                columnId: currentState.focusedCell.columnId,
              },
              { rowId: endRowId, columnId: endColumnId },
            );
          }

          restoreFocus(dataGridRef.current);
        } else if (cellsSkipped > 0) {
          toast.error(
            `${cellsSkipped} cell${
              cellsSkipped !== 1 ? "s" : ""
            } skipped pasting for invalid data`,
          );
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
    [
      store,
      navigableColumnIds,
      propsRef,
      onDataUpdate,
      selectRange,
      restoreFocus,
      getRowIndex,
    ],
  );

  // Release focus guard after delay to allow async data re-renders to settle.
  // 300ms accounts for db sync and virtualized cell mounting
  const releaseFocusGuard = React.useCallback((immediate = false) => {
    if (immediate) {
      focusGuardRef.current = false;
      return;
    }

    setTimeout(() => {
      focusGuardRef.current = false;
    }, 300);
  }, []);

  const focusCellWrapper = React.useCallback(
    (rowId: string, columnId: string) => {
      focusGuardRef.current = true;

      requestAnimationFrame(() => {
        const cellKey = getCellKey(rowId, columnId);
        const cellWrapperElement = cellMapRef.current.get(cellKey);

        if (!cellWrapperElement) {
          const container = dataGridRef.current;
          if (container) {
            container.focus();
          }
          releaseFocusGuard();
          return;
        }

        getCellFocusTarget(cellWrapperElement).focus();
        releaseFocusGuard();
      });
    },
    [releaseFocusGuard],
  );

  const focusCell = React.useCallback(
    (rowId: string, columnId: string) => {
      store.batch(() => {
        store.setState("focusedCell", { rowId, columnId });
        tableRef.current?.setEditingCell(null);
      });

      const currentState = store.getState();

      if (currentState.searchOpen) return;

      focusCellWrapper(rowId, columnId);
    },
    [store, focusCellWrapper],
  );

  const onRowsDelete = React.useCallback(
    async (rowIds: string[]) => {
      if (
        propsRef.current.readOnly ||
        !propsRef.current.onRowsDelete ||
        rowIds.length === 0
      )
        return;

      const rowsById = tableRef.current?.getRowModel().rowsById;
      if (!rowsById) return;

      const currentState = store.getState();
      const currentFocusedColumn =
        currentState.focusedCell?.columnId ?? navigableColumnIds[0];

      const rowsToDelete: TData[] = [];
      const deletedRowIds: string[] = [];
      let minDeletedRowIndex = Infinity;
      for (const rowId of rowIds) {
        const row = rowsById[rowId];
        if (!row) continue;

        rowsToDelete.push(row.original);
        deletedRowIds.push(rowId);
        minDeletedRowIndex = Math.min(
          minDeletedRowIndex,
          row.getDisplayIndex(),
        );
      }

      if (rowsToDelete.length === 0) return;

      await propsRef.current.onRowsDelete(rowsToDelete, deletedRowIds);

      store.batch(() => {
        store.setState("selectionState", {
          selectedCells: new Set(),
          selectionRange: null,
          isSelecting: false,
        });
        store.setState("rowSelection", {});
        tableRef.current?.setEditingCell(null);
      });

      requestAnimationFrame(() => {
        const currentRows = tableRef.current?.getRowModel().rows ?? [];
        const targetRow =
          currentRows[Math.min(minDeletedRowIndex, currentRows.length - 1)];

        if (targetRow && currentFocusedColumn) {
          focusCell(targetRow.id, currentFocusedColumn);
        }
      });
    },
    [propsRef, store, navigableColumnIds, focusCell],
  );

  const navigateCell = React.useCallback(
    (direction: NavigationDirection) => {
      const currentState = store.getState();
      if (!currentState.focusedCell) return;

      const { rowId, columnId } = currentState.focusedCell;
      const rowIndex = getRowIndex(rowId);
      if (rowIndex === -1) return;

      const currentColIndex = navigableColumnIds.indexOf(columnId);
      const rowVirtualizer = rowVirtualizerRef.current;
      const rows = tableRef.current?.getRowModel().rows ?? [];
      const rowCount = rows.length;

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
        case "right": {
          const isNext = (direction === "right") !== isRtl;
          const adjacentColumnId =
            columnIds[columnIds.indexOf(columnId) + (isNext ? 1 : -1)];
          if (adjacentColumnId) newColumnId = adjacentColumnId;
          break;
        }
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
        case "ctrl+up":
          newRowIndex = 0;
          break;
        case "ctrl+down":
          newRowIndex = Math.max(0, rowCount - 1);
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
        case "pageleft":
          if (currentColIndex > 0) {
            const targetIndex = Math.max(
              0,
              currentColIndex - HORIZONTAL_PAGE_SIZE,
            );
            const targetColumnId = navigableColumnIds[targetIndex];
            if (targetColumnId) newColumnId = targetColumnId;
          }
          break;
        case "pageright":
          if (currentColIndex < navigableColumnIds.length - 1) {
            const targetIndex = Math.min(
              navigableColumnIds.length - 1,
              currentColIndex + HORIZONTAL_PAGE_SIZE,
            );
            const targetColumnId = navigableColumnIds[targetIndex];
            if (targetColumnId) newColumnId = targetColumnId;
          }
          break;
        case "tab":
        case "shift+tab": {
          const target = getTabTargetCell({
            rowIndex,
            columnId,
            columnIds,
            rowCount,
            isBackward: direction === "shift+tab",
            getIsColumnTabbable: getIsDataColumn,
          });
          if (target) {
            newRowIndex = target.rowIndex;
            newColumnId = target.columnId;
          }
          break;
        }
      }

      const newRowId = rows[newRowIndex]?.id;
      if (!newRowId) return;

      if (newRowIndex !== rowIndex || newColumnId !== columnId) {
        focusCell(newRowId, newColumnId);

        // Calculate and apply scrolls synchronously to avoid flashing
        const container = dataGridRef.current;
        if (!container) return;

        const targetRow = rowMapRef.current.get(newRowIndex);
        const cellKey = getCellKey(newRowId, newColumnId);
        const targetCell = cellMapRef.current.get(cellKey);

        // If target row is not rendered, scroll it into view first
        if (!targetRow) {
          if (rowVirtualizer) {
            const align =
              direction === "up" ||
              direction === "pageup" ||
              direction === "ctrl+up" ||
              direction === "ctrl+home" ||
              direction === "shift+tab"
                ? "start"
                : direction === "down" ||
                    direction === "pagedown" ||
                    direction === "ctrl+down" ||
                    direction === "ctrl+end" ||
                    direction === "tab"
                  ? "end"
                  : "center";

            rowVirtualizer.scrollToIndex(newRowIndex, { align });

            // Wait for row to render before horizontal scroll
            if (newColumnId !== columnId) {
              requestAnimationFrame(() => {
                const cellKeyRetry = getCellKey(newRowId, newColumnId);
                const targetCellRetry = cellMapRef.current.get(cellKeyRetry);

                if (targetCellRetry) {
                  const scrollDirection = getScrollDirection(direction);

                  scrollCellIntoView({
                    container,
                    targetCell: targetCellRetry,
                    tableRef,
                    viewportOffset: VIEWPORT_OFFSET,
                    direction: scrollDirection,
                    isRtl: dir === "rtl",
                  });
                }
              });
            }
          } else {
            // Use direct scroll calculation when virtualizer is not available
            const rowSize = tableRef.current?.getRowSize() ?? 0;
            container.scrollTop = newRowIndex * rowSize;
          }

          return;
        }

        // Vertical scrolling for rendered rows that changed
        if (newRowIndex !== rowIndex && targetRow) {
          requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();
            const headerHeight =
              headerRef.current?.getBoundingClientRect().height ?? 0;
            const footerHeight =
              footerRef.current?.getBoundingClientRect().height ?? 0;
            const viewportTop =
              containerRect.top + headerHeight + VIEWPORT_OFFSET;
            const viewportBottom =
              containerRect.bottom - footerHeight - VIEWPORT_OFFSET;

            const rowRect = targetRow.getBoundingClientRect();
            const isFullyVisible =
              rowRect.top >= viewportTop && rowRect.bottom <= viewportBottom;

            if (!isFullyVisible) {
              // Only apply vertical scroll for vertical navigation
              const isVerticalNavigation =
                direction === "up" ||
                direction === "down" ||
                direction === "pageup" ||
                direction === "pagedown" ||
                direction === "ctrl+up" ||
                direction === "ctrl+down" ||
                direction === "ctrl+home" ||
                direction === "ctrl+end" ||
                direction === "tab" ||
                direction === "shift+tab";

              if (isVerticalNavigation) {
                if (
                  direction === "down" ||
                  direction === "pagedown" ||
                  direction === "ctrl+down" ||
                  direction === "ctrl+end" ||
                  direction === "tab"
                ) {
                  container.scrollTop += rowRect.bottom - viewportBottom;
                } else {
                  container.scrollTop -= viewportTop - rowRect.top;
                }
              }
            }
          });
        }

        // Horizontal scrolling for rendered cells
        if (newColumnId !== columnId && targetCell) {
          requestAnimationFrame(() => {
            const scrollDirection = getScrollDirection(direction);

            scrollCellIntoView({
              container,
              targetCell,
              tableRef,
              viewportOffset: VIEWPORT_OFFSET,
              direction: scrollDirection,
              isRtl: dir === "rtl",
            });
          });
        }
      }
    },
    [dir, store, columnIds, navigableColumnIds, focusCell, getRowIndex],
  );

  const onCellEditingStart = React.useCallback(
    (rowId: string, columnId: string) => {
      const currentTable = tableRef.current;
      if (!currentTable || !getCanEditColumnId(currentTable, columnId)) return;

      store.batch(() => {
        store.setState("focusedCell", { rowId, columnId });
        tableRef.current?.setEditingCell({ rowId, columnId });
      });
    },
    [store],
  );

  const onCellEditingStop = React.useCallback(
    (opts?: { moveToNextRow?: boolean; direction?: NavigationDirection }) => {
      const currentEditing = tableRef.current?.getEditingCell();

      tableRef.current?.setEditingCell(null);

      if (opts?.moveToNextRow && currentEditing) {
        const { rowId, columnId } = currentEditing;
        const nextRowId = getRowIdAt(getRowIndex(rowId) + 1);

        if (nextRowId) {
          requestAnimationFrame(() => {
            focusCell(nextRowId, columnId);
          });
        }
      } else if (opts?.direction && currentEditing) {
        const { rowId, columnId } = currentEditing;
        focusCell(rowId, columnId);
        requestAnimationFrame(() => {
          navigateCell(opts.direction ?? "right");
        });
      } else if (currentEditing) {
        const { rowId, columnId } = currentEditing;
        focusCellWrapper(rowId, columnId);
      }
    },
    [store, focusCell, navigateCell, focusCellWrapper, getRowIndex, getRowIdAt],
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
            rowId: currentMatch.rowId,
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
      let firstMatchRowIndex = -1;
      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows ?? [];

      const lowerQuery = query.toLowerCase();

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!row) continue;

        const cellById = new Map(
          row.getVisibleCells().map((c) => [c.column.id, c]),
        );

        for (const columnId of columnIds) {
          const cell = cellById.get(columnId);
          if (!cell) continue;

          const value = cell.getValue();
          const stringValue = stringifyUnknown(value).toLowerCase();

          if (stringValue.includes(lowerQuery)) {
            if (firstMatchRowIndex === -1) firstMatchRowIndex = rowIndex;
            matches.push({ rowId: row.id, columnId });
          }
        }
      }

      store.batch(() => {
        store.setState("searchMatches", matches);
        store.setState("matchIndex", matches.length > 0 ? 0 : -1);
      });

      if (firstMatchRowIndex !== -1) {
        rowVirtualizerRef.current?.scrollToIndex(firstMatchRowIndex, {
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
    const matchRowIndex = match ? getRowIndex(match.rowId) : -1;

    if (match && matchRowIndex !== -1) {
      rowVirtualizerRef.current?.scrollToIndex(matchRowIndex, {
        align: "center",
      });

      requestAnimationFrame(() => {
        store.setState("matchIndex", prevIndex);
        requestAnimationFrame(() => {
          focusCell(match.rowId, match.columnId);
        });
      });
    }
  }, [store, focusCell, getRowIndex]);

  const onNavigateToNextMatch = React.useCallback(() => {
    const currentState = store.getState();
    if (currentState.searchMatches.length === 0) return;

    const nextIndex =
      (currentState.matchIndex + 1) % currentState.searchMatches.length;
    const match = currentState.searchMatches[nextIndex];
    const matchRowIndex = match ? getRowIndex(match.rowId) : -1;

    if (match && matchRowIndex !== -1) {
      rowVirtualizerRef.current?.scrollToIndex(matchRowIndex, {
        align: "center",
      });

      requestAnimationFrame(() => {
        store.setState("matchIndex", nextIndex);
        requestAnimationFrame(() => {
          focusCell(match.rowId, match.columnId);
        });
      });
    }
  }, [store, focusCell, getRowIndex]);

  const searchMatchSet = React.useMemo(() => {
    return new Set(searchMatches.map((m) => getCellKey(m.rowId, m.columnId)));
  }, [searchMatches]);

  const getIsSearchMatch = React.useCallback(
    (rowId: string, columnId: string) => {
      return searchMatchSet.has(getCellKey(rowId, columnId));
    },
    [searchMatchSet],
  );

  const getIsActiveSearchMatch = React.useCallback(
    (rowId: string, columnId: string) => {
      const currentState = store.getState();
      if (currentState.matchIndex < 0) return false;
      const currentMatch = currentState.searchMatches[currentState.matchIndex];
      return (
        currentMatch?.rowId === rowId && currentMatch?.columnId === columnId
      );
    },
    [store],
  );

  // Compute search match data for targeted row re-renders
  const searchMatchesByRow = React.useMemo(() => {
    if (searchMatches.length === 0) return null;
    const rowMap = new Map<string, Set<string>>();
    for (const match of searchMatches) {
      let columnSet = rowMap.get(match.rowId);
      if (!columnSet) {
        columnSet = new Set<string>();
        rowMap.set(match.rowId, columnSet);
      }
      columnSet.add(match.columnId);
    }
    return rowMap;
  }, [searchMatches]);

  const activeSearchMatch = React.useMemo<CellPosition | null>(() => {
    if (matchIndex < 0 || searchMatches.length === 0) return null;
    return searchMatches[matchIndex] ?? null;
  }, [searchMatches, matchIndex]);

  const blurCell = React.useCallback(() => {
    if (
      tableRef.current?.getEditingCell() &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }

    store.batch(() => {
      store.setState("focusedCell", null);
      tableRef.current?.setEditingCell(null);
    });
  }, [store]);

  const scrollToCell = React.useCallback(
    (rowId: string, columnId: string) => {
      requestAnimationFrame(() => {
        const container = dataGridRef.current;
        const cellKey = getCellKey(rowId, columnId);
        const targetCell = cellMapRef.current.get(cellKey);

        if (container && targetCell) {
          scrollCellIntoView({
            container,
            targetCell,
            tableRef,
            viewportOffset: VIEWPORT_OFFSET,
            isRtl: dir === "rtl",
          });
        }
      });
    },
    [dir],
  );

  const onCellClick = React.useCallback(
    (rowId: string, columnId: string, event?: React.MouseEvent) => {
      if (event?.button === 2) return;

      const currentState = store.getState();
      const currentFocused = currentState.focusedCell;

      if (event) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          const cellKey = getCellKey(rowId, columnId);
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
          focusCell(rowId, columnId);
          scrollToCell(rowId, columnId);
          return;
        }

        if (event.shiftKey && currentState.focusedCell) {
          event.preventDefault();
          selectRange(currentState.focusedCell, { rowId, columnId });
          scrollToCell(rowId, columnId);
          return;
        }
      }

      const hasSelectedCells =
        currentState.selectionState.selectedCells.size > 0;
      const hasSelectedRows = Object.keys(currentState.rowSelection).length > 0;

      if (hasSelectedCells && !currentState.selectionState.isSelecting) {
        const cellKey = getCellKey(rowId, columnId);
        const isClickingSelectedCell =
          currentState.selectionState.selectedCells.has(cellKey);

        if (!isClickingSelectedCell) {
          onSelectionClear();
        } else {
          focusCell(rowId, columnId);
          scrollToCell(rowId, columnId);
          return;
        }
      } else if (hasSelectedRows && columnId !== "select") {
        onSelectionClear();
      }

      if (
        currentFocused?.rowId === rowId &&
        currentFocused?.columnId === columnId
      ) {
        onCellEditingStart(rowId, columnId);
      } else {
        focusCell(rowId, columnId);
        scrollToCell(rowId, columnId);
      }
    },
    [
      store,
      focusCell,
      scrollToCell,
      onCellEditingStart,
      selectRange,
      onSelectionClear,
    ],
  );

  const onCellDoubleClick = React.useCallback(
    (rowId: string, columnId: string, event?: React.MouseEvent) => {
      if (event?.defaultPrevented) return;

      onCellEditingStart(rowId, columnId);
    },
    [onCellEditingStart],
  );

  const onCellMouseDown = React.useCallback(
    (rowId: string, columnId: string, event: React.MouseEvent) => {
      if (event.button === 2) {
        return;
      }

      event.preventDefault();

      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const cellKey = getCellKey(rowId, columnId);
        store.batch(() => {
          store.setState("selectionState", {
            selectedCells: propsRef.current.enableSingleCellSelection
              ? new Set([cellKey])
              : new Set(),
            selectionRange: {
              start: { rowId, columnId },
              end: { rowId, columnId },
            },
            isSelecting: true,
          });
          store.setState("rowSelection", {});
        });
      }
    },
    [store, propsRef],
  );

  const onCellMouseEnter = React.useCallback(
    (rowId: string, columnId: string) => {
      const currentState = store.getState();
      if (
        currentState.selectionState.isSelecting &&
        currentState.selectionState.selectionRange
      ) {
        const start = currentState.selectionState.selectionRange.start;
        const end = { rowId, columnId };

        if (
          currentState.focusedCell?.rowId !== start.rowId ||
          currentState.focusedCell?.columnId !== start.columnId
        ) {
          focusCell(start.rowId, start.columnId);
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
    (rowId: string, columnId: string, event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const currentState = store.getState();
      const cellKey = getCellKey(rowId, columnId);
      const isTargetCellSelected =
        currentState.selectionState.selectedCells.has(cellKey);

      if (!isTargetCellSelected) {
        store.batch(() => {
          store.setState("selectionState", {
            selectedCells: new Set([cellKey]),
            selectionRange: {
              start: { rowId, columnId },
              end: { rowId, columnId },
            },
            isSelecting: false,
          });
          store.setState("focusedCell", { rowId, columnId });
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

  const onSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      const currentState = store.getState();
      const newSorting =
        typeof updater === "function" ? updater(currentState.sorting) : updater;

      store.batch(() => {
        store.setState("sorting", newSorting);
      });

      propsRef.current.onSortingChange?.(newSorting);
    },
    [store, propsRef],
  );

  const onColumnVisibilityChange = React.useCallback(
    (updater: Updater<ColumnVisibilityState>) => {
      const currentState = store.getState();
      const newColumnVisibility =
        typeof updater === "function"
          ? updater(
              propsRef.current.state?.columnVisibility ??
                currentState.columnVisibility,
            )
          : updater;

      store.batch(() => {
        store.setState("columnVisibility", newColumnVisibility);

        const focusedColumnId = currentState.focusedCell?.columnId;
        if (focusedColumnId && newColumnVisibility[focusedColumnId] === false) {
          store.setState("focusedCell", null);
          tableRef.current?.setEditingCell(null);
        }
      });

      propsRef.current.onColumnVisibilityChange?.(newColumnVisibility);
    },
    [store, propsRef],
  );

  const onColumnPinningChange = React.useCallback(
    (updater: Updater<ColumnPinningState>) => {
      const currentState = store.getState();
      const newColumnPinning =
        typeof updater === "function"
          ? updater(
              propsRef.current.state?.columnPinning ??
                currentState.columnPinning,
            )
          : updater;

      store.setState("columnPinning", newColumnPinning);
      propsRef.current.onColumnPinningChange?.(newColumnPinning);
    },
    [store, propsRef],
  );

  const onColumnOrderChange = React.useCallback(
    (updater: Updater<ColumnOrderState>) => {
      const currentState = store.getState();
      const newColumnOrder =
        typeof updater === "function"
          ? updater(
              propsRef.current.state?.columnOrder ?? currentState.columnOrder,
            )
          : updater;

      store.setState("columnOrder", newColumnOrder);
      propsRef.current.onColumnOrderChange?.(newColumnOrder);
    },
    [store, propsRef],
  );

  const onColumnFiltersChange = React.useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      const currentState = store.getState();
      const newColumnFilters =
        typeof updater === "function"
          ? updater(currentState.columnFilters)
          : updater;

      store.batch(() => {
        store.setState("columnFilters", newColumnFilters);
      });

      propsRef.current.onColumnFiltersChange?.(newColumnFilters);
    },
    [store, propsRef],
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
      const rowsById = tableRef.current?.getRowModel().rowsById ?? {};

      for (const rowId of selectedRows) {
        if (!rowsById[rowId]) continue;

        for (const columnId of navigableColumnIds) {
          selectedCells.add(getCellKey(rowId, columnId));
        }
      }

      const isUtilityCellFocused =
        currentState.focusedCell !== null &&
        !getIsDataColumn(currentState.focusedCell.columnId);

      store.batch(() => {
        store.setState("rowSelection", newRowSelection);
        store.setState("selectionState", {
          selectedCells,
          selectionRange: null,
          isSelecting: false,
        });
        if (!isUtilityCellFocused) {
          store.setState("focusedCell", null);
          tableRef.current?.setEditingCell(null);
        }
      });

      propsRef.current.onRowSelectionChange?.(updater);
    },
    [store, navigableColumnIds, propsRef],
  );

  const onRowSelect = React.useCallback(
    (rowId: string, selected: boolean, shiftKey: boolean) => {
      const currentState = store.getState();
      const rows = tableRef.current?.getRowModel().rows ?? [];
      const currentRowIndex = rows.findIndex((r) => r.id === rowId);
      const currentRow = currentRowIndex >= 0 ? rows[currentRowIndex] : null;
      if (!currentRow) return;

      if (shiftKey && currentState.lastClickedRowId !== null) {
        const lastClickedRowIndex = rows.findIndex(
          (r) => r.id === currentState.lastClickedRowId,
        );
        if (lastClickedRowIndex >= 0) {
          const startIndex = Math.min(lastClickedRowIndex, currentRowIndex);
          const endIndex = Math.max(lastClickedRowIndex, currentRowIndex);

          const newRowSelection: RowSelectionState = {
            ...currentState.rowSelection,
          };

          for (let i = startIndex; i <= endIndex; i++) {
            const row = rows[i];
            if (row) {
              setRowSelected(newRowSelection, row.id, selected);
            }
          }

          onRowSelectionChange(newRowSelection);
        } else {
          const newRowSelection: RowSelectionState = {
            ...currentState.rowSelection,
          };
          setRowSelected(newRowSelection, currentRow.id, selected);
          onRowSelectionChange(newRowSelection);
        }
      } else {
        const newRowSelection: RowSelectionState = {
          ...currentState.rowSelection,
        };
        setRowSelected(newRowSelection, currentRow.id, selected);
        onRowSelectionChange(newRowSelection);
      }

      store.setState("lastClickedRowId", rowId);

      const focusedCell = store.getState().focusedCell;
      if (focusedCell && !getIsDataColumn(focusedCell.columnId)) {
        store.setState("focusedCell", { rowId, columnId: "select" });
      }
    },
    [store, onRowSelectionChange],
  );

  const onColumnClick = React.useCallback(
    (columnId: string) => {
      if (!propsRef.current.enableColumnSelection) {
        onSelectionClear();
        return;
      }

      selectColumn(columnId);
    },
    [propsRef, selectColumn, onSelectionClear],
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

  const defaultColumn: Partial<ColumnDef<DataGridFeatures, TData>> =
    React.useMemo(
      () => ({
        // Cell is rendered directly in DataGridRow to bypass flexRender's
        // unstable cell.getContext() (https://github.com/TanStack/table/issues/4794)
        minSize: MIN_COLUMN_SIZE,
        maxSize: MAX_COLUMN_SIZE,
      }),
      [],
    );

  const tableMeta = React.useMemo<DataGridTableMeta>(() => {
    return {
      ...propsRef.current.meta,
      dataGridRef,
      cellMapRef,
      get focusedCell() {
        return store.getState().focusedCell;
      },
      get editingCell() {
        return tableRef.current?.getEditingCell() ?? null;
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
      get readOnly() {
        return propsRef.current.readOnly;
      },
      getIsCellSelected,
      getIsSearchMatch,
      getIsActiveSearchMatch,
      scrollToCell: (rowId, columnId, align = "auto") => {
        const container = dataGridRef.current;
        const rowIndex = getRowIndex(rowId);
        if (!container || rowIndex === -1) return;

        rowVirtualizerRef.current?.scrollToIndex(rowIndex, { align });

        const scrollRowIntoView = (retries = 1) => {
          requestAnimationFrame(() => {
            const targetRow = rowMapRef.current.get(rowIndex);
            if (!targetRow) {
              if (retries > 0) scrollRowIntoView(retries - 1);
              return;
            }

            const headerBottom =
              headerRef.current?.getBoundingClientRect().bottom ??
              container.getBoundingClientRect().top;

            const viewportTop = headerBottom + VIEWPORT_OFFSET;

            const rowRect = targetRow.getBoundingClientRect();

            if (rowRect.top < viewportTop) {
              container.scrollTop -= viewportTop - rowRect.top;
            }

            const cellKey = getCellKey(rowId, columnId);
            const targetCell = cellMapRef.current.get(cellKey);
            if (targetCell) {
              scrollCellIntoView({
                container,
                targetCell,
                tableRef,
                viewportOffset: VIEWPORT_OFFSET,
                isRtl: dir === "rtl",
              });
            }
          });
        };

        scrollRowIntoView();
      },
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
      onCellsPaste,
      onSelectionClear,
      onFilesUpload: propsRef.current.onFilesUpload
        ? propsRef.current.onFilesUpload
        : undefined,
      onFilesDelete: propsRef.current.onFilesDelete
        ? propsRef.current.onFilesDelete
        : undefined,
      onContextMenuOpenChange,
      onPasteDialogOpenChange,
    };
  }, [
    propsRef,
    store,
    dir,
    getIsCellSelected,
    getIsSearchMatch,
    getIsActiveSearchMatch,
    getRowIndex,
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
    onCellsPaste,
    onSelectionClear,
    onContextMenuOpenChange,
    onPasteDialogOpenChange,
  ]);

  // Memoize state object to reduce shallow equality checks
  const tableState = React.useMemo<Partial<TableState<DataGridFeatures>>>(
    () => ({
      ...props.state,
      sorting,
      columnFilters,
      columnVisibility,
      columnPinning,
      columnOrder,
      rowSelection,
    }),
    [
      sorting,
      columnFilters,
      columnVisibility,
      columnPinning,
      columnOrder,
      rowSelection,
      props.state?.rowHeight,
      props.state?.editingCell,
    ],
  );

  const enableCellEditing =
    !props.readOnly && props.enableCellEditing !== false;
  const hasEditingCellChange = !!props.onEditingCellChange;
  const hasRowHeightChange = !!props.onRowHeightChange;

  const tableOptions = React.useMemo<
    TableOptions<DataGridFeatures, TData>
  >(() => {
    const {
      onEditingCellChange: _onEditingCellChange,
      onRowHeightChange: _onRowHeightChange,
      ...tableProps
    } = propsRef.current;

    return {
      ...tableProps,
      ...(hasEditingCellChange && {
        onEditingCellChange: (updater) =>
          propsRef.current.onEditingCellChange?.(updater),
      }),
      ...(hasRowHeightChange && {
        onRowHeightChange: (updater) =>
          propsRef.current.onRowHeightChange?.(updater),
      }),
      features: dataGridFeatures,
      data,
      columns,
      defaultColumn,
      initialState: propsRef.current.initialState,
      state: tableState,
      enableCellEditing,
      onRowSelectionChange,
      onSortingChange,
      onColumnFiltersChange,
      onColumnVisibilityChange,
      onColumnPinningChange,
      onColumnOrderChange,
      columnResizeMode: "onChange",
      columnResizeDirection: dir,
      meta: tableMeta,
    };
  }, [
    propsRef,
    data,
    columns,
    defaultColumn,
    tableState,
    enableCellEditing,
    hasEditingCellChange,
    hasRowHeightChange,
    dir,
    onRowSelectionChange,
    onSortingChange,
    onColumnFiltersChange,
    onColumnVisibilityChange,
    onColumnPinningChange,
    onColumnOrderChange,
    tableMeta,
  ]);

  const table = useTable(tableOptions);

  if (!tableRef.current) {
    tableRef.current = table;
  }

  const rowHeight = table.state.rowHeight;
  const editingCell = table.state.editingCell;
  const readOnlyColumnIds = React.useMemo(
    () =>
      new Set(
        table
          .getAllLeafColumns()
          .filter((column) => !column.getCanEdit())
          .map((column) => column.id),
      ),
    [table, columns, enableCellEditing],
  );
  const rowSize = table.getRowSize();

  const dragDepsRef = useAsRef({
    selectRange,
    dir,
    rowSize,
    columnIds,
  });

  const columnSizeVars = React.useMemo(() => {
    const headers = table.getFlatHeaders();
    const colSizes: { [key: string]: number } = {};
    for (const header of headers) {
      colSizes[`--header-${header.id}-size`] = header.getSize();
      colSizes[`--col-${header.column.id}-size`] = header.column.getSize();
    }
    return colSizes;
  }, [table.state.columnResizing, table.state.columnSizing]);

  const isFirefox = React.useSyncExternalStore(
    React.useCallback(() => () => {}, []),
    React.useCallback(() => {
      if (typeof window === "undefined" || typeof navigator === "undefined") {
        return false;
      }
      return navigator.userAgent.indexOf("Firefox") !== -1;
    }, []),
    React.useCallback(() => false, []),
  );

  const adjustLayout = React.useMemo(() => {
    const columnPinning = table.state.columnPinning;
    return (
      isFirefox &&
      ((columnPinning.start?.length ?? 0) > 0 ||
        (columnPinning.end?.length ?? 0) > 0)
    );
  }, [isFirefox, table.state.columnPinning]);

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: () => rowSize,
    overscan,
    measureElement: !isFirefox
      ? (element) => element?.getBoundingClientRect().height
      : undefined,
    scrollPaddingStart:
      (headerRef.current?.getBoundingClientRect().bottom ?? 0) -
      (dataGridRef.current?.getBoundingClientRect().top ?? 0) +
      VIEWPORT_OFFSET,
    // Add extra row buffer to absorb virtual position drift after render measurements
    scrollPaddingEnd:
      (dataGridRef.current?.getBoundingClientRect().bottom ?? 0) -
      (footerRef.current?.getBoundingClientRect().top ??
        dataGridRef.current?.getBoundingClientRect().bottom ??
        0) +
      rowSize +
      VIEWPORT_OFFSET,
  });

  if (!rowVirtualizerRef.current) {
    rowVirtualizerRef.current = rowVirtualizer;
  }

  const onScrollToRow = React.useCallback(
    async (opts: Partial<CellPosition> & { rowIndex?: number }) => {
      const { rowId, columnId } = opts;

      focusGuardRef.current = true;

      const targetColumnId = columnId ?? navigableColumnIds[0];

      if (!targetColumnId) {
        releaseFocusGuard(true);
        return;
      }

      async function onScrollAndFocus(retryCount: number) {
        if (!targetColumnId) return;
        const rows = tableRef.current?.getRowModel().rows ?? [];
        const rowIndex =
          rowId !== undefined ? getRowIndex(rowId) : (opts.rowIndex ?? 0);

        // If the requested row doesn't exist yet, wait for data to update
        if ((rowIndex === -1 || rowIndex >= rows.length) && retryCount > 0) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          await onScrollAndFocus(retryCount - 1);
          return;
        }

        const safeRowIndex =
          rowIndex === -1
            ? rows.length - 1
            : Math.min(rowIndex, rows.length - 1);
        const safeRowId = rows[safeRowIndex]?.id;

        if (!safeRowId) {
          releaseFocusGuard();
          return;
        }

        const currentRowCount = rows.length;

        const isBottomHalf = safeRowIndex > currentRowCount / 2;
        rowVirtualizer.scrollToIndex(safeRowIndex, {
          align: isBottomHalf ? "end" : "start",
        });

        await new Promise((resolve) => requestAnimationFrame(resolve));

        // Adjust scroll position to account for sticky header/footer
        const container = dataGridRef.current;
        const targetRow = rowMapRef.current.get(safeRowIndex);

        if (container && targetRow) {
          const containerRect = container.getBoundingClientRect();
          const headerHeight =
            headerRef.current?.getBoundingClientRect().height ?? 0;
          const footerHeight =
            footerRef.current?.getBoundingClientRect().height ?? 0;

          const viewportTop =
            containerRect.top + headerHeight + VIEWPORT_OFFSET;
          const viewportBottom =
            containerRect.bottom - footerHeight - VIEWPORT_OFFSET;

          const rowRect = targetRow.getBoundingClientRect();
          const isFullyVisible =
            rowRect.top >= viewportTop && rowRect.bottom <= viewportBottom;

          if (!isFullyVisible) {
            if (rowRect.top < viewportTop) {
              // Scroll up as row is partially hidden by header
              container.scrollTop -= viewportTop - rowRect.top;
            } else if (rowRect.bottom > viewportBottom) {
              // Scroll down as row is partially hidden by footer
              container.scrollTop += rowRect.bottom - viewportBottom;
            }
          }
        }

        store.batch(() => {
          store.setState("focusedCell", {
            rowId: safeRowId,
            columnId: targetColumnId,
          });
          tableRef.current?.setEditingCell(null);
        });

        const cellKey = getCellKey(safeRowId, targetColumnId);
        const cellElement = cellMapRef.current.get(cellKey);

        if (cellElement) {
          getCellFocusTarget(cellElement).focus();
          releaseFocusGuard();
        } else if (retryCount > 0) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          await onScrollAndFocus(retryCount - 1);
        } else {
          dataGridRef.current?.focus();
          releaseFocusGuard();
        }
      }

      await onScrollAndFocus(SCROLL_SYNC_RETRY_COUNT);
    },
    [rowVirtualizer, store, releaseFocusGuard, navigableColumnIds, getRowIndex],
  );

  const onRowAdd = React.useCallback(
    async (event?: React.MouseEvent<HTMLDivElement>) => {
      if (propsRef.current.readOnly || !propsRef.current.onRowAdd) return;

      const initialRowCount = tableRef.current?.getRowModel().rows.length ?? 0;

      let result: Partial<CellPosition> | null;
      try {
        result = await propsRef.current.onRowAdd(event);
      } catch {
        // Callback threw an error, don't proceed with scroll/focus
        return;
      }

      if (result === null || event?.defaultPrevented) return;

      onSelectionClear();

      // onScrollToRow will handle retries if the row isn't rendered yet
      void onScrollToRow({
        rowId: result.rowId,
        rowIndex: initialRowCount,
        columnId: result.columnId,
      });
    },
    [propsRef, onScrollToRow, onSelectionClear],
  );

  const getColumnHeaderTrigger = React.useCallback((columnId: string) => {
    return (
      headerRef.current?.querySelector<HTMLElement>(
        `[data-slot="grid-header-cell"][data-column-id="${CSS.escape(columnId)}"] :is(button, [role="checkbox"])`,
      ) ?? null
    );
  }, []);

  const focusColumnHeader = React.useCallback(
    (columnId: string) => {
      const trigger = getColumnHeaderTrigger(columnId);
      if (!trigger) return false;

      const currentState = store.getState();
      if (
        currentState.selectionState.selectedCells.size > 0 &&
        Object.keys(currentState.rowSelection).length === 0
      ) {
        onSelectionClear();
      }
      store.batch(() => {
        store.setState("focusedCell", null);
        tableRef.current?.setEditingCell(null);
      });
      trigger.focus();
      return true;
    },
    [store, getColumnHeaderTrigger, onSelectionClear],
  );

  const onGridTabBackOut = React.useCallback(() => {
    const container = dataGridRef.current;
    if (!container) return;

    // The container precedes every cell in the tab order, so it has to drop out
    // until the browser finishes moving focus or Shift+Tab would land on it.
    container.tabIndex = -1;
    requestAnimationFrame(() => {
      container.tabIndex = 0;
    });
  }, []);

  const onColumnHeaderKeyDown = React.useCallback(
    (event: KeyboardEvent, columnId: string) => {
      const { key, shiftKey, ctrlKey, metaKey, altKey } = event;
      if (ctrlKey || metaKey || altKey) return false;

      const headerColumnIds = columnIds.filter((id) =>
        getColumnHeaderTrigger(id),
      );
      const headerIndex = headerColumnIds.indexOf(columnId);
      if (headerIndex === -1) return false;

      const rowCount = tableRef.current?.getRowModel().rows.length ?? 0;
      const isRtl = dir === "rtl";

      function focusHeaderAt(index: number) {
        const targetColumnId = headerColumnIds[index];
        if (targetColumnId) focusColumnHeader(targetColumnId);
      }

      switch (key) {
        case "ArrowLeft":
        case "ArrowRight": {
          const isNext = (key === "ArrowRight") !== isRtl;
          focusHeaderAt(headerIndex + (isNext ? 1 : -1));
          break;
        }
        case "Home":
          focusHeaderAt(0);
          break;
        case "End":
          focusHeaderAt(headerColumnIds.length - 1);
          break;
        case "ArrowUp":
          break;
        case "ArrowDown":
          // Stops the menu trigger from opening its menu on ArrowDown
          event.stopPropagation();
          if (rowCount > 0) void onScrollToRow({ rowIndex: 0, columnId });
          break;
        case "Escape":
          dataGridRef.current?.focus();
          break;
        case "Tab":
          if (shiftKey) {
            if (headerIndex === 0) {
              onGridTabBackOut();
              return true;
            }
            focusHeaderAt(headerIndex - 1);
          } else if (headerIndex < headerColumnIds.length - 1) {
            focusHeaderAt(headerIndex + 1);
          } else {
            const firstColumnId = navigableColumnIds[0];
            if (rowCount === 0 || !firstColumnId) return true;
            void onScrollToRow({ rowIndex: 0, columnId: firstColumnId });
          }
          break;
        default:
          return false;
      }

      event.preventDefault();
      return true;
    },
    [
      dir,
      columnIds,
      navigableColumnIds,
      getColumnHeaderTrigger,
      focusColumnHeader,
      onGridTabBackOut,
      onScrollToRow,
    ],
  );

  const onDataGridKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      const currentState = store.getState();
      const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
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
        !tableRef.current?.getEditingCell()
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

      // Cell editing keyboard events (Enter, Tab, Escape) are handled by the cell variants
      // to ensure proper value commitment before navigation
      if (tableRef.current?.getEditingCell()) return;

      const headerCell =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-slot="grid-header-cell"]')
          : null;
      const headerColumnId = headerCell?.dataset.columnId;
      if (headerColumnId && onColumnHeaderKeyDown(event, headerColumnId)) {
        return;
      }

      if (
        isCtrlPressed &&
        (key === "Backspace" || key === "Delete") &&
        !propsRef.current.readOnly &&
        propsRef.current.onRowsDelete
      ) {
        const rowIds = new Set<string>();

        if (Object.keys(currentState.rowSelection).length > 0) {
          const rows = tableRef.current?.getRowModel().rows ?? [];
          for (const row of rows) {
            if (currentState.rowSelection[row.id]) {
              rowIds.add(row.id);
            }
          }
        } else if (currentState.selectionState.selectedCells.size > 0) {
          for (const cellKey of currentState.selectionState.selectedCells) {
            rowIds.add(parseCellKey(cellKey).rowId);
          }
        } else if (currentState.focusedCell) {
          rowIds.add(currentState.focusedCell.rowId);
        }

        if (rowIds.size > 0) {
          event.preventDefault();
          void onRowsDelete(Array.from(rowIds));
        }
        return;
      }

      if (!currentState.focusedCell) return;

      let direction: NavigationDirection | null = null;

      const isUtilityCellFocused = !getIsDataColumn(
        currentState.focusedCell.columnId,
      );

      if (
        isUtilityCellFocused &&
        shiftKey &&
        (key.startsWith("Arrow") ||
          key === "Home" ||
          key === "End" ||
          key === "PageUp" ||
          key === "PageDown")
      ) {
        event.preventDefault();
        return;
      }

      if (isCtrlPressed && !shiftKey && key === "a") {
        event.preventDefault();
        selectAll();
        return;
      }

      if (isCtrlPressed && !shiftKey && key === "c" && !isUtilityCellFocused) {
        event.preventDefault();
        void onCellsCopy();
        return;
      }

      if (
        isCtrlPressed &&
        !shiftKey &&
        key === "x" &&
        !isUtilityCellFocused &&
        !propsRef.current.readOnly
      ) {
        event.preventDefault();
        void onCellsCut();
        return;
      }

      if (
        propsRef.current.enablePaste &&
        isCtrlPressed &&
        !shiftKey &&
        key === "v" &&
        !isUtilityCellFocused &&
        !propsRef.current.readOnly
      ) {
        event.preventDefault();
        void onCellsPaste();
        return;
      }

      if (
        (key === "Delete" || key === "Backspace") &&
        !isCtrlPressed &&
        !isUtilityCellFocused &&
        !propsRef.current.readOnly
      ) {
        const cellsToClear =
          currentState.selectionState.selectedCells.size > 0
            ? Array.from(currentState.selectionState.selectedCells)
            : currentState.focusedCell
              ? [
                  getCellKey(
                    currentState.focusedCell.rowId,
                    currentState.focusedCell.columnId,
                  ),
                ]
              : [];

        if (cellsToClear.length > 0) {
          event.preventDefault();

          const updates: Array<CellUpdate> = [];

          const currentTable = tableRef.current;
          const tableColumns = currentTable?.getAllColumns() ?? [];
          const columnById = new Map(tableColumns.map((c) => [c.id, c]));

          for (const cellKey of cellsToClear) {
            const { rowId, columnId } = parseCellKey(cellKey);
            const column = columnById.get(columnId);
            const cellVariant = column?.columnDef?.meta?.cell?.variant;
            const emptyValue = getEmptyCellValue(cellVariant);
            updates.push({ rowId, columnId, value: emptyValue });
          }

          onDataUpdate(updates);

          if (currentState.selectionState.selectedCells.size > 0) {
            onSelectionClear();
          }

          if (currentState.cutCells.length > 0) {
            store.setState("cutCells", []);
          }
        }
        return;
      }

      if (
        key === "Enter" &&
        shiftKey &&
        !propsRef.current.readOnly &&
        propsRef.current.onRowAdd
      ) {
        event.preventDefault();
        const initialRowCount =
          tableRef.current?.getRowModel().rows.length ?? 0;
        const currentColumnId = isUtilityCellFocused
          ? navigableColumnIds[0]
          : currentState.focusedCell.columnId;

        Promise.resolve(propsRef.current.onRowAdd())
          .then(async (result) => {
            if (result === null) return;

            onSelectionClear();

            void onScrollToRow({
              rowId: result.rowId,
              rowIndex: initialRowCount,
              columnId: result.columnId ?? currentColumnId,
            });
          })
          .catch(() => {
            // Callback threw an error, don't proceed with scroll/focus
          });
        return;
      }

      switch (key) {
        case "ArrowUp":
          if (altKey && !isCtrlPressed && !shiftKey) {
            direction = "pageup";
          } else if (isCtrlPressed && shiftKey) {
            const selectionEdge =
              currentState.selectionState.selectionRange?.end ||
              currentState.focusedCell;
            const currentColIndex = navigableColumnIds.indexOf(
              selectionEdge.columnId,
            );
            const selectionStart =
              currentState.selectionState.selectionRange?.start ||
              currentState.focusedCell;
            const firstRowId = getRowIdAt(0);

            if (firstRowId) {
              selectRange(selectionStart, {
                rowId: firstRowId,
                columnId:
                  navigableColumnIds[currentColIndex] ?? selectionEdge.columnId,
              });
            }

            const rowVirtualizer = rowVirtualizerRef.current;
            if (rowVirtualizer) {
              rowVirtualizer.scrollToIndex(0, { align: "start" });
            }

            restoreFocus(dataGridRef.current);

            event.preventDefault();
            return;
          } else if (isCtrlPressed && !shiftKey) {
            direction = "ctrl+up";
          } else if (
            !shiftKey &&
            getRowIndex(currentState.focusedCell.rowId) === 0 &&
            focusColumnHeader(currentState.focusedCell.columnId)
          ) {
            event.preventDefault();
            return;
          } else {
            direction = "up";
          }
          break;
        case "ArrowDown":
          if (altKey && !isCtrlPressed && !shiftKey) {
            direction = "pagedown";
          } else if (isCtrlPressed && shiftKey) {
            const rowCount = tableRef.current?.getRowModel().rows.length ?? 0;
            const selectionEdge =
              currentState.selectionState.selectionRange?.end ||
              currentState.focusedCell;
            const currentColIndex = navigableColumnIds.indexOf(
              selectionEdge.columnId,
            );
            const selectionStart =
              currentState.selectionState.selectionRange?.start ||
              currentState.focusedCell;
            const lastRowId = getRowIdAt(rowCount - 1);

            if (lastRowId) {
              selectRange(selectionStart, {
                rowId: lastRowId,
                columnId:
                  navigableColumnIds[currentColIndex] ?? selectionEdge.columnId,
              });
            }

            const rowVirtualizer = rowVirtualizerRef.current;
            if (rowVirtualizer) {
              rowVirtualizer.scrollToIndex(Math.max(0, rowCount - 1), {
                align: "end",
              });
            }

            restoreFocus(dataGridRef.current);

            event.preventDefault();
            return;
          } else if (isCtrlPressed && !shiftKey) {
            direction = "ctrl+down";
          } else {
            direction = "down";
          }
          break;
        case "ArrowLeft":
          if (isCtrlPressed && shiftKey) {
            const selectionEdge =
              currentState.selectionState.selectionRange?.end ||
              currentState.focusedCell;
            const selectionStart =
              currentState.selectionState.selectionRange?.start ||
              currentState.focusedCell;
            const targetColumnId =
              dir === "rtl"
                ? navigableColumnIds[navigableColumnIds.length - 1]
                : navigableColumnIds[0];

            if (targetColumnId) {
              selectRange(selectionStart, {
                rowId: selectionEdge.rowId,
                columnId: targetColumnId,
              });

              const container = dataGridRef.current;
              const cellKey = getCellKey(selectionEdge.rowId, targetColumnId);
              const targetCell = cellMapRef.current.get(cellKey);
              if (container && targetCell) {
                scrollCellIntoView({
                  container,
                  targetCell,
                  tableRef,
                  viewportOffset: VIEWPORT_OFFSET,
                  direction: "home",
                  isRtl: dir === "rtl",
                });
              }

              restoreFocus(container);
            }
            event.preventDefault();
            return;
          } else if (isCtrlPressed && !shiftKey) {
            direction = "home";
          } else {
            direction = "left";
          }
          break;
        case "ArrowRight":
          if (isCtrlPressed && shiftKey) {
            const selectionEdge =
              currentState.selectionState.selectionRange?.end ||
              currentState.focusedCell;
            const selectionStart =
              currentState.selectionState.selectionRange?.start ||
              currentState.focusedCell;
            const targetColumnId =
              dir === "rtl"
                ? navigableColumnIds[0]
                : navigableColumnIds[navigableColumnIds.length - 1];

            if (targetColumnId) {
              selectRange(selectionStart, {
                rowId: selectionEdge.rowId,
                columnId: targetColumnId,
              });

              const container = dataGridRef.current;
              const cellKey = getCellKey(selectionEdge.rowId, targetColumnId);
              const targetCell = cellMapRef.current.get(cellKey);
              if (container && targetCell) {
                scrollCellIntoView({
                  container,
                  targetCell,
                  tableRef,
                  viewportOffset: VIEWPORT_OFFSET,
                  direction: "end",
                  isRtl: dir === "rtl",
                });
              }

              restoreFocus(container);
            }
            event.preventDefault();
            return;
          } else if (isCtrlPressed && !shiftKey) {
            direction = "end";
          } else {
            direction = "right";
          }
          break;
        case "Home":
          direction = isCtrlPressed ? "ctrl+home" : "home";
          break;
        case "End":
          direction = isCtrlPressed ? "ctrl+end" : "end";
          break;
        case "PageUp":
          direction = altKey ? "pageleft" : "pageup";
          break;
        case "PageDown":
          direction = altKey ? "pageright" : "pagedown";
          break;
        case "Escape":
          event.preventDefault();
          if (
            currentState.selectionState.selectedCells.size > 0 ||
            Object.keys(currentState.rowSelection).length > 0
          ) {
            onSelectionClear();
          } else {
            blurCell();
            dataGridRef.current?.focus();
          }
          return;
        case "Tab": {
          if (isCtrlPressed || altKey) return;

          const tabTarget = getTabTargetCell({
            rowIndex: getRowIndex(currentState.focusedCell.rowId),
            columnId: currentState.focusedCell.columnId,
            columnIds,
            rowCount: tableRef.current?.getRowModel().rows.length ?? 0,
            isBackward: shiftKey,
            getIsColumnTabbable: getIsDataColumn,
          });

          if (!tabTarget) {
            if (shiftKey) onGridTabBackOut();
            return;
          }

          direction = shiftKey ? "shift+tab" : "tab";
          break;
        }
      }

      if (direction) {
        event.preventDefault();

        if (shiftKey && key !== "Tab" && currentState.focusedCell) {
          const selectionEdge =
            currentState.selectionState.selectionRange?.end ||
            currentState.focusedCell;

          const currentColIndex = navigableColumnIds.indexOf(
            selectionEdge.columnId,
          );
          const edgeRowIndex = getRowIndex(selectionEdge.rowId);
          if (edgeRowIndex === -1) return;

          let newRowIndex = edgeRowIndex;
          let newColumnId = selectionEdge.columnId;

          const isRtl = dir === "rtl";

          const rowCount = tableRef.current?.getRowModel().rows.length ?? 0;

          switch (direction) {
            case "up":
              newRowIndex = Math.max(0, edgeRowIndex - 1);
              break;
            case "down":
              newRowIndex = Math.min(rowCount - 1, edgeRowIndex + 1);
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
                newColumnId = navigableColumnIds[0] ?? newColumnId;
              }
              break;
            case "end":
              if (navigableColumnIds.length > 0) {
                newColumnId =
                  navigableColumnIds[navigableColumnIds.length - 1] ??
                  newColumnId;
              }
              break;
          }

          const selectionStart =
            currentState.selectionState.selectionRange?.start ||
            currentState.focusedCell;
          const newRowId = getRowIdAt(newRowIndex);
          if (!newRowId) return;

          selectRange(selectionStart, {
            rowId: newRowId,
            columnId: newColumnId,
          });

          const container = dataGridRef.current;
          const targetRow = rowMapRef.current.get(newRowIndex);
          const cellKey = getCellKey(newRowId, newColumnId);
          const targetCell = cellMapRef.current.get(cellKey);

          if (
            newRowIndex !== edgeRowIndex &&
            (direction === "up" || direction === "down")
          ) {
            if (container && targetRow) {
              const containerRect = container.getBoundingClientRect();
              const headerHeight =
                headerRef.current?.getBoundingClientRect().height ?? 0;
              const footerHeight =
                footerRef.current?.getBoundingClientRect().height ?? 0;

              const viewportTop =
                containerRect.top + headerHeight + VIEWPORT_OFFSET;
              const viewportBottom =
                containerRect.bottom - footerHeight - VIEWPORT_OFFSET;

              const rowRect = targetRow.getBoundingClientRect();
              const isFullyVisible =
                rowRect.top >= viewportTop && rowRect.bottom <= viewportBottom;

              if (!isFullyVisible) {
                const scrollNeeded =
                  direction === "down"
                    ? rowRect.bottom - viewportBottom
                    : viewportTop - rowRect.top;

                if (direction === "down") {
                  container.scrollTop += scrollNeeded;
                } else {
                  container.scrollTop -= scrollNeeded;
                }

                restoreFocus(container);
              }
            } else {
              const rowVirtualizer = rowVirtualizerRef.current;
              if (rowVirtualizer) {
                const align = direction === "up" ? "start" : "end";
                rowVirtualizer.scrollToIndex(newRowIndex, { align });

                restoreFocus(container);
              }
            }
          }

          if (
            newColumnId !== selectionEdge.columnId &&
            (direction === "left" ||
              direction === "right" ||
              direction === "home" ||
              direction === "end")
          ) {
            if (container && targetCell) {
              scrollCellIntoView({
                container,
                targetCell,
                tableRef,
                viewportOffset: VIEWPORT_OFFSET,
                direction,
                isRtl,
              });
            }
          }
        } else {
          const isMovingWithinUtilityColumn =
            isUtilityCellFocused &&
            (direction === "up" ||
              direction === "down" ||
              direction === "pageup" ||
              direction === "pagedown" ||
              direction === "ctrl+up" ||
              direction === "ctrl+down");

          if (
            currentState.selectionState.selectedCells.size > 0 &&
            !isMovingWithinUtilityColumn
          ) {
            onSelectionClear();
          }
          navigateCell(direction);
        }
      }
    },
    [
      dir,
      store,
      propsRef,
      columnIds,
      blurCell,
      navigateCell,
      selectAll,
      onCellsCopy,
      onCellsCut,
      onCellsPaste,
      onDataUpdate,
      onSelectionClear,
      navigableColumnIds,
      selectRange,
      onSearchOpenChange,
      onNavigateToNextMatch,
      onNavigateToPrevMatch,
      onRowsDelete,
      restoreFocus,
      onScrollToRow,
      focusColumnHeader,
      onColumnHeaderKeyDown,
      onGridTabBackOut,
      getRowIndex,
      getRowIdAt,
    ],
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

          const nextSearchOpen = !store.getState().searchOpen;
          onSearchOpenChange(nextSearchOpen);

          if (nextSearchOpen && !isInDataGrid && !isInSearchInput) {
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
          onSelectionClear();
        }
      }
    }

    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown, true);
    };
  }, [propsRef, onSearchOpenChange, store, onSelectionClear]);

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
          const firstRowId = tableRef.current?.getRowModel().rows[0]?.id;

          if (typeof autoFocus === "object") {
            const rowId = autoFocus.rowId ?? firstRowId;
            if (rowId && autoFocus.columnId) {
              focusCell(rowId, autoFocus.columnId);
            }
            return;
          }

          const firstColumnId = navigableColumnIds[0];
          if (firstRowId && firstColumnId) {
            focusCell(firstRowId, firstColumnId);
          }
        });
        return () => cancelAnimationFrame(rafId);
      }
    }
  }, [store, propsRef, data, columns, navigableColumnIds, focusCell]);

  // Forward keyboard focus entering the grid to the active cell, so the grid acts as a single tab stop
  React.useEffect(() => {
    const container = dataGridRef.current;
    if (!container) return;

    let isPointerFocus = false;

    function onPointerDown() {
      isPointerFocus = true;
    }

    function onPointerUp() {
      isPointerFocus = false;
    }

    function getFirstVisibleRowIndex() {
      const currentContainer = dataGridRef.current;
      if (!currentContainer) return 0;

      const viewportTop =
        currentContainer.getBoundingClientRect().top +
        (headerRef.current?.getBoundingClientRect().height ?? 0);

      let firstRowIndex: number | null = null;
      for (const [rowIndex, rowElement] of rowMapRef.current) {
        if (
          rowElement.getBoundingClientRect().top >= viewportTop - 1 &&
          (firstRowIndex === null || rowIndex < firstRowIndex)
        ) {
          firstRowIndex = rowIndex;
        }
      }
      return firstRowIndex ?? 0;
    }

    function onFocus(event: FocusEvent) {
      const wasPointerFocus = isPointerFocus;
      isPointerFocus = false;
      if (wasPointerFocus || focusGuardRef.current) return;

      const currentContainer = dataGridRef.current;
      const relatedTarget = event.relatedTarget;
      if (
        !currentContainer ||
        !(relatedTarget instanceof Node) ||
        currentContainer.contains(relatedTarget)
      ) {
        return;
      }

      const currentState = store.getState();
      if (tableRef.current?.getEditingCell() || currentState.searchOpen) return;

      if (currentState.focusedCell) {
        const { rowId, columnId } = currentState.focusedCell;
        const cellElement = cellMapRef.current.get(getCellKey(rowId, columnId));
        if (cellElement) {
          getCellFocusTarget(cellElement).focus();
        } else {
          void onScrollToRow({ rowId, columnId });
        }
        return;
      }

      const firstColumnId = navigableColumnIds[0];
      const firstVisibleRowId =
        tableRef.current?.getRowModel().rows[getFirstVisibleRowIndex()]?.id;
      if (!firstColumnId || !firstVisibleRowId) return;

      focusCell(firstVisibleRowId, firstColumnId);
    }

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("focus", onFocus);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("focus", onFocus);
    };
  }, [store, navigableColumnIds, focusCell, onScrollToRow]);

  // Restore focus to container when virtualized cells are unmounted
  React.useEffect(() => {
    const container = dataGridRef.current;
    if (!container) return;

    function onFocusOut(event: FocusEvent) {
      if (focusGuardRef.current) return;

      const currentContainer = dataGridRef.current;
      if (!currentContainer) return;

      const currentState = store.getState();

      if (!currentState.focusedCell || tableRef.current?.getEditingCell())
        return;

      // A null relatedTarget means the focused cell was unmounted (or focus left the page),
      // a real element means the user moved focus elsewhere on purpose
      if (!event.relatedTarget) {
        const { rowId, columnId } = currentState.focusedCell;
        const cellKey = getCellKey(rowId, columnId);
        const cellElement = cellMapRef.current.get(cellKey);

        requestAnimationFrame(() => {
          if (focusGuardRef.current) return;

          if (cellElement && document.body.contains(cellElement)) {
            getCellFocusTarget(cellElement).focus();
          } else {
            currentContainer.focus();
          }
        });
      }
    }

    container.addEventListener("focusout", onFocusOut);

    return () => {
      container.removeEventListener("focusout", onFocusOut);
    };
  }, [store]);

  React.useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (event.button === 2) {
        return;
      }

      if (
        dataGridRef.current &&
        !dataGridRef.current.contains(event.target as Node)
      ) {
        const elements = document.elementsFromPoint(
          event.clientX,
          event.clientY,
        );

        // Compensate for event.target bubbling up
        const isInsidePopover = elements.some((element) =>
          getIsInPopover(element),
        );

        if (!isInsidePopover) {
          blurCell();
          const currentState = store.getState();
          if (
            currentState.selectionState.selectedCells.size > 0 ||
            Object.keys(currentState.rowSelection).length > 0
          ) {
            onSelectionClear();
          }
        }
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [store, blurCell, onSelectionClear]);

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

  React.useEffect(() => {
    let rafId: number | null = null;
    let mouseX = 0;
    let mouseY = 0;
    let mouseReady = false;
    let active = false;
    let lastSelectionTime = 0;
    let resizeObserver: ResizeObserver | null = null;

    let cachedRect: DOMRect | null = null;
    let cachedHdrH = 0;
    let cachedFtrH = 0;
    let cachedLpw = 0;
    let cachedRpw = 0;

    function getAutoScrollSpeed(dist: number): number {
      const t = Math.min(dist / AUTO_SCROLL_SPEED_RAMP_ZONE, 1);
      return Math.round(
        AUTO_SCROLL_MIN_SPEED +
          (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * t,
      );
    }

    function cacheLayout(container: HTMLDivElement) {
      cachedRect = container.getBoundingClientRect();
      cachedHdrH = headerRef.current?.getBoundingClientRect().height ?? 0;
      cachedFtrH = footerRef.current?.getBoundingClientRect().height ?? 0;
      const tbl = tableRef.current;
      if (tbl) {
        cachedLpw = tbl
          .getStartVisibleLeafColumns()
          .reduce((s, c) => s + c.getSize(), 0);
        cachedRpw = tbl
          .getEndVisibleLeafColumns()
          .reduce((s, c) => s + c.getSize(), 0);
      }
    }

    function tick() {
      if (!active) return;
      const container = dataGridRef.current;
      const tbl = tableRef.current;

      if (!container || !tbl) {
        onAutoScrollStop();
        return;
      }

      if (!mouseReady || !cachedRect) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const rect = cachedRect;
      const { dir } = dragDepsRef.current;
      const hasNegativeScroll = container.scrollLeft < 0;
      const isActuallyRtl = dir === "rtl" || hasNegativeScroll;

      const dataTop = rect.top + cachedHdrH;
      const dataBottom = rect.bottom - cachedFtrH;

      const scrollAreaLeft = isActuallyRtl
        ? rect.left + cachedRpw
        : rect.left + cachedLpw;
      const scrollAreaRight = isActuallyRtl
        ? rect.right - cachedLpw
        : rect.right - cachedRpw;

      let dy = 0;
      let dx = 0;

      if (mouseY < dataTop) dy = -getAutoScrollSpeed(dataTop - mouseY);
      else if (mouseY > dataBottom)
        dy = getAutoScrollSpeed(mouseY - dataBottom);

      if (mouseX < scrollAreaLeft)
        dx = -getAutoScrollSpeed(scrollAreaLeft - mouseX);
      else if (mouseX > scrollAreaRight)
        dx = getAutoScrollSpeed(mouseX - scrollAreaRight);

      if (dx === 0 && dy === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      container.scrollTop += dy;
      container.scrollLeft += dx;

      const now = performance.now();
      if (now - lastSelectionTime < AUTO_SCROLL_SELECTION_THROTTLE_MS) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const { rowSize: rh, columnIds } = dragDepsRef.current;
      if (columnIds.length === 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const rows = tbl.getRowModel().rows;
      const clampedY = Math.max(dataTop, Math.min(mouseY, dataBottom));
      const absY = container.scrollTop + (clampedY - dataTop);
      const rowId =
        rows[Math.max(0, Math.min(Math.floor(absY / rh), rows.length - 1))]?.id;

      if (!rowId) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const st = store.getState();
      const range = st.selectionState.selectionRange;

      let columnId: string | undefined;

      if (dx !== 0) {
        const clampedX = Math.max(rect.left, Math.min(mouseX, rect.right));
        const relX = clampedX - rect.left;

        const leftZoneWidth = isActuallyRtl ? cachedRpw : cachedLpw;
        const rightZoneWidth = isActuallyRtl ? cachedLpw : cachedRpw;

        if (relX < leftZoneWidth) {
          const columns = isActuallyRtl
            ? tbl.getEndVisibleLeafColumns()
            : tbl.getStartVisibleLeafColumns();
          columnId = columns[0]?.id ?? columnIds[0] ?? "";
          let cx = 0;
          for (const col of columns) {
            if (relX < cx + col.getSize()) {
              columnId = col.id;
              break;
            }
            cx += col.getSize();
          }
        } else if (relX > rect.width - rightZoneWidth) {
          const columns = isActuallyRtl
            ? tbl.getStartVisibleLeafColumns()
            : tbl.getEndVisibleLeafColumns();
          columnId = columns[0]?.id ?? columnIds[columnIds.length - 1] ?? "";
          let cx = rect.width - rightZoneWidth;
          for (const col of columns) {
            if (relX < cx + col.getSize()) {
              columnId = col.id;
              break;
            }
            cx += col.getSize();
          }
        } else {
          const center = tbl.getCenterVisibleLeafColumns();
          const centerZoneWidth = rect.width - leftZoneWidth - rightZoneWidth;
          const distFromVisualLeft = relX - leftZoneWidth;

          let absX: number;
          if (isActuallyRtl) {
            const scrollFromRight = hasNegativeScroll
              ? -container.scrollLeft
              : container.scrollWidth -
                container.clientWidth -
                container.scrollLeft;
            absX = scrollFromRight + (centerZoneWidth - distFromVisualLeft);
          } else {
            absX = container.scrollLeft + distFromVisualLeft;
          }

          columnId =
            center[center.length - 1]?.id ??
            columnIds[columnIds.length - 1] ??
            "";
          let cw = 0;
          for (const col of center) {
            cw += col.getSize();
            if (absX < cw) {
              columnId = col.id;
              break;
            }
          }
        }
      }

      if (!columnId) {
        columnId = range?.end.columnId ?? columnIds[0] ?? "";
      }

      if (
        range &&
        (rowId !== range.end.rowId || columnId !== range.end.columnId)
      ) {
        dragDepsRef.current.selectRange(range.start, { rowId, columnId }, true);
        lastSelectionTime = now;
      }

      rafId = requestAnimationFrame(tick);
    }

    function onMove(event: MouseEvent) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      mouseReady = true;
    }

    function onUp() {
      onAutoScrollStop();
      const st = store.getState();
      if (st.selectionState.isSelecting) {
        store.setState("selectionState", {
          ...st.selectionState,
          isSelecting: false,
        });
      }
    }

    function onAutoScrollStart() {
      if (active) return;

      const container = dataGridRef.current;
      if (!container) return;

      active = true;
      mouseReady = false;
      cachedRect = null;
      lastSelectionTime = 0;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      resizeObserver = new ResizeObserver(() => {
        const currentContainer = dataGridRef.current;
        if (currentContainer) cacheLayout(currentContainer);
      });
      resizeObserver.observe(container);
      rafId = requestAnimationFrame(() => {
        const currentContainer = dataGridRef.current;
        if (currentContainer) cacheLayout(currentContainer);
        rafId = requestAnimationFrame(tick);
      });
    }

    function onAutoScrollStop() {
      if (!active) return;
      active = false;
      cachedRect = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    if (store.getState().selectionState.isSelecting) onAutoScrollStart();

    const onUnsubscribe = store.subscribe(() => {
      const st = store.getState();
      if (st.selectionState.isSelecting && !active) onAutoScrollStart();
      else if (!st.selectionState.isSelecting && active) onAutoScrollStop();
    });

    return () => {
      onAutoScrollStop();
      onUnsubscribe();
    };
  }, [store, dragDepsRef]);

  useIsomorphicLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    rowHeight,
    table.state.columnFilters,
    table.state.columnPinning,
    table.state.columnSizing,
    table.state.columnVisibility,
    table.state.rowSelection,
    table.state.sorting,
  ]);

  const virtualTotalSize = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();
  const measureElement = rowVirtualizer.measureElement;

  return React.useMemo(
    () => ({
      dataGridRef,
      headerRef,
      rowMapRef,
      footerRef,
      dir,
      table,
      tableMeta,
      virtualTotalSize,
      virtualItems,
      measureElement,
      columns,
      columnSizeVars,
      searchState,
      searchMatchesByRow,
      activeSearchMatch,
      cellSelectionMap,
      focusedCell,
      editingCell,
      readOnlyColumnIds,
      rowHeight,
      contextMenu,
      pasteDialog,
      onRowAdd: propsRef.current.onRowAdd ? onRowAdd : undefined,
      adjustLayout,
    }),
    [
      propsRef,
      dir,
      table,
      tableMeta,
      virtualTotalSize,
      virtualItems,
      measureElement,
      columns,
      columnSizeVars,
      searchState,
      searchMatchesByRow,
      activeSearchMatch,
      cellSelectionMap,
      focusedCell,
      editingCell,
      readOnlyColumnIds,
      rowHeight,
      contextMenu,
      pasteDialog,
      onRowAdd,
      adjustLayout,
    ],
  );
}

export { useDataGrid, type UseDataGridProps };
