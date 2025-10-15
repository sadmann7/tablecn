"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type TableOptions,
  type Updater,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { DataGridCell } from "@/components/data-grid/data-grid-cell";
import type {
  CellPosition,
  NavigationDirection,
  ScrollToOptions,
  SearchState,
  SelectionState,
  UpdateCell,
} from "@/types/data-grid";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function useLazyRef<T>(fn: () => T): React.RefObject<T> {
  const ref = React.useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = fn();
  }
  return ref as React.RefObject<T>;
}

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
}

interface DataGridState {
  focusedCell: CellPosition | null;
  editingCell: CellPosition | null;
  selectionState: SelectionState;
  searchQuery: string;
  searchMatches: CellPosition[];
  currentMatchIndex: number;
  searchOpen: boolean;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  contextMenu: ContextMenuState;
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

interface UseDataGridProps<TData>
  extends Omit<TableOptions<TData>, "pageCount" | "getCoreRowModel"> {
  columns: ColumnDef<TData>[];
  data: TData[];
  onDataChange?: (data: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;
  estimateRowSize?: number;
  overscan?: number;
  autoFocus?: boolean;
  enableSearch?: boolean;
}

export function useDataGrid<TData>({
  columns,
  data,
  onDataChange,
  initialState,
  getRowId,
  estimateRowSize = 35,
  overscan = 3,
  autoFocus = false,
  enableSearch = false,
  ...dataGridProps
}: UseDataGridProps<TData>) {
  const dataGridRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<ReturnType<typeof useReactTable<TData>> | null>(
    null,
  );
  const rowVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);
  const rowMapRef = React.useRef<Map<number, HTMLDivElement>>(new Map());

  const listenersRef = useLazyRef(() => new Set<() => void>());

  const stateRef = useLazyRef<DataGridState>(() => {
    return {
      focusedCell: null,
      editingCell: null,
      selectionState: {
        selectedCells: new Set(),
        selectionRange: null,
        isSelecting: false,
      },
      searchQuery: "",
      searchMatches: [],
      currentMatchIndex: -1,
      searchOpen: false,
      sorting: initialState?.sorting ?? [],
      rowSelection: initialState?.rowSelection ?? {},
      contextMenu: {
        open: false,
        x: 0,
        y: 0,
      },
    };
  });

  const store = React.useMemo<DataGridStore>(() => {
    let isBatching = false;
    let pendingNotification = false;
    let scheduledNotification: Promise<void> | null = null;

    return {
      subscribe: (callback) => {
        listenersRef.current.add(callback);
        return () => listenersRef.current.delete(callback);
      },
      getState: () => stateRef.current,
      setState: (key, value) => {
        if (Object.is(stateRef.current[key], value)) return;
        stateRef.current = { ...stateRef.current, [key]: value };

        if (isBatching) {
          pendingNotification = true;
        } else {
          pendingNotification = true;
          if (scheduledNotification) return;

          scheduledNotification = Promise.resolve().then(() => {
            scheduledNotification = null;
            if (pendingNotification) {
              pendingNotification = false;
              store.notify();
            }
          });
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
        pendingNotification = false;

        try {
          fn();
        } finally {
          isBatching = false;
          if (pendingNotification) {
            pendingNotification = false;
            store.notify();
          }
        }
      },
    };
  }, [listenersRef, stateRef]);

  const {
    focusedCell,
    editingCell,
    selectionState,
    searchQuery,
    searchMatches,
    currentMatchIndex,
    searchOpen,
    sorting,
    rowSelection,
    contextMenu,
  } = React.useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );

  const getColumnIds = React.useCallback(() => {
    return columns
      .map((c) => {
        if (c.id) return c.id;
        if ("accessorKey" in c) return c.accessorKey as string;
        return undefined;
      })
      .filter((id): id is string => Boolean(id));
  }, [columns]);

  const getNavigableColumnIds = React.useCallback(() => {
    return getColumnIds().filter((c) => c !== "select");
  }, [getColumnIds]);

  const updateData = React.useCallback(
    (updates: UpdateCell | Array<UpdateCell>) => {
      const updateArray = Array.isArray(updates) ? updates : [updates];

      if (updateArray.length === 0) return;

      const currentTable = tableRef.current;
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
          const originalRowIndex = data.indexOf(originalData);
          if (originalRowIndex === -1) continue;

          const existingUpdates = rowUpdatesMap.get(originalRowIndex) || [];
          existingUpdates.push({
            columnId: update.columnId,
            value: update.value,
          });
          rowUpdatesMap.set(originalRowIndex, existingUpdates);
        }
      }

      const newData = data.map((row, index) => {
        const updates = rowUpdatesMap.get(index);
        if (!updates) return row;

        const updatedRow = { ...row } as Record<string, unknown>;
        for (const { columnId, value } of updates) {
          updatedRow[columnId] = value;
        }
        return updatedRow as TData;
      });

      onDataChange?.(newData);
    },
    [data, onDataChange],
  );

  const getCellKey = React.useCallback(
    (rowIndex: number, columnId: string) => `${rowIndex}:${columnId}`,
    [],
  );

  const getIsCellSelected = React.useCallback(
    (rowIndex: number, columnId: string) => {
      return selectionState.selectedCells.has(getCellKey(rowIndex, columnId));
    },
    [selectionState.selectedCells, getCellKey],
  );

  const clearSelection = React.useCallback(() => {
    store.setState("selectionState", {
      selectedCells: new Set(),
      selectionRange: null,
      isSelecting: false,
    });
  }, [store]);

  const selectAll = React.useCallback(() => {
    const columnIds = getColumnIds();
    const allCells = new Set<string>();
    const currentTable = tableRef.current;
    const rows = currentTable?.getRowModel().rows || [];
    const rowCount = rows.length || data.length;

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
  }, [getCellKey, getColumnIds, data.length, store]);

  const selectRange = React.useCallback(
    (start: CellPosition, end: CellPosition, isSelecting = false) => {
      const columnIds = getColumnIds();
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
            const cellKey = getCellKey(rowIndex, columnId);
            selectedCells.add(cellKey);
          }
        }
      }

      store.setState("selectionState", {
        selectedCells,
        selectionRange: { start, end },
        isSelecting,
      });
    },
    [getColumnIds, getCellKey, store],
  );

  const focusCell = React.useCallback(
    (rowIndex: number, columnId: string) => {
      store.batch(() => {
        store.setState("focusedCell", { rowIndex, columnId });
        store.setState("editingCell", null);
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

  const startEditing = React.useCallback(
    (rowIndex: number, columnId: string) => {
      store.batch(() => {
        store.setState("focusedCell", { rowIndex, columnId });
        store.setState("editingCell", { rowIndex, columnId });
      });
    },
    [store],
  );

  const stopEditing = React.useCallback(
    (options?: { moveToNextRow?: boolean }) => {
      const currentState = store.getState();
      const currentEditing = currentState.editingCell;

      store.setState("editingCell", null);

      if (options?.moveToNextRow && currentEditing) {
        const { rowIndex, columnId } = currentEditing;
        const currentTable = tableRef.current;
        const rows = currentTable?.getRowModel().rows || [];
        const rowCount = rows.length || data.length;

        const nextRowIndex = rowIndex + 1;
        if (nextRowIndex < rowCount) {
          requestAnimationFrame(() => {
            focusCell(nextRowIndex, columnId);
          });
        }
      }
    },
    [store, data.length, focusCell],
  );

  const onSearchOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        store.setState("searchOpen", true);
        return;
      }

      store.batch(() => {
        store.setState("searchOpen", false);
        store.setState("searchQuery", "");
        store.setState("searchMatches", []);
        store.setState("currentMatchIndex", -1);
      });
    },
    [store],
  );

  const onSearch = React.useCallback(
    (query: string) => {
      if (!query.trim()) {
        store.batch(() => {
          store.setState("searchMatches", []);
          store.setState("currentMatchIndex", -1);
        });
        return;
      }

      const matches: CellPosition[] = [];
      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows || [];
      const columnIds = getColumnIds();

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
        store.setState("currentMatchIndex", matches.length > 0 ? 0 : -1);
      });

      // Scroll to first match but don't focus it (to keep focus in search input)
      if (matches.length > 0 && matches[0]) {
        const firstMatch = matches[0];
        rowVirtualizerRef.current?.scrollToIndex(firstMatch.rowIndex, {
          align: "center",
        });
      }
    },
    [getColumnIds, store],
  );

  const navigateToNextMatch = React.useCallback(() => {
    const currentState = store.getState();
    if (currentState.searchMatches.length === 0) return;

    const nextIndex =
      (currentState.currentMatchIndex + 1) % currentState.searchMatches.length;
    store.setState("currentMatchIndex", nextIndex);

    const match = currentState.searchMatches[nextIndex];
    if (match) {
      rowVirtualizerRef.current?.scrollToIndex(match.rowIndex, {
        align: "center",
      });
      requestAnimationFrame(() => {
        focusCell(match.rowIndex, match.columnId);
      });
    }
  }, [store, focusCell]);

  const navigateToPrevMatch = React.useCallback(() => {
    const currentState = store.getState();
    if (currentState.searchMatches.length === 0) return;

    const prevIndex =
      currentState.currentMatchIndex - 1 < 0
        ? currentState.searchMatches.length - 1
        : currentState.currentMatchIndex - 1;
    store.setState("currentMatchIndex", prevIndex);

    const match = currentState.searchMatches[prevIndex];
    if (match) {
      rowVirtualizerRef.current?.scrollToIndex(match.rowIndex, {
        align: "center",
      });
      requestAnimationFrame(() => {
        focusCell(match.rowIndex, match.columnId);
      });
    }
  }, [store, focusCell]);

  const isSearchMatch = React.useCallback(
    (rowIndex: number, columnId: string) => {
      return searchMatches.some(
        (match) => match.rowIndex === rowIndex && match.columnId === columnId,
      );
    },
    [searchMatches],
  );

  const isCurrentSearchMatch = React.useCallback(
    (rowIndex: number, columnId: string) => {
      if (currentMatchIndex < 0) return false;
      const currentMatch = searchMatches[currentMatchIndex];
      return (
        currentMatch?.rowIndex === rowIndex &&
        currentMatch?.columnId === columnId
      );
    },
    [searchMatches, currentMatchIndex],
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
      // Ignore right-click (button 2) - let onCellContextMenu handle it
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

      // Only clear selection if it wasn't created by a drag operation
      // (selectedCells will be empty after a simple click due to mouseDown clearing it)
      if (
        currentState.selectionState.selectedCells.size > 0 &&
        !currentState.selectionState.isSelecting
      ) {
        // If there's a selection but we're not actively selecting (drag just finished),
        // don't clear it - keep the selection
        // Only clear if clicking elsewhere
        const cellKey = getCellKey(rowIndex, columnId);
        const isClickingSelectedCell =
          currentState.selectionState.selectedCells.has(cellKey);

        if (!isClickingSelectedCell) {
          clearSelection();
        } else {
          // Clicking on an already selected cell - just focus it
          focusCell(rowIndex, columnId);
          return;
        }
      }

      if (
        currentFocused?.rowIndex === rowIndex &&
        currentFocused?.columnId === columnId
      ) {
        startEditing(rowIndex, columnId);
      } else {
        focusCell(rowIndex, columnId);
      }
    },
    [store, focusCell, startEditing, getCellKey, selectRange, clearSelection],
  );

  const onCellDoubleClick = React.useCallback(
    (rowIndex: number, columnId: string) => {
      startEditing(rowIndex, columnId);
    },
    [startEditing],
  );

  const onCellMouseDown = React.useCallback(
    (rowIndex: number, columnId: string, event: React.MouseEvent) => {
      // Ignore right-click (button 2) - let onCellContextMenu handle it
      if (event.button === 2) {
        return;
      }

      event.preventDefault();

      // Only start drag selection if no modifier keys are pressed
      // Clear any existing selection and prepare for potential drag
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        store.setState("selectionState", {
          selectedCells: new Set(),
          selectionRange: {
            start: { rowIndex, columnId },
            end: { rowIndex, columnId },
          },
          isSelecting: true,
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

      // If right-clicking on a non-selected cell, select only that cell
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

      // Open context menu at cursor position
      store.setState("contextMenu", {
        open: true,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [store, getCellKey],
  );

  const onContextMenuOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        store.setState("contextMenu", {
          open: false,
          x: 0,
          y: 0,
        });
      }
    },
    [store],
  );

  const navigateCell = React.useCallback(
    (direction: NavigationDirection) => {
      const currentState = store.getState();
      if (!currentState.focusedCell) return;

      const { rowIndex, columnId } = currentState.focusedCell;
      const columnIds = getNavigableColumnIds();
      const currentColIndex = columnIds.indexOf(columnId);
      const rowVirtualizer = rowVirtualizerRef.current;
      const currentTable = tableRef.current;
      const rows = currentTable?.getRowModel().rows || [];
      const rowCount = rows.length || data.length;

      let newRowIndex = rowIndex;
      let newColumnId = columnId;

      switch (direction) {
        case "up":
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case "down":
          newRowIndex = Math.min(rowCount - 1, rowIndex + 1);
          break;
        case "left":
          if (currentColIndex > 0) {
            const prevColumnId = columnIds[currentColIndex - 1];
            if (prevColumnId) newColumnId = prevColumnId;
          }
          break;
        case "right":
          if (currentColIndex < columnIds.length - 1) {
            const nextColumnId = columnIds[currentColIndex + 1];
            if (nextColumnId) newColumnId = nextColumnId;
          }
          break;
        case "home":
          if (columnIds.length > 0) {
            newColumnId = columnIds[0] || columnId;
          }
          break;
        case "end":
          if (columnIds.length > 0) {
            newColumnId = columnIds[columnIds.length - 1] || columnId;
          }
          break;
        case "ctrl+home":
          newRowIndex = 0;
          if (columnIds.length > 0) {
            newColumnId = columnIds[0] || columnId;
          }
          break;
        case "ctrl+end":
          newRowIndex = Math.max(0, rowCount - 1);
          if (columnIds.length > 0) {
            newColumnId = columnIds[columnIds.length - 1] || columnId;
          }
          break;
        case "pageup":
          if (rowVirtualizer) {
            const visibleRange = rowVirtualizer.getVirtualItems();
            const pageSize = visibleRange.length || 10;
            newRowIndex = Math.max(0, rowIndex - pageSize);
          } else {
            newRowIndex = Math.max(0, rowIndex - 10);
          }
          break;
        case "pagedown":
          if (rowVirtualizer) {
            const visibleRange = rowVirtualizer.getVirtualItems();
            const pageSize = visibleRange.length || 10;
            newRowIndex = Math.min(rowCount - 1, rowIndex + pageSize);
          } else {
            newRowIndex = Math.min(rowCount - 1, rowIndex + 10);
          }
          break;
      }

      if (newRowIndex !== rowIndex || newColumnId !== columnId) {
        if (
          rowVirtualizer &&
          (newRowIndex < rowIndex - 5 || newRowIndex > rowIndex + 5)
        ) {
          rowVirtualizer.scrollToIndex(newRowIndex, { align: "center" });
          requestAnimationFrame(() => {
            focusCell(newRowIndex, newColumnId);
          });
        } else {
          focusCell(newRowIndex, newColumnId);
        }
      }
    },
    [store, getNavigableColumnIds, focusCell, data.length],
  );

  const onDataGridKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      const currentState = store.getState();
      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isCtrlPressed = ctrlKey || metaKey;

      // Handle Cmd+F / Ctrl+F to open search (highest priority, works even when editing)
      if (enableSearch && isCtrlPressed && key === "f") {
        event.preventDefault();
        onSearchOpenChange(true);
        return;
      }

      // Handle search navigation when search is open
      if (
        enableSearch &&
        currentState.searchOpen &&
        !currentState.editingCell
      ) {
        if (key === "Enter") {
          event.preventDefault();
          if (shiftKey) {
            navigateToPrevMatch();
          } else {
            navigateToNextMatch();
          }
          return;
        }
        if (key === "Escape") {
          event.preventDefault();
          onSearchOpenChange(false);
          return;
        }
        // When search is open, don't let data grid handle any other keys
        // (they should only affect the search input)
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

      if (key === "Delete" || key === "Backspace") {
        if (currentState.selectionState.selectedCells.size > 0) {
          event.preventDefault();
          const updates: Array<{
            rowIndex: number;
            columnId: string;
            value: unknown;
          }> = [];

          currentState.selectionState.selectedCells.forEach((cellKey) => {
            const parts = cellKey.split(":");
            const rowIndexStr = parts[0];
            const columnId = parts[1];
            if (rowIndexStr && columnId) {
              const rowIndex = parseInt(rowIndexStr, 10);
              if (!Number.isNaN(rowIndex)) {
                updates.push({ rowIndex, columnId, value: "" });
              }
            }
          });

          updateData(updates);
          clearSelection();
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
          if (currentState.selectionState.selectedCells.size > 0) {
            clearSelection();
          } else {
            blurCell();
          }
          return;
        case "Tab":
          event.preventDefault();
          direction = event.shiftKey ? "left" : "right";
          break;
      }

      if (direction) {
        event.preventDefault();

        if (shiftKey && currentState.focusedCell) {
          const columnIds = getNavigableColumnIds();
          const currentColIndex = columnIds.indexOf(
            currentState.focusedCell.columnId,
          );
          let newRowIndex = currentState.focusedCell.rowIndex;
          let newColumnId = currentState.focusedCell.columnId;

          switch (direction) {
            case "up":
              newRowIndex = Math.max(0, currentState.focusedCell.rowIndex - 1);
              break;
            case "down":
              newRowIndex = Math.min(
                (tableRef.current?.getRowModel().rows.length || data.length) -
                  1,
                currentState.focusedCell.rowIndex + 1,
              );
              break;
            case "left":
              if (currentColIndex > 0) {
                const prevColumnId = columnIds[currentColIndex - 1];
                if (prevColumnId) newColumnId = prevColumnId;
              }
              break;
            case "right":
              if (currentColIndex < columnIds.length - 1) {
                const nextColumnId = columnIds[currentColIndex + 1];
                if (nextColumnId) newColumnId = nextColumnId;
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
      store,
      blurCell,
      navigateCell,
      selectAll,
      updateData,
      clearSelection,
      getNavigableColumnIds,
      data.length,
      selectRange,
      focusCell,
      onSearchOpenChange,
      navigateToNextMatch,
      navigateToPrevMatch,
      enableSearch,
    ],
  );

  const setSorting = React.useCallback(
    (updater: Updater<SortingState>) => {
      const currentState = store.getState();
      const newSorting =
        typeof updater === "function" ? updater(currentState.sorting) : updater;
      store.setState("sorting", newSorting);
    },
    [store],
  );

  const setRowSelection = React.useCallback(
    (updater: Updater<RowSelectionState>) => {
      const currentState = store.getState();
      const newRowSelection =
        typeof updater === "function"
          ? updater(currentState.rowSelection)
          : updater;

      const selectedRows = Object.keys(newRowSelection).filter(
        (key) => newRowSelection[key],
      );

      const columnIds = getColumnIds();
      const selectedCells = new Set<string>();
      const rows = tableRef.current?.getRowModel().rows || [];

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
      });
    },
    [store, getColumnIds, getCellKey],
  );

  const defaultColumn: Partial<ColumnDef<TData>> = React.useMemo(
    () => ({
      cell: ({ cell, table }) => <DataGridCell cell={cell} table={table} />,
    }),
    [],
  );

  const table = useReactTable({
    ...dataGridProps,
    data,
    columns,
    defaultColumn,
    initialState,
    state: {
      ...dataGridProps.state,
      sorting,
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
    meta: {
      ...dataGridProps.meta,
      dataGridRef,
      updateData,
      focusedCell,
      editingCell,
      selectionState,
      onCellClick,
      onCellDoubleClick,
      onCellMouseDown,
      onCellMouseEnter,
      onCellMouseUp,
      onCellContextMenu,
      startEditing,
      stopEditing,
      navigateCell,
      blurCell,
      clearSelection,
      selectAll,
      getIsCellSelected,
      isSearchMatch,
      isCurrentSearchMatch,
      searchQuery,
      contextMenu,
      onContextMenuOpenChange,
    },
  });

  if (!tableRef.current) {
    tableRef.current = table;
  }

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => dataGridRef.current,
    estimateSize: () => estimateRowSize,
    overscan,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    onChange: (instance) => {
      requestAnimationFrame(() => {
        instance.getVirtualItems().forEach((virtualRow) => {
          const rowRef = rowMapRef.current.get(virtualRow.index);
          if (!rowRef) return;
          rowRef.style.transform = `translateY(${virtualRow.start}px)`;
        });
      });
    },
  });

  if (!rowVirtualizerRef.current) {
    rowVirtualizerRef.current = rowVirtualizer;
  }

  const scrollToRow = React.useCallback(
    (options: ScrollToOptions) => {
      const { rowIndex, columnId } = options;

      rowVirtualizer.scrollToIndex(rowIndex, {
        align: "center",
      });

      const columnIds = getNavigableColumnIds();
      const targetColumnId = columnId || columnIds[0];

      if (targetColumnId) {
        requestAnimationFrame(() => {
          focusCell(rowIndex, targetColumnId);
        });
      }
    },
    [rowVirtualizer, getNavigableColumnIds, focusCell],
  );

  const setSearchQuery = React.useCallback(
    (query: string) => store.setState("searchQuery", query),
    [store],
  );

  React.useEffect(() => {
    const dataGridElement = dataGridRef.current;
    if (!dataGridElement) return;

    dataGridElement.addEventListener("keydown", onDataGridKeyDown);
    return () => {
      dataGridElement.removeEventListener("keydown", onDataGridKeyDown);
    };
  }, [onDataGridKeyDown]);

  // Global handler for Cmd+F to override browser default
  React.useEffect(() => {
    if (!enableSearch) return;

    function onGlobalKeyDown(event: KeyboardEvent) {
      const isCtrlPressed = event.ctrlKey || event.metaKey;

      if (!isCtrlPressed || event.key !== "f") return;

      const dataGridElement = dataGridRef.current;
      if (!dataGridElement) return;

      // Don't intercept if we're in a regular input/textarea that's NOT part of the data grid or search
      const target = event.target;
      if (target instanceof HTMLElement) {
        const isInInput =
          target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        const isInDataGrid = dataGridElement.contains(target);
        const isSearchInput = target.closest('[role="search"]') !== null;

        // If in an input/textarea that's outside the data grid (and not our search), let browser handle it
        if (isInInput && !isInDataGrid && !isSearchInput) {
          return;
        }
      }

      // Intercept Cmd+F and open our search
      event.preventDefault();
      event.stopPropagation();
      onSearchOpenChange(true);
    }

    // Use capture phase to intercept before browser
    window.addEventListener("keydown", onGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown, true);
    };
  }, [onSearchOpenChange, enableSearch]);

  React.useEffect(() => {
    const currentState = store.getState();
    if (
      autoFocus &&
      data.length > 0 &&
      columns.length > 0 &&
      !currentState.focusedCell
    ) {
      const columnIds = getNavigableColumnIds();
      if (columnIds.length > 0) {
        const rafId = requestAnimationFrame(() => {
          const firstColumnId = columnIds[0];
          if (firstColumnId) {
            focusCell(0, firstColumnId);
          }
        });
        return () => cancelAnimationFrame(rafId);
      }
    }
  }, [
    autoFocus,
    data.length,
    columns.length,
    store,
    getNavigableColumnIds,
    focusCell,
  ]);

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
          table.options.meta?.blurCell?.();
          const currentState = store.getState();
          if (currentState.selectionState.selectedCells.size > 0) {
            clearSelection();
          }
          if (Object.keys(currentState.rowSelection).length > 0) {
            table.toggleAllRowsSelected(false);
          }
        }
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [table, clearSelection, store]);

  React.useEffect(() => {
    function cleanup() {
      document.removeEventListener("selectstart", preventSelection);
      document.removeEventListener("contextmenu", preventContextMenu);
      document.body.style.userSelect = "";
    }

    function preventSelection(event: Event) {
      event.preventDefault();
    }
    function preventContextMenu(event: Event) {
      event.preventDefault();
    }

    const unsubscribe = store.subscribe(() => {
      const currentState = store.getState();
      if (currentState.selectionState.isSelecting) {
        document.addEventListener("selectstart", preventSelection);
        document.addEventListener("contextmenu", preventContextMenu);
        document.body.style.userSelect = "none";
      } else {
        cleanup();
      }
    });

    return () => {
      cleanup();
      unsubscribe();
    };
  }, [store]);

  useIsomorphicLayoutEffect(() => {
    const rafId = requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });
    return () => cancelAnimationFrame(rafId);
  }, [
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

  const searchState = React.useMemo<SearchState | undefined>(() => {
    if (!enableSearch) return undefined;

    return {
      searchOpen,
      searchQuery,
      searchMatches,
      currentMatchIndex,
      onSearchOpenChange,
      onSearch,
      navigateToNextMatch,
      navigateToPrevMatch,
      setSearchQuery,
    };
  }, [
    enableSearch,
    searchOpen,
    searchQuery,
    searchMatches,
    currentMatchIndex,
    onSearchOpenChange,
    onSearch,
    navigateToNextMatch,
    navigateToPrevMatch,
    setSearchQuery,
  ]);

  return {
    dataGridRef,
    table,
    rowVirtualizer,
    rowMapRef,
    scrollToRow,
    searchState,
  };
}
