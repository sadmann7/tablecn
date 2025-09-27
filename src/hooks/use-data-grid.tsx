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
  CellRange,
  NavigationDirection,
  ScrollToOptions,
  SelectionState,
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
  const tableRef = React.useRef<ReturnType<typeof useReactTable<TData>> | null>(
    null,
  );
  const rowVirtualizerRef =
    React.useRef<Virtualizer<HTMLDivElement, Element>>(null);
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [focusedCell, setFocusedCell] = React.useState<CellPosition | null>(
    null,
  );
  const [editingCell, setEditingCell] = React.useState<CellPosition | null>(
    null,
  );
  const [selectionState, setSelectionState] = React.useState<SelectionState>({
    selectedCells: new Set(),
    selectionRange: null,
    isSelecting: false,
  });

  const getColumnIds = React.useCallback(() => {
    return columns
      .map((col) => {
        if (col.id) return col.id;
        if ("accessorKey" in col) return col.accessorKey as string;
        return undefined;
      })
      .filter((id): id is string => Boolean(id));
  }, [columns]);

  const updateData = React.useCallback(
    (sortedRowIndex: number, columnId: string, value: unknown) => {
      const currentTable = tableRef.current;
      if (!currentTable) {
        const newData = data.map((row, index) => {
          if (index === sortedRowIndex) {
            return {
              ...row,
              [columnId]: value,
            };
          }
          return row;
        });
        onDataChange?.(newData);
        return;
      }

      const row = currentTable.getRowModel().rows[sortedRowIndex];
      if (!row) return;

      const originalData = row.original;
      const originalRowIndex = data.indexOf(originalData);

      if (originalRowIndex === -1) return;

      const newData = data.map((row, index) => {
        if (index === originalRowIndex) {
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
    setSelectionState({
      selectedCells: new Set(),
      selectionRange: null,
      isSelecting: false,
    });
  }, []);

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

    setSelectionState({
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
  }, [getCellKey, getColumnIds, data.length]);

  const selectRange = React.useCallback(
    (start: CellPosition, end: CellPosition) => {
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

      setSelectionState({
        selectedCells,
        selectionRange: { start, end },
        isSelecting: false,
      });
    },
    [getColumnIds, getCellKey],
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
    (rowIndex: number, columnId: string, event?: React.MouseEvent) => {
      const currentFocused = focusedCell;

      if (event) {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          const cellKey = getCellKey(rowIndex, columnId);
          const newSelectedCells = new Set(selectionState.selectedCells);

          if (newSelectedCells.has(cellKey)) {
            newSelectedCells.delete(cellKey);
          } else {
            newSelectedCells.add(cellKey);
          }

          setSelectionState({
            selectedCells: newSelectedCells,
            selectionRange: null,
            isSelecting: false,
          });
          focusCell(rowIndex, columnId);
          return;
        }

        if (event.shiftKey && focusedCell) {
          event.preventDefault();
          selectRange(focusedCell, { rowIndex, columnId });
          return;
        }
      }

      if (selectionState.selectedCells.size > 0) {
        clearSelection();
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
    [
      focusedCell,
      focusCell,
      startEditing,
      getCellKey,
      selectionState.selectedCells,
      selectRange,
      clearSelection,
    ],
  );

  const onCellDoubleClick = React.useCallback(
    (rowIndex: number, columnId: string) => {
      startEditing(rowIndex, columnId);
    },
    [startEditing],
  );

  const onCellMouseDown = React.useCallback(
    (rowIndex: number, columnId: string, event: React.MouseEvent) => {
      event.preventDefault();

      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        setSelectionState((prev) => ({
          ...prev,
          isSelecting: true,
          selectionRange: {
            start: { rowIndex, columnId },
            end: { rowIndex, columnId },
          },
          selectedCells: new Set([getCellKey(rowIndex, columnId)]),
        }));
      }
    },
    [getCellKey],
  );

  const onCellMouseEnter = React.useCallback(
    (rowIndex: number, columnId: string, _event: React.MouseEvent) => {
      if (selectionState.isSelecting && selectionState.selectionRange) {
        const start = selectionState.selectionRange.start;
        const end = { rowIndex, columnId };

        if (
          focusedCell?.rowIndex !== start.rowIndex ||
          focusedCell?.columnId !== start.columnId
        ) {
          focusCell(start.rowIndex, start.columnId);
        }

        selectRange(start, end);
        setSelectionState((prev) => ({
          ...prev,
          selectionRange: { start, end },
          isSelecting: true,
        }));
      }
    },
    [
      selectionState.isSelecting,
      selectionState.selectionRange,
      selectRange,
      focusedCell,
      focusCell,
    ],
  );

  const onCellMouseUp = React.useCallback(() => {
    setSelectionState((prev) => ({
      ...prev,
      isSelecting: false,
    }));
  }, []);

  const navigateCell = React.useCallback(
    (direction: NavigationDirection) => {
      if (!focusedCell) return;

      const { rowIndex, columnId } = focusedCell;
      const columnIds = getColumnIds();
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
    [focusedCell, getColumnIds, focusCell, data.length],
  );

  const onKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (editingCell) return;

      if (!focusedCell) return;

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const isCtrlPressed = ctrlKey || metaKey;

      let direction: NavigationDirection | null = null;

      if (isCtrlPressed && key === "a") {
        event.preventDefault();
        selectAll();
        return;
      }

      if (key === "Delete" || key === "Backspace") {
        if (selectionState.selectedCells.size > 0) {
          event.preventDefault();
          selectionState.selectedCells.forEach((cellKey) => {
            const parts = cellKey.split(":");
            const rowIndexStr = parts[0];
            const columnId = parts[1];
            if (rowIndexStr && columnId) {
              const rowIndex = parseInt(rowIndexStr, 10);
              if (!Number.isNaN(rowIndex)) {
                updateData(rowIndex, columnId, "");
              }
            }
          });
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
          if (selectionState.selectedCells.size > 0) {
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

        if (shiftKey && focusedCell) {
          const columnIds = getColumnIds();
          const currentColIndex = columnIds.indexOf(focusedCell.columnId);
          let newRowIndex = focusedCell.rowIndex;
          let newColumnId = focusedCell.columnId;

          switch (direction) {
            case "up":
              newRowIndex = Math.max(0, focusedCell.rowIndex - 1);
              break;
            case "down":
              newRowIndex = Math.min(
                (tableRef.current?.getRowModel().rows.length || data.length) -
                  1,
                focusedCell.rowIndex + 1,
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
            selectionState.selectionRange?.start || focusedCell;
          selectRange(selectionStart, {
            rowIndex: newRowIndex,
            columnId: newColumnId,
          });
          focusCell(newRowIndex, newColumnId);
        } else {
          if (selectionState.selectedCells.size > 0) {
            clearSelection();
          }
          navigateCell(direction);
        }
      }
    },
    [
      editingCell,
      focusedCell,
      blurCell,
      navigateCell,
      selectAll,
      selectionState,
      updateData,
      clearSelection,
      getColumnIds,
      data.length,
      selectRange,
      focusCell,
    ],
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
    enableSorting,
    getRowId,
    meta: {
      updateData,
      focusedCell,
      editingCell,
      selectionState,
      onCellClick,
      onCellDoubleClick,
      onCellMouseDown,
      onCellMouseEnter,
      onCellMouseUp,
      startEditing,
      stopEditing,
      navigateCell,
      blurCell,
      clearSelection,
      selectAll,
      getIsCellSelected,
    },
  });

  if (!tableRef.current) {
    tableRef.current = table;
  }

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

  if (!rowVirtualizerRef.current) {
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
        if (selectionState.selectedCells.size > 0) {
          clearSelection();
        }
      }
    }

    document.addEventListener("mousedown", onOutsideClick);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [table, selectionState.selectedCells.size, clearSelection]);

  React.useEffect(() => {
    if (selectionState.isSelecting) {
      function preventSelection(event: Event) {
        event.preventDefault();
      }
      function preventContextMenu(event: Event) {
        event.preventDefault();
      }

      document.addEventListener("selectstart", preventSelection);
      document.addEventListener("contextmenu", preventContextMenu);
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("selectstart", preventSelection);
        document.removeEventListener("contextmenu", preventContextMenu);
        document.body.style.userSelect = "";
      };
    }
  }, [selectionState.isSelecting]);

  return {
    gridRef,
    table,
    rows,
    rowVirtualizer,
    sorting,
    setSorting,
    focusedCell,
    editingCell,
    selectionState,
    focusCell,
    startEditing,
    stopEditing,
    blurCell,
    navigateCell,
    onKeyDown,
    getIsCellSelected,
    selectAll,
    clearSelection,
    scrollToRowAndFocusCell,
  };
}
