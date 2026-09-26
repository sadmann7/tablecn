import {
  assignTableAPIs,
  columnFacetingFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  type RowData,
  type RowSelectionState,
  type TableFeature,
  type TableFeatures,
  tableFeatures,
} from "@tanstack/react-table";

import type {
  DataTableColumnMeta,
  DataTableMeta,
} from "@/lib/data-table-types";

interface SelectedRowsFeature<TData extends RowData> {
  /**
   * Returns the original data for every selected row id, including rows
   * selected on pages that are no longer loaded.
   */
  getSelectedRows: () => TData[];
}

declare module "@tanstack/react-table" {
  interface Plugins {
    selectedRowsFeature: TableFeature;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    selectedRowsFeature: SelectedRowsFeature<TData>;
  }
}

interface SelectedRowsInstance {
  _selectedRows: Map<string, unknown>;
  atoms: {
    rowSelection: {
      subscribe: (listener: (rowSelection: RowSelectionState) => void) => void;
    };
  };
  getCoreRowModel: () => { rowsById: Record<string, { original: unknown }> };
  getSelectedRowIds: () => string[];
}

function asSelectedRowsInstance(table: object) {
  return table as unknown as SelectedRowsInstance;
}

const selectedRowsFeature: TableFeature = {
  initTableInstanceData: (table) => {
    const instance = asSelectedRowsInstance(table);
    instance._selectedRows = new Map();
    const selectedRows = instance._selectedRows;

    instance.atoms.rowSelection.subscribe((rowSelection) => {
      for (const id of selectedRows.keys()) {
        if (rowSelection[id] !== true) selectedRows.delete(id);
      }

      const { rowsById } = instance.getCoreRowModel();
      for (const id of Object.keys(rowSelection)) {
        const row = rowsById[id];
        if (row) selectedRows.set(id, row.original);
      }
    });
  },
  constructTableAPIs: (table) => {
    const instance = asSelectedRowsInstance(table);

    assignTableAPIs("selectedRowsFeature", table, {
      table_getSelectedRows: {
        fn: () => {
          const { rowsById } = instance.getCoreRowModel();

          return instance.getSelectedRowIds().flatMap((id) => {
            const original =
              rowsById[id]?.original ?? instance._selectedRows.get(id);
            return original === undefined ? [] : [original];
          });
        },
      },
    });
  },
};

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnFacetingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  selectedRowsFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  tableMeta: metaHelper<DataTableMeta>(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
