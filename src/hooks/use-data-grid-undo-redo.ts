"use client";

import * as React from "react";

import { useAsRef } from "@/hooks/use-as-ref";
import { useLazyRef } from "@/hooks/use-lazy-ref";

const DEFAULT_MAX_HISTORY = 100;

interface UndoableOperation<TData> {
  type: "cells_update" | "rows_add" | "rows_delete";
  timestamp: number;
  description?: string;
  undo: (currentData: TData[]) => TData[];
  redo: (currentData: TData[]) => TData[];
}

interface CellUpdate {
  rowIndex: number;
  columnId: string;
  previousValue: unknown;
  newValue: unknown;
}

interface UndoRedoState<TData> {
  undoStack: UndoableOperation<TData>[];
  redoStack: UndoableOperation<TData>[];
}

interface UndoRedoStore<TData> {
  subscribe: (callback: () => void) => () => void;
  getState: () => UndoRedoState<TData>;
  pushOperation: (operation: UndoableOperation<TData>) => void;
  undo: () => UndoableOperation<TData> | null;
  redo: () => UndoableOperation<TData> | null;
  clear: () => void;
  notify: () => void;
}

function useUndoRedoStore<T>(
  store: UndoRedoStore<T>,
  selector: (state: UndoRedoState<T>) => boolean,
): boolean {
  const getSnapshot = React.useCallback(
    () => selector(store.getState()),
    [store, selector],
  );

  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export interface UseDataGridUndoRedoProps<TData> {
  data: TData[];
  onDataChange: (data: TData[]) => void;
  getRowId?: (row: TData) => string;
  maxHistory?: number;
  enabled?: boolean;
}

export interface UseDataGridUndoRedoReturn<TData> {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  trackCellsUpdate: (updates: CellUpdate[]) => void;
  trackRowsAdd: (params: { startIndex: number; rows: TData[] }) => void;
  trackRowsDelete: (params: { indices: number[]; rows: TData[] }) => void;
}

export function useDataGridUndoRedo<TData>({
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
      pushOperation: (operation) => {
        const state = stateRef.current;
        const newUndoStack = [...state.undoStack, operation];

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

        const operation = state.undoStack[state.undoStack.length - 1];
        if (!operation) return null;

        stateRef.current = {
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, operation],
        };
        store.notify();
        return operation;
      },
      redo: () => {
        const state = stateRef.current;
        if (state.redoStack.length === 0) return null;

        const operation = state.redoStack[state.redoStack.length - 1];
        if (!operation) return null;

        stateRef.current = {
          undoStack: [...state.undoStack, operation],
          redoStack: state.redoStack.slice(0, -1),
        };
        store.notify();
        return operation;
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

  const canUndo = useUndoRedoStore(
    store,
    (state) => state.undoStack.length > 0,
  );
  const canRedo = useUndoRedoStore(
    store,
    (state) => state.redoStack.length > 0,
  );

  const undo = React.useCallback(() => {
    if (!propsRef.current.enabled) return;

    const operation = store.undo();
    if (!operation) return;

    const newData = operation.undo(propsRef.current.data);
    propsRef.current.onDataChange(newData);
  }, [store, propsRef]);

  const redo = React.useCallback(() => {
    if (!propsRef.current.enabled) return;

    const operation = store.redo();
    if (!operation) return;

    const newData = operation.redo(propsRef.current.data);
    propsRef.current.onDataChange(newData);
  }, [store, propsRef]);

  const clearHistory = React.useCallback(() => {
    store.clear();
  }, [store]);

  const trackCellsUpdate = React.useCallback(
    (updates: CellUpdate[]) => {
      if (!propsRef.current.enabled || updates.length === 0) return;

      const filteredUpdates = updates.filter(
        (u) => !Object.is(u.previousValue, u.newValue),
      );
      if (filteredUpdates.length === 0) return;

      const operation: UndoableOperation<TData> = {
        type: "cells_update",
        timestamp: Date.now(),
        description: `Update ${filteredUpdates.length} cell(s)`,
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

      store.pushOperation(operation);
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

      const operation: UndoableOperation<TData> = {
        type: "rows_add",
        timestamp: Date.now(),
        description: `Add ${rows.length} row(s)`,
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

      store.pushOperation(operation);
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

      const operation: UndoableOperation<TData> = {
        type: "rows_delete",
        timestamp: Date.now(),
        description: `Delete ${rows.length} row(s)`,
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

      store.pushOperation(operation);
    },
    [store, propsRef],
  );

  React.useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if (
        (isCtrlOrCmd && event.key.toLowerCase() === "z" && event.shiftKey) ||
        (isCtrlOrCmd && event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        redo();
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, undo, redo]);

  return React.useMemo(
    () => ({
      canUndo,
      canRedo,
      undo,
      redo,
      clearHistory,
      trackCellsUpdate,
      trackRowsAdd,
      trackRowsDelete,
    }),
    [
      canUndo,
      canRedo,
      undo,
      redo,
      clearHistory,
      trackCellsUpdate,
      trackRowsAdd,
      trackRowsDelete,
    ],
  );
}
