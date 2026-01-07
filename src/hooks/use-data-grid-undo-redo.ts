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
  rowIndex: number;
  columnId: string;
  previousValue: unknown;
  newValue: unknown;
}

interface UndoRedoState<TData> {
  undoStack: HistoryEntry<TData>[];
  redoStack: HistoryEntry<TData>[];
  hasPendingChanges: boolean;
}

interface UndoRedoStore<TData> {
  subscribe: (callback: () => void) => () => void;
  getState: () => UndoRedoState<TData>;
  push: (entry: HistoryEntry<TData>) => void;
  undo: () => HistoryEntry<TData> | null;
  redo: () => HistoryEntry<TData> | null;
  clear: () => void;
  setPendingChanges: (value: boolean) => void;
  notify: () => void;
}

function useStore<T>(
  store: UndoRedoStore<T>,
  selector: (state: UndoRedoState<T>) => boolean,
): boolean {
  const getSnapshot = React.useCallback(
    () => selector(store.getState()),
    [store, selector],
  );

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

interface UseDataGridUndoRedoProps<TData> {
  data: TData[];
  onDataChange: (data: TData[]) => void;
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
  trackRowsAdd: (params: { startIndex: number; rows: TData[] }) => void;
  trackRowsDelete: (params: { indices: number[]; rows: TData[] }) => void;
}

function useDataGridUndoRedo<TData>({
  data,
  onDataChange,
  maxHistory = DEFAULT_MAX_HISTORY,
  enabled = true,
}: UseDataGridUndoRedoProps<TData>): UseDataGridUndoRedoReturn<TData> {
  const propsRef = useAsRef({
    data,
    onDataChange,
    maxHistory,
    enabled,
  });

  const listenersRef = useLazyRef(() => new Set<() => void>());

  const stateRef = useLazyRef<UndoRedoState<TData>>(() => ({
    undoStack: [],
    redoStack: [],
    hasPendingChanges: false,
  }));

  const pendingBatchRef = React.useRef<{
    updates: UndoRedoCellUpdate[];
    timeoutId: ReturnType<typeof setTimeout> | null;
  }>({
    updates: [],
    timeoutId: null,
  });

  const store = React.useMemo<UndoRedoStore<TData>>(() => {
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
        store.notify();
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
    if (pending.updates.length === 0) return;

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
      pending.timeoutId = null;
    }

    const updates = pending.updates;
    pending.updates = [];

    const entry: HistoryEntry<TData> = {
      variant: "cells_update",
      count: updates.length,
      timestamp: Date.now(),
      undo: (currentData) => {
        const newData = [...currentData];
        for (const update of updates) {
          const row = newData[update.rowIndex];
          if (row) {
            newData[update.rowIndex] = {
              ...row,
              [update.columnId]: update.previousValue,
            };
          }
        }
        return newData;
      },
      redo: (currentData) => {
        const newData = [...currentData];
        for (const update of updates) {
          const row = newData[update.rowIndex];
          if (row) {
            newData[update.rowIndex] = {
              ...row,
              [update.columnId]: update.newValue,
            };
          }
        }
        return newData;
      },
    };

    store.push(entry);
  }, [store]);

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
    pending.updates = [];

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
        const existingIdx = pending.updates.findIndex(
          (u) =>
            u.rowIndex === update.rowIndex && u.columnId === update.columnId,
        );

        if (existingIdx !== -1) {
          const existing = pending.updates[existingIdx];
          if (existing) {
            pending.updates[existingIdx] = {
              ...existing,
              newValue: update.newValue,
            };
          }
        } else {
          pending.updates.push(update);
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
    (params: { startIndex: number; rows: TData[] }) => {
      if (!propsRef.current.enabled || params.rows.length === 0) return;

      onCommit();

      const { startIndex, rows } = params;

      const indicesAsc = rows.map((_, i) => startIndex + i);
      const indicesDesc = [...indicesAsc].sort((a, b) => b - a);

      const rowsCopy = rows.map((row) => structuredClone(row));

      const entry: HistoryEntry<TData> = {
        variant: "rows_add",
        count: rows.length,
        timestamp: Date.now(),
        undo: (currentData) => {
          const newData = [...currentData];
          for (const index of indicesDesc) {
            newData.splice(index, 1);
          }
          return newData;
        },
        redo: (currentData) => {
          const newData = [...currentData];
          for (let i = 0; i < indicesAsc.length; i++) {
            const index = indicesAsc[i];
            const row = rowsCopy[i];
            if (index !== undefined && row) {
              newData.splice(index, 0, structuredClone(row));
            }
          }
          return newData;
        },
      };

      store.push(entry);
    },
    [store, propsRef, onCommit],
  );

  const trackRowsDelete = React.useCallback(
    (params: { indices: number[]; rows: TData[] }) => {
      if (!propsRef.current.enabled || params.indices.length === 0) return;

      onCommit();

      const { indices, rows } = params;

      const rowsWithIndices: Array<{ index: number; row: TData }> = [];
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        const row = rows[i];
        if (index !== undefined && row !== undefined) {
          rowsWithIndices.push({
            index,
            row: structuredClone(row),
          });
        }
      }
      rowsWithIndices.sort((a, b) => a.index - b.index);

      const indicesDesc = rowsWithIndices
        .map((item) => item.index)
        .sort((a, b) => b - a);

      const entry: HistoryEntry<TData> = {
        variant: "rows_delete",
        count: rows.length,
        timestamp: Date.now(),
        undo: (currentData) => {
          const newData = [...currentData];
          for (const { index, row } of rowsWithIndices) {
            newData.splice(index, 0, structuredClone(row));
          }
          return newData;
        },
        redo: (currentData) => {
          const newData = [...currentData];
          for (const index of indicesDesc) {
            newData.splice(index, 1);
          }
          return newData;
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
