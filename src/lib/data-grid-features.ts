import {
  assignPrototypeAPIs,
  assignTableAPIs,
  type CellData,
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
  CellPosition,
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

interface TableState_DataGridCellEditing {
  editingCell: CellPosition | null;
}

interface TableOptions_DataGridCellEditing {
  /** Set to `false` to make every cell read-only. Defaults to `true`. */
  enableCellEditing?: boolean;
  onEditingCellChange?: OnChangeFn<CellPosition | null>;
}

interface ColumnDef_DataGridCellEditing {
  /** Set to `false` to make this column's cells read-only. Defaults to `true`. */
  enableCellEditing?: boolean;
}

interface Table_DataGridCellEditing {
  getEditingCell: () => CellPosition | null;
  setEditingCell: (updater: Updater<CellPosition | null>) => void;
  resetEditingCell: (defaultState?: boolean) => void;
}

interface Column_DataGridCellEditing {
  getCanEdit: () => boolean;
}

interface Cell_DataGridCellEditing {
  getCanEdit: () => boolean;
  getIsEditing: () => boolean;
}

declare module "@tanstack/react-table" {
  interface Plugins {
    dataGridRowHeightFeature: TableFeature;
    dataGridCellEditingFeature: TableFeature;
  }

  interface TableState_FeatureMap {
    dataGridRowHeightFeature: TableState_DataGridRowHeight;
    dataGridCellEditingFeature: TableState_DataGridCellEditing;
  }

  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridRowHeightFeature: TableOptions_DataGridRowHeight;
    dataGridCellEditingFeature: TableOptions_DataGridCellEditing;
  }

  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData,
  > {
    dataGridCellEditingFeature: ColumnDef_DataGridCellEditing;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridRowHeightFeature: Table_DataGridRowHeight;
    dataGridCellEditingFeature: Table_DataGridCellEditing;
  }

  interface Column_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridCellEditingFeature: Column_DataGridCellEditing;
  }

  interface Cell_FeatureMap {
    dataGridCellEditingFeature: Cell_DataGridCellEditing;
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

function getCanEditColumn(column: {
  table: object;
  columnDef: ColumnDef_DataGridCellEditing;
}) {
  return (
    asDataGrid(column.table).options.enableCellEditing !== false &&
    column.columnDef.enableCellEditing !== false
  );
}

const dataGridCellEditingFeature: TableFeature = {
  getInitialState: (initialState) => ({
    editingCell: null,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataGridCellEditing = {
      onEditingCellChange: makeStateUpdater("editingCell", table),
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    const setEditingCell = (updater: Updater<CellPosition | null>) =>
      instance.options.onEditingCellChange?.((old) =>
        functionalUpdate(updater, old),
      );

    assignTableAPIs("dataGridCellEditingFeature", table, {
      table_getEditingCell: {
        fn: () => instance.atoms.editingCell.get(),
      },
      table_setEditingCell: { fn: setEditingCell },
      table_resetEditingCell: {
        fn: (defaultState?: boolean) =>
          setEditingCell(
            defaultState ? null : (instance.initialState.editingCell ?? null),
          ),
      },
    });
  },
  assignColumnPrototype: (prototype, table) => {
    assignPrototypeAPIs("dataGridCellEditingFeature", prototype, table, {
      column_getCanEdit: { fn: getCanEditColumn },
    });
  },
  assignCellPrototype: (prototype, table) => {
    assignPrototypeAPIs("dataGridCellEditingFeature", prototype, table, {
      cell_getCanEdit: {
        fn: (cell: { column: Parameters<typeof getCanEditColumn>[0] }) =>
          getCanEditColumn(cell.column),
      },
      cell_getIsEditing: {
        fn: (cell: {
          table: object;
          row: { id: string };
          column: { id: string };
        }) => {
          const editingCell = asDataGrid(cell.table).atoms.editingCell.get();
          return (
            editingCell?.rowId === cell.row.id &&
            editingCell.columnId === cell.column.id
          );
        },
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
  dataGridCellEditingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  tableMeta: metaHelper<DataGridTableMeta>(),
  columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
