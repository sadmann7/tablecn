import * as React from "react";
import { toast } from "sonner";

import { useAsRef } from "@/hooks/use-as-ref";
import { useLazyRef } from "@/hooks/use-lazy-ref";
import { getIsInPopover } from "@/lib/data-grid";

const DEFAULT_MAX_HISTORY = 100;
const BATCH_TIMEOUT = 300;

interface HistoryEntry<TData> {
  variant: "cells_update" | "rows_add" | "rows_delete";
  count: number;
  timestamp: number;
  undo: (currentData: TData[]) => TData[];
  redo: (currentData: TData[]) => TData[];
}

interface UndoRedoCellUpdate {
  rowId: string;
  columnId: string;
  previousValue: unknown;
  newValue: unknown;
}

interface StoreState<TData> {
  undoStack: HistoryEntry<TData>[];
  redoStack: HistoryEntry<TData>[];
  hasPendingChanges: boolean;
}

interface Store<TData> {
  subscribe: (callback: () => void) => () => void;
  getState: () => StoreState<TData>;
  push: (entry: HistoryEntry<TData>) => void;
  undo: () => HistoryEntry<TData> | null;
  redo: () => HistoryEntry<TData> | null;
  clear: () => void;
  setPendingChanges: (value: boolean) => void;
  notify: () => void;
}

function useStore<T>(
  store: Store<T>,
  selector: (state: StoreState<T>) => boolean,
): boolean {
  const getSnapshot = React.useCallback(
    () => selector(store.getState()),
    [store, selector],
  );

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

function buildIndexById<TData>(
  data: TData[],
  getRowId: (row: TData) => string,
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row) {
      map.set(getRowId(row), i);
    }
  }
  return map;
}

function getPendingKey(rowId: string, columnId: string): string {
  return `${rowId}\0${columnId}`;
}

interface UseDataGridUndoRedoProps<TData> {
  data: TData[];
  onDataChange: (data: TData[]) => void;
  getRowId: (row: TData) => string;
  maxHistory?: number;
  enabled?: boolean;
}

interface UseDataGridUndoRedoReturn<TData> {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  trackCellsUpdate: (updates: UndoRedoCellUpdate[]) => void;
  trackRowsAdd: (rows: TData[]) => void;
  trackRowsDelete: (rows: TData[]) => void;
}

function useDataGridUndoRedo<TData>({
  data,
  onDataChange,
  getRowId,
  maxHistory = DEFAULT_MAX_HISTORY,
  enabled = true,
}: UseDataGridUndoRedoProps<TData>): UseDataGridUndoRedoReturn<TData> {
  const propsRef = useAsRef({
    data,
    onDataChange,
    getRowId,
    maxHistory,
    enabled,
  });

  const listenersRef = useLazyRef(() => new Set<() => void>());

  const stateRef = useLazyRef<StoreState<TData>>(() => ({
    undoStack: [],
    redoStack: [],
    hasPendingChanges: false,
  }));

  const pendingBatchRef = React.useRef<{
    byKey: Map<string, UndoRedoCellUpdate>;
    timeoutId: ReturnType<typeof setTimeout> | null;
  }>({
    byKey: new Map(),
    timeoutId: null,
  });

  const pendingNotifyRef = React.useRef(false);

  const store = React.useMemo<Store<TData>>(() => {
    return {
      subscribe: (callback) => {
        listenersRef.current.add(callback);
        return () => listenersRef.current.delete(callback);
      },
      getState: () => stateRef.current,
      push: (entry) => {
        const state = stateRef.current;
        const newUndoStack = [...state.undoStack, entry];

        if (newUndoStack.length > propsRef.current.maxHistory) {
          newUndoStack.shift();
        }

        stateRef.current = {
          undoStack: newUndoStack,
          redoStack: [],
          hasPendingChanges: false,
        };
        store.notify();
      },
      undo: () => {
        const state = stateRef.current;
        if (state.undoStack.length === 0) return null;

        const entry = state.undoStack[state.undoStack.length - 1];
        if (!entry) return null;

        stateRef.current = {
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, entry],
          hasPendingChanges: false,
        };
        store.notify();
        return entry;
      },
      redo: () => {
        const state = stateRef.current;
        if (state.redoStack.length === 0) return null;

        const entry = state.redoStack[state.redoStack.length - 1];
        if (!entry) return null;

        stateRef.current = {
          undoStack: [...state.undoStack, entry],
          redoStack: state.redoStack.slice(0, -1),
          hasPendingChanges: false,
        };
        store.notify();
        return entry;
      },
      clear: () => {
        stateRef.current = {
          undoStack: [],
          redoStack: [],
          hasPendingChanges: false,
        };
        store.notify();
      },
      setPendingChanges: (value) => {
        if (stateRef.current.hasPendingChanges === value) return;
        stateRef.current = {
          ...stateRef.current,
          hasPendingChanges: value,
        };

        if (!pendingNotifyRef.current) {
          pendingNotifyRef.current = true;
          queueMicrotask(() => {
            pendingNotifyRef.current = false;
            store.notify();
          });
        }
      },
      notify: () => {
        for (const listener of listenersRef.current) {
          listener();
        }
      },
    };
  }, [listenersRef, stateRef, propsRef]);

  const canUndo = useStore(
    store,
    (state) => state.undoStack.length > 0 || state.hasPendingChanges,
  );
  const canRedo = useStore(store, (state) => state.redoStack.length > 0);

  const onCommit = React.useCallback(() => {
    const pending = pendingBatchRef.current;
    if (pending.byKey.size === 0) return;

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
      pending.timeoutId = null;
    }

    const updates = Array.from(pending.byKey.values());
    pending.byKey.clear();

    const { getRowId } = propsRef.current;

    const entry: HistoryEntry<TData> = {
      variant: "cells_update",
      count: updates.length,
      timestamp: Date.now(),
      undo: (currentData) => {
        const newData = [...currentData];
        const indexById = buildIndexById(newData, getRowId);

        for (const update of updates) {
          const index = indexById.get(update.rowId);
          if (index !== undefined) {
            const row = newData[index];
            if (row) {
              newData[index] = {
                ...row,
                [update.columnId]: update.previousValue,
              };
            }
          }
        }
        return newData;
      },
      redo: (currentData) => {
        const newData = [...currentData];
        const indexById = buildIndexById(newData, getRowId);

        for (const update of updates) {
          const index = indexById.get(update.rowId);
          if (index !== undefined) {
            const row = newData[index];
            if (row) {
              newData[index] = { ...row, [update.columnId]: update.newValue };
            }
          }
        }
        return newData;
      },
    };

    store.push(entry);
  }, [store, propsRef]);

  const onUndo = React.useCallback(() => {
    if (!propsRef.current.enabled) return;

    onCommit();

    const entry = store.undo();
    if (!entry) {
      toast.info("No actions to undo");
      return;
    }

    const newData = entry.undo(propsRef.current.data);
    propsRef.current.onDataChange(newData);

    toast.success(
      `${entry.count} action${entry.count !== 1 ? "s" : ""} undone`,
    );
  }, [store, propsRef, onCommit]);

  const onRedo = React.useCallback(() => {
    if (!propsRef.current.enabled) return;

    onCommit();

    const entry = store.redo();
    if (!entry) {
      toast.info("No actions to redo");
      return;
    }

    const newData = entry.redo(propsRef.current.data);
    propsRef.current.onDataChange(newData);

    toast.success(
      `${entry.count} action${entry.count !== 1 ? "s" : ""} redone`,
    );
  }, [store, propsRef, onCommit]);

  const onClear = React.useCallback(() => {
    const pending = pendingBatchRef.current;
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
      pending.timeoutId = null;
    }
    pending.byKey.clear();

    store.clear();
  }, [store]);

  const trackCellsUpdate = React.useCallback(
    (updates: UndoRedoCellUpdate[]) => {
      if (!propsRef.current.enabled || updates.length === 0) return;

      const filteredUpdates = updates.filter(
        (u) => !Object.is(u.previousValue, u.newValue),
      );
      if (filteredUpdates.length === 0) return;

      const pending = pendingBatchRef.current;

      for (const update of filteredUpdates) {
        const key = getPendingKey(update.rowId, update.columnId);
        const existing = pending.byKey.get(key);

        if (existing) {
          pending.byKey.set(key, { ...existing, newValue: update.newValue });
        } else {
          pending.byKey.set(key, update);
        }
      }

      store.setPendingChanges(true);

      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.timeoutId = setTimeout(onCommit, BATCH_TIMEOUT);
    },
    [store, propsRef, onCommit],
  );

  const trackRowsAdd = React.useCallback(
    (rows: TData[]) => {
      if (!propsRef.current.enabled || rows.length === 0) return;

      onCommit();

      const { getRowId } = propsRef.current;

      const rowIds = new Set(rows.map((row) => getRowId(row)));
      const rowsCopy = rows.map((row) => ({ ...row }));

      const entry: HistoryEntry<TData> = {
        variant: "rows_add",
        count: rows.length,
        timestamp: Date.now(),
        undo: (currentData) => {
          return currentData.filter((row) => !rowIds.has(getRowId(row)));
        },
        redo: (currentData) => {
          return [...currentData, ...rowsCopy.map((row) => ({ ...row }))];
        },
      };

      store.push(entry);
    },
    [store, propsRef, onCommit],
  );

  const trackRowsDelete = React.useCallback(
    (rows: TData[]) => {
      if (!propsRef.current.enabled || rows.length === 0) return;

      onCommit();

      const { getRowId, data: currentData } = propsRef.current;

      const indexById = buildIndexById(currentData, getRowId);

      const rowsWithPositions: Array<{ index: number; row: TData }> = [];
      for (const row of rows) {
        const rowId = getRowId(row);
        const currentIndex = indexById.get(rowId);
        if (currentIndex !== undefined) {
          rowsWithPositions.push({
            index: currentIndex,
            row: { ...row },
          });
        }
      }

      rowsWithPositions.sort((a, b) => a.index - b.index);

      const rowIds = new Set(rows.map((row) => getRowId(row)));

      const entry: HistoryEntry<TData> = {
        variant: "rows_delete",
        count: rows.length,
        timestamp: Date.now(),
        undo: (currentData) => {
          const newData = [...currentData];
          for (const { index, row } of rowsWithPositions) {
            const insertIndex = Math.min(index, newData.length);
            newData.splice(insertIndex, 0, { ...row });
          }
          return newData;
        },
        redo: (currentData) => {
          return currentData.filter((row) => !rowIds.has(getRowId(row)));
        },
      };

      store.push(entry);
    },
    [store, propsRef, onCommit],
  );

  React.useEffect(() => {
    const pending = pendingBatchRef.current;
    return () => {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (!isCtrlOrCmd || (key !== "z" && key !== "y")) return;

      const activeElement = document.activeElement;
      if (activeElement) {
        const isInput =
          activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA";
        const isContentEditable =
          activeElement.getAttribute("contenteditable") === "true";
        const isInPopover = getIsInPopover(activeElement);

        if (isInput || isContentEditable || isInPopover) return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        onUndo();
        return;
      }

      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        onRedo();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, onUndo, onRedo]);

  return React.useMemo(
    () => ({
      canUndo,
      canRedo,
      onUndo,
      onRedo,
      onClear,
      trackCellsUpdate,
      trackRowsAdd,
      trackRowsDelete,
    }),
    [
      canUndo,
      canRedo,
      onUndo,
      onRedo,
      onClear,
      trackCellsUpdate,
      trackRowsAdd,
      trackRowsDelete,
    ],
  );
}

export {
  useDataGridUndoRedo,
  //
  type UndoRedoCellUpdate,
};
