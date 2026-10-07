import {
  assignTableAPIs,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  functionalUpdate,
  makeStateUpdater,
  metaHelper,
  type OnChangeFn,
  type RowData,
  rowSelectionFeature,
  rowSortingFeature,
  type Table,
  type TableFeature,
  type TableFeatures,
  tableFeatures,
  type Updater,
} from "@tanstack/react-table";

import type {
  DataGridColumnMeta,
  DataGridTableMeta,
  RowHeightValue,
} from "@/lib/data-grid-types";

import { getLineCount, getRowHeightValue } from "@/lib/data-grid-utils";

const DEFAULT_ROW_HEIGHT: RowHeightValue = "short";

interface TableState_DataGridRowHeight {
  rowHeight: RowHeightValue;
}

interface TableOptions_DataGridRowHeight {
  onRowHeightChange?: OnChangeFn<RowHeightValue>;
}

interface Table_DataGridRowHeight {
  getRowHeight: () => RowHeightValue;
  getRowSize: () => number;
  getRowLineCount: () => number;
  setRowHeight: (updater: Updater<RowHeightValue>) => void;
  resetRowHeight: (defaultState?: boolean) => void;
}

declare module "@tanstack/react-table" {
  interface Plugins {
    dataGridRowHeightFeature: TableFeature;
  }

  interface TableState_FeatureMap {
    dataGridRowHeightFeature: TableState_DataGridRowHeight;
  }

  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridRowHeightFeature: TableOptions_DataGridRowHeight;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridRowHeightFeature: Table_DataGridRowHeight;
  }
}

type DataGridInstance = Table<DataGridFeatures, RowData>;

/**
 * Feature hooks get a `Table` generic over any features. This feature is only
 * registered in `dataGridFeatures`, so its hooks can use that table's types.
 */
function asDataGrid(table: object) {
  return table as DataGridInstance;
}

const dataGridRowHeightFeature: TableFeature = {
  getInitialState: (initialState) => ({
    rowHeight: DEFAULT_ROW_HEIGHT,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataGridRowHeight = {
      onRowHeightChange: makeStateUpdater("rowHeight", table),
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    const setRowHeight = (updater: Updater<RowHeightValue>) =>
      instance.options.onRowHeightChange?.((old) =>
        functionalUpdate(updater, old),
      );

    assignTableAPIs("dataGridRowHeightFeature", table, {
      table_getRowHeight: {
        fn: () => instance.atoms.rowHeight.get(),
      },
      table_getRowSize: {
        fn: () => getRowHeightValue(instance.atoms.rowHeight.get()),
      },
      table_getRowLineCount: {
        fn: () => getLineCount(instance.atoms.rowHeight.get()),
      },
      table_setRowHeight: { fn: setRowHeight },
      table_resetRowHeight: {
        fn: (defaultState?: boolean) =>
          setRowHeight(
            defaultState
              ? DEFAULT_ROW_HEIGHT
              : (instance.initialState.rowHeight ?? DEFAULT_ROW_HEIGHT),
          ),
      },
    });
  },
};

export const dataGridFeatures = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  dataGridRowHeightFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  tableMeta: metaHelper<DataGridTableMeta>(),
  columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
