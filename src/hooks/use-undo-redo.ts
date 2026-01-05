"use client";

import * as React from "react";

import { useLazyRef } from "@/hooks/use-lazy-ref";

const DEFAULT_MAX_HISTORY = 100;

/**
 * Represents a single undoable operation
 */
interface UndoableOperation<TData> {
  type: "cell_update" | "cells_update" | "rows_add" | "rows_delete";
  timestamp: number;
  /** Description for debugging/UI purposes */
  description?: string;
  /** Function to undo this operation */
  undo: (currentData: TData[]) => TData[];
  /** Function to redo this operation */
  redo: (currentData: TData[]) => TData[];
}

interface CellUpdate {
  rowIndex: number;
  columnId: string;
  previousValue: unknown;
  newValue: unknown;
}


interface UndoRedoState<TData> {
  /** Stack of operations that can be undone */
  undoStack: UndoableOperation<TData>[];
  /** Stack of operations that can be redone */
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

export interface UseUndoRedoProps<TData> {
  /** The current data array */
  data: TData[];
  /** Callback when data changes (from undo/redo or tracked operations) */
  onDataChange: (data: TData[]) => void;
  /** Function to get a unique identifier for each row */
  getRowId?: (row: TData) => string;
  /** Maximum number of operations to keep in history */
  maxHistory?: number;
  /** Whether undo/redo is enabled */
  enabled?: boolean;
}

export interface UseUndoRedoReturn<TData> {
  /** Whether there are operations to undo */
  canUndo: boolean;
  /** Whether there are operations to redo */
  canRedo: boolean;
  /** Undo the last operation */
  undo: () => void;
  /** Redo the last undone operation */
  redo: () => void;
  /** Clear all history */
  clearHistory: () => void;
  /** Track a cell update for undo/redo */
  trackCellUpdate: (params: {
    rowIndex: number;
    columnId: string;
    previousValue: unknown;
    newValue: unknown;
  }) => void;
  /** Track multiple cell updates as a single operation */
  trackCellsUpdate: (updates: CellUpdate[]) => void;
  /** Track row additions for undo/redo */
  trackRowsAdd: (params: { startIndex: number; rows: TData[] }) => void;
  /** Track row deletions for undo/redo */
  trackRowsDelete: (params: { indices: number[]; rows: TData[] }) => void;
  /** Keyboard event handler for undo/redo shortcuts */
  onKeyDown: (event: React.KeyboardEvent | KeyboardEvent) => void;
}

export function useUndoRedo<TData>({
  data,
  onDataChange,
  getRowId,
  maxHistory = DEFAULT_MAX_HISTORY,
  enabled = true,
}: UseUndoRedoProps<TData>): UseUndoRedoReturn<TData> {
  const dataRef = React.useRef(data);
  dataRef.current = data;

  const onDataChangeRef = React.useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  const getRowIdRef = React.useRef(getRowId);
  getRowIdRef.current = getRowId;

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

        // Trim history if it exceeds max
        if (newUndoStack.length > maxHistory) {
          newUndoStack.shift();
        }

        stateRef.current = {
          undoStack: newUndoStack,
          // Clear redo stack when new operation is pushed
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
    if (!enabled) return;

    const operation = store.undo();
    if (!operation) return;

    const newData = operation.undo(dataRef.current);
    onDataChangeRef.current(newData);
  }, [store, enabled]);

  const redo = React.useCallback(() => {
    if (!enabled) return;

    const operation = store.redo();
    if (!operation) return;

    const newData = operation.redo(dataRef.current);
    onDataChangeRef.current(newData);
  }, [store, enabled]);

  const clearHistory = React.useCallback(() => {
    store.clear();
  }, [store]);

  const trackCellUpdate = React.useCallback(
    (params: {
      rowIndex: number;
      columnId: string;
      previousValue: unknown;
      newValue: unknown;
    }) => {
      if (!enabled) return;

      const { rowIndex, columnId, previousValue, newValue } = params;

      // Skip if values are the same
      if (Object.is(previousValue, newValue)) return;

      const operation: UndoableOperation<TData> = {
        type: "cell_update",
        timestamp: Date.now(),
        description: `Update cell at row ${rowIndex}, column ${columnId}`,
        undo: (currentData) => {
          const newData = [...currentData];
          const row = newData[rowIndex];
          if (row) {
            newData[rowIndex] = {
              ...row,
              [columnId]: previousValue,
            };
          }
          return newData;
        },
        redo: (currentData) => {
          const newData = [...currentData];
          const row = newData[rowIndex];
          if (row) {
            newData[rowIndex] = {
              ...row,
              [columnId]: newValue,
            };
          }
          return newData;
        },
      };

      store.pushOperation(operation);
    },
    [store, enabled],
  );

  const trackCellsUpdate = React.useCallback(
    (updates: CellUpdate[]) => {
      if (!enabled || updates.length === 0) return;

      // Skip if all values are the same
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
    [store, enabled],
  );

  const trackRowsAdd = React.useCallback(
    (params: { startIndex: number; rows: TData[] }) => {
      if (!enabled || params.rows.length === 0) return;

      const { startIndex, rows } = params;
      const indices = rows.map((_, i) => startIndex + i);

      // Store deep copies of the rows to prevent reference issues
      const rowsCopy = rows.map((row) => JSON.parse(JSON.stringify(row)) as TData);

      const operation: UndoableOperation<TData> = {
        type: "rows_add",
        timestamp: Date.now(),
        description: `Add ${rows.length} row(s)`,
        undo: (currentData) => {
          // Remove the rows at the specified indices (in reverse order to maintain indices)
          const newData = [...currentData];
          const sortedIndices = [...indices].sort((a, b) => b - a);
          for (const index of sortedIndices) {
            newData.splice(index, 1);
          }
          return newData;
        },
        redo: (currentData) => {
          // Re-add the rows at the specified indices
          const newData = [...currentData];
          for (let i = 0; i < indices.length; i++) {
            const index = indices[i];
            const row = rowsCopy[i];
            if (index !== undefined && row) {
              newData.splice(index, 0, JSON.parse(JSON.stringify(row)) as TData);
            }
          }
          return newData;
        },
      };

      store.pushOperation(operation);
    },
    [store, enabled],
  );

  const trackRowsDelete = React.useCallback(
    (params: { indices: number[]; rows: TData[] }) => {
      if (!enabled || params.indices.length === 0) return;

      const { indices, rows } = params;

      // Store deep copies of the rows to prevent reference issues
      // Pair each row with its original index for correct restoration
      const rowsWithIndices: Array<{ index: number; row: TData }> = [];
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        const row = rows[i];
        if (index !== undefined && row !== undefined) {
          // Use JSON parse/stringify for deep copy to handle nested objects
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
          // Restore the deleted rows at their original positions
          const newData = [...currentData];
          for (const { index, row } of rowsWithIndices) {
            newData.splice(index, 0, JSON.parse(JSON.stringify(row)) as TData);
          }
          return newData;
        },
        redo: (currentData) => {
          // Delete the rows again (in reverse order to maintain indices)
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
    [store, enabled],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent | KeyboardEvent) => {
      if (!enabled) return;

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Undo: Ctrl/Cmd + Z (without Shift)
      if (isCtrlOrCmd && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl/Cmd + Shift + Z OR Ctrl/Cmd + Y
      if (
        (isCtrlOrCmd && event.key.toLowerCase() === "z" && event.shiftKey) ||
        (isCtrlOrCmd && event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        redo();
        return;
      }
    },
    [enabled, undo, redo],
  );

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
    trackCellUpdate,
    trackCellsUpdate,
    trackRowsAdd,
    trackRowsDelete,
    onKeyDown,
  };
}

