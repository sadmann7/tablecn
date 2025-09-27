"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { DataGridCell } from "@/components/data-grid/data-grid-cell";
import type {
  CellPosition,
  NavigationDirection,
  ScrollToOptions,
} from "@/types/data-grid";

interface UseDataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onDataChange?: (data: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;
  initialSorting?: SortingState;
  estimateRowSize?: number;
  overscan?: number;
  autoFocus?: boolean;
  enableSorting?: boolean;
}

export function useDataGrid<TData>({
  data,
  columns,
  onDataChange,
  getRowId,
  initialSorting = [],
  estimateRowSize = 35,
  overscan = 3,
  autoFocus = false,
  enableSorting = true,
}: UseDataGridProps<TData>) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [focusedCell, setFocusedCell] = React.useState<CellPosition | null>(
    null,
  );
  const [editingCell, setEditingCell] = React.useState<CellPosition | null>(
    null,
  );

  const rowVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);

  const updateData = React.useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      const newData = data.map((row, index) => {
        if (index === rowIndex) {
          return {
            ...row,
            [columnId]: value,
          };
        }
        return row;
      });
      onDataChange?.(newData);
    },
    [data, onDataChange],
  );

  const focusCell = React.useCallback((rowIndex: number, columnId: string) => {
    setFocusedCell({ rowIndex, columnId });
    setEditingCell(null);

    if (gridRef.current && document.activeElement !== gridRef.current) {
      gridRef.current.focus();
    }
  }, []);

  const startEditing = React.useCallback(
    (rowIndex: number, columnId: string) => {
      setFocusedCell({ rowIndex, columnId });
      setEditingCell({ rowIndex, columnId });
    },
    [],
  );

  const stopEditing = React.useCallback(() => {
    setEditingCell(null);
  }, []);

  const blurCell = React.useCallback(() => {
    if (editingCell && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setFocusedCell(null);
    setEditingCell(null);
  }, [editingCell]);

  const onCellClick = React.useCallback(
    (rowIndex: number, columnId: string) => {
      const currentFocused = focusedCell;

      if (
        currentFocused?.rowIndex === rowIndex &&
        currentFocused?.columnId === columnId
      ) {
        startEditing(rowIndex, columnId);
      } else {
        focusCell(rowIndex, columnId);
      }
    },
    [focusedCell, focusCell, startEditing],
  );

  const onCellDoubleClick = React.useCallback(
    (rowIndex: number, columnId: string) => {
      startEditing(rowIndex, columnId);
    },
    [startEditing],
  );

  const getColumnIds = React.useCallback(() => {
    return columns
      .map((col) => {
        if (col.id) return col.id;
        if ("accessorKey" in col) return col.accessorKey as string;
        return undefined;
      })
      .filter((id): id is string => Boolean(id));
  }, [columns]);

  const navigateCell = React.useCallback(
    (direction: NavigationDirection) => {
      if (!focusedCell) return;

      const { rowIndex, columnId } = focusedCell;
      const columnIds = getColumnIds();
      const currentColIndex = columnIds.indexOf(columnId);
      const rowVirtualizer = rowVirtualizerRef.current;

      let newRowIndex = rowIndex;
      let newColumnId = columnId;

      switch (direction) {
        case "up":
          newRowIndex = Math.max(0, rowIndex - 1);
          break;
        case "down":
          newRowIndex = Math.min(data.length - 1, rowIndex + 1);
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
          newRowIndex = Math.max(0, data.length - 1);
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
            newRowIndex = Math.min(data.length - 1, rowIndex + pageSize);
          } else {
            newRowIndex = Math.min(data.length - 1, rowIndex + 10);
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
    [focusedCell, getColumnIds, data.length, focusCell],
  );

  const onKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (editingCell) return;

      if (!focusedCell) return;

      const { key, ctrlKey, metaKey } = event;
      const isCtrlPressed = ctrlKey || metaKey;

      let direction: NavigationDirection | null = null;

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
        case "Enter":
          if (focusedCell) {
            event.preventDefault();
            startEditing(focusedCell.rowIndex, focusedCell.columnId);
          }
          return;
        case "Escape":
          event.preventDefault();
          blurCell();
          return;
        case "Tab":
          event.preventDefault();
          direction = event.shiftKey ? "left" : "right";
          break;
      }

      if (direction) {
        event.preventDefault();
        navigateCell(direction);
      }
    },
    [editingCell, focusedCell, startEditing, blurCell, navigateCell],
  );

  const defaultColumn: Partial<ColumnDef<TData>> = React.useMemo(
    () => ({
      cell: ({ cell, table }) => <DataGridCell cell={cell} table={table} />,
    }),
    [],
  );

  const table = useReactTable({
    data,
    columns,
    defaultColumn,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: false,
    enableSorting,
    getRowId,
    meta: {
      updateData,
      focusedCell,
      editingCell,
      onCellClick,
      onCellDoubleClick,
      startEditing,
      stopEditing,
      navigateCell,
      blurCell,
    },
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => estimateRowSize,
    overscan,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  if (rowVirtualizerRef.current) {
    rowVirtualizerRef.current = rowVirtualizer;
  }

  const scrollToRowAndFocusCell = React.useCallback(
    (options: ScrollToOptions) => {
      const { rowIndex, columnId } = options;

      rowVirtualizer.scrollToIndex(rowIndex, {
        align: "center",
      });

      const columnIds = getColumnIds();
      const targetColumnId = columnId || columnIds[0];

      if (targetColumnId) {
        requestAnimationFrame(() => {
          focusCell(rowIndex, targetColumnId);
        });
      }
    },
    [rowVirtualizer, getColumnIds, focusCell],
  );

  React.useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) return;

    gridElement.addEventListener("keydown", onKeyDown);
    return () => {
      gridElement.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown]);

  React.useEffect(() => {
    if (autoFocus && data.length > 0 && columns.length > 0 && !focusedCell) {
      const columnIds = getColumnIds();
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
    focusedCell,
    getColumnIds,
    focusCell,
  ]);

  React.useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(event.target as Node)) {
        table.options.meta?.blurCell();
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [table]);

  return {
    gridRef,
    table,
    rows,
    rowVirtualizer,
    sorting,
    setSorting,
    focusedCell,
    editingCell,
    focusCell,
    startEditing,
    stopEditing,
    navigateCell,
    blurCell,
    onKeyDown,
    scrollToRowAndFocusCell,
  };
}
