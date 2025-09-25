"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { DataGridCell } from "@/components/data-grid/data-grid-cell";

interface CellPosition {
  rowIndex: number;
  columnId: string;
}

interface UseDataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onDataChange?: (data: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;
  enableSorting?: boolean;
  initialSorting?: SortingState;
  estimateRowSize?: number;
  overscan?: number;
}

export function useDataGrid<TData>({
  data,
  columns,
  onDataChange,
  getRowId,
  enableSorting = true,
  initialSorting = [],
  estimateRowSize = 35,
  overscan = 3,
}: UseDataGridProps<TData>) {
  const gridRef = React.useRef<HTMLDivElement>(null);

  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [focusedCell, setFocusedCell] = React.useState<CellPosition | null>(
    null,
  );
  const [editingCell, setEditingCell] = React.useState<CellPosition | null>(
    null,
  );

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
        // Second click on same cell - start editing
        startEditing(rowIndex, columnId);
      } else {
        // First click or different cell - just focus
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

  const navigateCell = React.useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!focusedCell) return;

      const { rowIndex, columnId } = focusedCell;
      const columnIds = columns
        .map((col) => {
          if (col.id) return col.id;
          if ("accessorKey" in col) return col.accessorKey as string;
          return undefined;
        })
        .filter((id): id is string => Boolean(id));
      const currentColIndex = columnIds.indexOf(columnId);

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
      }

      if (newRowIndex !== rowIndex || newColumnId !== columnId) {
        focusCell(newRowIndex, newColumnId);
      }
    },
    [focusedCell, columns, data.length, focusCell],
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
  };
}
