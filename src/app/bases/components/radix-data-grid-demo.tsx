"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";

import { generateId } from "@/lib/id";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { getDataGridActionsColumn } from "@/registry/bases/radix/components/data-grid/data-grid-actions-column";
import { DataGridFilterMenu } from "@/registry/bases/radix/components/data-grid/data-grid-filter-menu";
import { DataGridKeyboardShortcuts } from "@/registry/bases/radix/components/data-grid/data-grid-keyboard-shortcuts";
import { DataGridRowHeightMenu } from "@/registry/bases/radix/components/data-grid/data-grid-row-height-menu";
import { getDataGridSelectColumn } from "@/registry/bases/radix/components/data-grid/data-grid-select-column";
import { DataGridSortMenu } from "@/registry/bases/radix/components/data-grid/data-grid-sort-menu";
import { DataGridViewMenu } from "@/registry/bases/radix/components/data-grid/data-grid-view-menu";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { DirectionProvider } from "@/registry/bases/radix/ui/direction";
import { DropdownMenuItem } from "@/registry/bases/radix/ui/dropdown-menu";

import { type Person } from "../../data-grid/lib/seeds";
import { useBasesDataGrid } from "../hooks/use-bases-data-grid";
import { getBasesDataGridColumns } from "../lib/data-grid-columns";

export function RadixDataGridDemo() {
  const { dir, data, setData, labels, columnFilters, sorting } =
    useBasesDataGrid();

  const columns = React.useMemo(
    () =>
      getBasesDataGridColumns({
        labels,
        selectColumn: getDataGridSelectColumn<Person>({
          enableRowMarkers: true,
        }),
        actionsColumn: getDataGridActionsColumn<Person>({
          actions: ({ row, table }) => (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => table.deleteRows([row.id])}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          ),
        }),
      }),
    [labels],
  );

  const { table, ...dataGridProps } = useDataGrid({
    data,
    columns,
    getRowId: (row) => row.id,
    onDataChange: setData,
    createRow: () => ({ id: generateId() }),
    initialState: {
      columnPinning: { start: ["select"], end: ["actions"] },
      columnFilters,
      sorting,
    },
    dir,
    enableRowDeletion: true,
    enableSearch: true,
    enablePaste: true,
  });

  return (
    <DirectionProvider dir={dir}>
      <div className="flex flex-col gap-2.5">
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <DataGridFilterMenu table={table} align="end" />
          <DataGridSortMenu table={table} align="end" />
          <DataGridRowHeightMenu table={table} align="end" />
          <DataGridViewMenu table={table} align="end" />
        </div>
        <DataGridKeyboardShortcuts
          enableSearch
          enableUndoRedo
          enablePaste
          enableRowCreation
          enableRowDeletion
        />
        <DataGrid {...dataGridProps} table={table} height={560} />
      </div>
    </DirectionProvider>
  );
}
