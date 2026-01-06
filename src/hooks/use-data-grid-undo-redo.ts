"use client";

import * as React from "react";
import { toast } from "sonner";

import { useAsRef } from "@/hooks/use-as-ref";
import { useLazyRef } from "@/hooks/use-lazy-ref";

const DEFAULT_MAX_HISTORY = 100;

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
}

interface UndoRedoStore<TData> {
  subscribe: (callback: () => void) => () => void;
  getState: () => UndoRedoState<TData>;
  push: (entry: HistoryEntry<TData>) => void;
  undo: () => HistoryEntry<TData> | null;
  redo: () => HistoryEntry<TData> | null;
  clear: () => void;
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
    enabled,
  });

  const listenersRef = useLazyRef(() => new Set<() => void>());

  const stateRef = useLazyRef<UndoRedoState<TData>>(() => ({
    undoStack: [],
    redoStack: [],
  }));

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

        if (newUndoStack.length > maxHistory) {
          newUndoStack.shift();
        }

        stateRef.current = {
          undoStack: newUndoStack,
          redoStack: [],
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
        };
        store.notify();
        return entry;
      },
      clear: () => {
        stateRef.current = {
          undoStack: [],
          redoStack: [],
        };
        store.notify();
      },
      notify: () => {
        for (const listener of listenersRef.current) {
          listener();
        }
      },
    };
  }, [listenersRef, stateRef, maxHistory]);

  const canUndo = useStore(store, (state) => state.undoStack.length > 0);
  const canRedo = useStore(store, (state) => state.redoStack.length > 0);

  const onUndo = React.useCallback(() => {
    if (!propsRef.current.enabled) return;

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
  }, [store, propsRef]);

  const onRedo = React.useCallback(() => {
    if (!propsRef.current.enabled) return;

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
  }, [store, propsRef]);

  const onClear = React.useCallback(() => {
    store.clear();
  }, [store]);

  const trackCellsUpdate = React.useCallback(
    (updates: UndoRedoCellUpdate[]) => {
      if (!propsRef.current.enabled || updates.length === 0) return;

      const filteredUpdates = updates.filter(
        (u) => !Object.is(u.previousValue, u.newValue),
      );
      if (filteredUpdates.length === 0) return;

      const entry: HistoryEntry<TData> = {
        variant: "cells_update",
        count: filteredUpdates.length,
        timestamp: Date.now(),
        undo: (currentData) => {
          const newData = [...currentData];
          for (const update of filteredUpdates) {
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
          for (const update of filteredUpdates) {
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
    },
    [store, propsRef],
  );

  const trackRowsAdd = React.useCallback(
    (params: { startIndex: number; rows: TData[] }) => {
      if (!propsRef.current.enabled || params.rows.length === 0) return;

      const { startIndex, rows } = params;
      const indices = rows.map((_, i) => startIndex + i);

      const rowsCopy = rows.map(
        (row) => JSON.parse(JSON.stringify(row)) as TData,
      );

      const entry: HistoryEntry<TData> = {
        variant: "rows_add",
        count: rows.length,
        timestamp: Date.now(),
        undo: (currentData) => {
          const newData = [...currentData];
          const sortedIndices = [...indices].sort((a, b) => b - a);
          for (const index of sortedIndices) {
            newData.splice(index, 1);
          }
          return newData;
        },
        redo: (currentData) => {
          const newData = [...currentData];
          for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            const row = rowsCopy[i];
            if (index !== undefined && row) {
              newData.splice(
                index,
                0,
                JSON.parse(JSON.stringify(row)) as TData,
              );
            }
          }
          return newData;
        },
      };

      store.push(entry);
    },
    [store, propsRef],
  );

  const trackRowsDelete = React.useCallback(
    (params: { indices: number[]; rows: TData[] }) => {
      if (!propsRef.current.enabled || params.indices.length === 0) return;

      const { indices, rows } = params;

      const rowsWithIndices: Array<{ index: number; row: TData }> = [];
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        const row = rows[i];
        if (index !== undefined && row !== undefined) {
          rowsWithIndices.push({
            index,
            row: JSON.parse(JSON.stringify(row)) as TData,
          });
        }
      }
      rowsWithIndices.sort((a, b) => a.index - b.index);

      const entry: HistoryEntry<TData> = {
        variant: "rows_delete",
        count: rows.length,
        timestamp: Date.now(),
        undo: (currentData) => {
          const newData = [...currentData];
          for (const { index, row } of rowsWithIndices) {
            newData.splice(index, 0, JSON.parse(JSON.stringify(row)) as TData);
          }
          return newData;
        },
        redo: (currentData) => {
          const newData = [...currentData];
          const sortedIndices = rowsWithIndices
            .map((item) => item.index)
            .sort((a, b) => b - a);
          for (const index of sortedIndices) {
            newData.splice(index, 1);
          }
          return newData;
        },
      };

      store.push(entry);
    },
    [store, propsRef],
  );

  React.useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        onUndo();
        return;
      }

      if (
        (isCtrlOrCmd && event.key.toLowerCase() === "z" && event.shiftKey) ||
        (isCtrlOrCmd && event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        onRedo();
        return;
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
  type UseDataGridUndoRedoProps,
  type UndoRedoCellUpdate,
};
