"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type SortingState,
  type TableOptions,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

interface UseDataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  onDataChange?: (data: TData[]) => void;
  getRowId?: (row: TData, index: number) => string;
  enableSorting?: boolean;
  initialSorting?: SortingState;
  defaultColumn?: Partial<ColumnDef<TData>>;
}

export function useDataGrid<TData>({
  data,
  columns,
  onDataChange,
  getRowId,
  enableSorting = true,
  initialSorting = [],
  defaultColumn,
}: UseDataGridProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);

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

  const handleSortingChange: OnChangeFn<SortingState> = React.useCallback(
    (updater) => {
      setSorting(updater);
    },
    [],
  );

  const tableOptions: TableOptions<TData> = React.useMemo(
    () => ({
      data,
      columns,
      defaultColumn,
      state: {
        sorting,
      },
      onSortingChange: handleSortingChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      manualSorting: false,
      enableSorting,
      getRowId,
      meta: {
        updateData,
      },
    }),
    [
      data,
      columns,
      defaultColumn,
      sorting,
      handleSortingChange,
      enableSorting,
      getRowId,
      updateData,
    ],
  );

  const table = useReactTable(tableOptions);

  const { rows } = table.getRowModel();

  return {
    table,
    rows,
    sorting,
    setSorting,
  };
}
