"use client";

import type { Table, TableState } from "@tanstack/react-table";
import { useEffect, useRef } from "react";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

interface PersistedGridState {
  sorting: TableState["sorting"];
  columnFilters: TableState["columnFilters"];
  columnVisibility: TableState["columnVisibility"];
}

interface DataGridPersistenceProps<TData> {
  table: Table<TData>;
  storageKey: string;
}

export function DataGridPersistence<TData>({
  table,
  storageKey,
}: DataGridPersistenceProps<TData>) {
  const hasLoadedRef = useRef(false);

  // Load from localStorage on mount (only once)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    try {
      const stored = localStorage.getItem(`grid-state-${storageKey}`);
      if (!stored) return;

      const parsed = JSON.parse(stored) as PersistedGridState;

      if (parsed.sorting) {
        table.setSorting(parsed.sorting);
      }
      if (parsed.columnFilters) {
        table.setColumnFilters(parsed.columnFilters);
      }
      if (parsed.columnVisibility) {
        table.setColumnVisibility(parsed.columnVisibility);
      }
    } catch (error) {
      console.warn(`Failed to load grid state for "${storageKey}":`, error);
    }
  }, [storageKey, table]);

  // Get current state from table
  const tableState = table.getState();
  const sorting = tableState.sorting;
  const columnFilters = tableState.columnFilters;
  const columnVisibility = tableState.columnVisibility;

  // Debounced save function
  const debouncedSave = useDebouncedCallback((state: PersistedGridState) => {
    try {
      localStorage.setItem(`grid-state-${storageKey}`, JSON.stringify(state));
    } catch (error) {
      console.warn(`Failed to save grid state for "${storageKey}":`, error);
    }
  }, 300);

  // Subscribe to state changes and save to localStorage
  useEffect(() => {
    debouncedSave({
      sorting: sorting ?? [],
      columnFilters: columnFilters ?? [],
      columnVisibility: columnVisibility ?? {},
    });
  }, [sorting, columnFilters, columnVisibility, debouncedSave]);

  return null;
}
