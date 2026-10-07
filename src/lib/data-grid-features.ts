import {
  assignPrototypeAPIs,
  assignTableAPIs,
  type CellData,
  cellSelectionFeature,
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
  CellUpdate,
  DataGridColumnMeta,
  DataGridTableMeta,
  Direction,
  NavigationDirection,
  RowHeightValue,
} from "@/lib/data-grid-types";

import {
  getEmptyCellValue,
  getLineCount,
  getRowHeightValue,
  getRowIndexById,
  getTabTargetCell,
} from "@/lib/data-grid-utils";

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
  enableCellEditing?: boolean;
  onEditingCellChange?: OnChangeFn<CellPosition | null>;
}

interface ColumnDef_DataGridCellEditing {
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

interface TableOptions_DataGridData<TData extends RowData> {
  /** Disables every data mutation, including cell edits and row deletion. */
  readOnly?: boolean;
  onDataChange?: (data: TData[]) => void;
  onRowsDelete?: (rows: TData[], rowIds: string[]) => void | Promise<void>;
}

interface Table_DataGridData {
  getIsReadOnly: () => boolean;
  /** Writes values into editable cells and emits the next `data` through `onDataChange`. */
  updateCells: (updates: CellUpdate | Array<CellUpdate>) => void;
  /** Resets cells to their variant's empty value. */
  clearCells: (cells: Array<CellPosition>) => void;
  /** Deletes rows through `onRowsDelete`, then moves focus to the row that takes their place. */
  deleteRows: (rowIds: string[]) => Promise<void>;
}

interface Cell_DataGridData {
  setValue: (value: unknown) => void;
  clearValue: () => void;
}

interface TableOptions_DataGridNavigation {
  /** Reading direction, so left and right follow the visual layout. */
  dir?: Direction;
}

interface NavigateOptions {
  /** Moves the selection edge instead of focus, like holding Shift. */
  extend?: boolean;
  /** Rows to move for `pageup` and `pagedown`. */
  pageSize?: number;
}

interface Table_DataGridNavigation {
  /**
   * Cell reached by moving from `from` in `direction`, or `null` when there is nowhere to go.
   * Utility columns (`enableCellSelection: false`) are reachable with left and right only.
   */
  getNavigationTarget: (
    from: CellPosition,
    direction: NavigationDirection,
    options?: NavigateOptions,
  ) => CellPosition | null;
  /** Moves focus, or the selection edge when `extend` is set, and returns the cell it landed on. */
  navigate: (
    direction: NavigationDirection,
    options?: NavigateOptions,
  ) => CellPosition | null;
}

declare module "@tanstack/react-table" {
  interface Plugins {
    dataGridRowHeightFeature: TableFeature;
    dataGridCellEditingFeature: TableFeature;
    dataGridDataFeature: TableFeature;
    dataGridNavigationFeature: TableFeature;
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
    dataGridDataFeature: TableOptions_DataGridData<TData>;
    dataGridNavigationFeature: TableOptions_DataGridNavigation;
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
    dataGridDataFeature: Table_DataGridData;
    dataGridNavigationFeature: Table_DataGridNavigation;
  }

  interface Column_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridCellEditingFeature: Column_DataGridCellEditing;
  }

  interface Cell_FeatureMap {
    dataGridCellEditingFeature: Cell_DataGridCellEditing;
    dataGridDataFeature: Cell_DataGridData;
  }
}

type DataGridInstance = Table<DataGridFeatures, RowData>;

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
  const { options } = asDataGrid(column.table);
  return (
    !options.readOnly &&
    options.enableCellEditing !== false &&
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
        fn: (cell: DataGridCellRef) => {
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

interface DataGridCellRef {
  table: object;
  row: { id: string };
  column: { id: string };
}

function getCanEditCell(table: DataGridInstance, columnId: string) {
  const column = table.getAllFlatColumnsById()[columnId];
  return column
    ? column.getCanEdit()
    : !table.options.readOnly && table.options.enableCellEditing !== false;
}

function updateCells(
  table: DataGridInstance,
  updates: CellUpdate | Array<CellUpdate>,
) {
  const updateArray = Array.isArray(updates) ? updates : [updates];
  if (table.options.readOnly || updateArray.length === 0) return;

  const data = table.options.data;
  const rowsById = table.getCoreRowModel().rowsById;
  const updatedRows = new Map<number, Record<string, unknown>>();

  for (const { rowId, columnId, value } of updateArray) {
    const row = rowsById[rowId];
    if (!row || !getCanEditCell(table, columnId)) continue;

    let updatedRow = updatedRows.get(row.index);
    if (!updatedRow) {
      updatedRow = { ...(data[row.index] ?? row.original) } as Record<
        string,
        unknown
      >;
      updatedRows.set(row.index, updatedRow);
    }
    updatedRow[columnId] = value;
  }

  if (updatedRows.size === 0) return;

  const nextData = [...data];
  for (const [index, row] of updatedRows) {
    nextData[index] = row;
  }
  table.options.onDataChange?.(nextData);
}

function getEmptyValueForColumn(table: DataGridInstance, columnId: string) {
  const column = table.getAllFlatColumnsById()[columnId];
  return getEmptyCellValue(column?.columnDef.meta?.cell?.variant);
}

async function deleteRows(table: DataGridInstance, rowIds: string[]) {
  const { readOnly, onRowsDelete } = table.options;
  if (readOnly || !onRowsDelete || rowIds.length === 0) return;

  const rowIdSet = new Set(rowIds);
  const rows = table.getRowModel().rows;
  const deletedRows = rows.filter((row) => rowIdSet.has(row.id));
  const firstDeletedRow = deletedRows[0];
  if (!firstDeletedRow) return;

  const remainingRows = rows.filter((row) => !rowIdSet.has(row.id));
  const nextFocusedRow =
    remainingRows[
      Math.min(firstDeletedRow.getDisplayIndex(), remainingRows.length - 1)
    ];
  const focusedColumnId = table.getFocusedCell()?.column.id;

  await onRowsDelete(
    deletedRows.map((row) => row.original),
    deletedRows.map((row) => row.id),
  );

  table.resetEditingCell(true);
  table.resetRowSelection(true);
  if (nextFocusedRow && focusedColumnId) {
    table.setFocusedCell(nextFocusedRow.id, focusedColumnId);
  } else {
    table.resetCellSelection(true);
  }
}

const dataGridDataFeature: TableFeature = {
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    assignTableAPIs("dataGridDataFeature", table, {
      table_getIsReadOnly: {
        fn: () => !!instance.options.readOnly,
      },
      table_updateCells: {
        fn: (updates: CellUpdate | Array<CellUpdate>) =>
          updateCells(instance, updates),
      },
      table_clearCells: {
        fn: (cells: Array<CellPosition>) =>
          updateCells(
            instance,
            cells.map(({ rowId, columnId }) => ({
              rowId,
              columnId,
              value: getEmptyValueForColumn(instance, columnId),
            })),
          ),
      },
      table_deleteRows: {
        fn: (rowIds: string[]) => deleteRows(instance, rowIds),
      },
    });
  },
  assignCellPrototype: (prototype, table) => {
    assignPrototypeAPIs("dataGridDataFeature", prototype, table, {
      cell_setValue: {
        fn: (cell: DataGridCellRef, value: unknown) =>
          updateCells(asDataGrid(cell.table), {
            rowId: cell.row.id,
            columnId: cell.column.id,
            value,
          }),
      },
      cell_clearValue: {
        fn: (cell: DataGridCellRef) => {
          const instance = asDataGrid(cell.table);
          updateCells(instance, {
            rowId: cell.row.id,
            columnId: cell.column.id,
            value: getEmptyValueForColumn(instance, cell.column.id),
          });
        },
      },
    });
  },
};

const DEFAULT_PAGE_SIZE = 10;
const HORIZONTAL_PAGE_SIZE = 5;

function getNavigationTarget(
  table: DataGridInstance,
  from: CellPosition,
  direction: NavigationDirection,
  options: NavigateOptions = {},
): CellPosition | null {
  const rows = table.getRowModel().rows;
  const rowIndex = getRowIndexById(table, from.rowId);
  if (rowIndex === -1) return null;

  const columnIds = table.getVisibleLeafColumns().map((column) => column.id);
  const dataColumnIds = table
    .getVisibleLeafColumns()
    .filter((column) => column.columnDef.enableCellSelection !== false)
    .map((column) => column.id);
  const firstDataColumnId = dataColumnIds[0];
  const lastDataColumnId = dataColumnIds[dataColumnIds.length - 1];
  const lastRowIndex = rows.length - 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  let nextRowIndex = rowIndex;
  let nextColumnId = from.columnId;

  switch (direction) {
    case "up":
      nextRowIndex = Math.max(0, rowIndex - 1);
      break;
    case "down":
      nextRowIndex = Math.min(lastRowIndex, rowIndex + 1);
      break;
    case "left":
    case "right": {
      const horizontalIds = options.extend ? dataColumnIds : columnIds;
      const columnIndex = horizontalIds.indexOf(from.columnId);
      const step =
        (direction === "right") !== (table.options.dir === "rtl") ? 1 : -1;
      const adjacentColumnId = horizontalIds[columnIndex + step];
      if (columnIndex !== -1 && adjacentColumnId) {
        nextColumnId = adjacentColumnId;
      }
      break;
    }
    case "home":
      nextColumnId = firstDataColumnId ?? from.columnId;
      break;
    case "end":
      nextColumnId = lastDataColumnId ?? from.columnId;
      break;
    case "ctrl+home":
      nextRowIndex = 0;
      nextColumnId = firstDataColumnId ?? from.columnId;
      break;
    case "ctrl+end":
      nextRowIndex = lastRowIndex;
      nextColumnId = lastDataColumnId ?? from.columnId;
      break;
    case "ctrl+up":
      nextRowIndex = 0;
      break;
    case "ctrl+down":
      nextRowIndex = lastRowIndex;
      break;
    case "pageup":
      nextRowIndex = Math.max(0, rowIndex - pageSize);
      break;
    case "pagedown":
      nextRowIndex = Math.min(lastRowIndex, rowIndex + pageSize);
      break;
    case "pageleft":
    case "pageright": {
      const columnIndex = dataColumnIds.indexOf(from.columnId);
      if (columnIndex === -1) break;
      const step =
        direction === "pageright"
          ? HORIZONTAL_PAGE_SIZE
          : -HORIZONTAL_PAGE_SIZE;
      nextColumnId =
        dataColumnIds[
          Math.min(dataColumnIds.length - 1, Math.max(0, columnIndex + step))
        ] ?? from.columnId;
      break;
    }
    case "tab":
    case "shift+tab": {
      const dataColumnIdSet = new Set(dataColumnIds);
      const target = getTabTargetCell({
        rowIndex,
        columnId: from.columnId,
        columnIds,
        rowCount: rows.length,
        isBackward: direction === "shift+tab",
        getIsColumnTabbable: (columnId) => dataColumnIdSet.has(columnId),
      });
      if (!target) return null;
      nextRowIndex = target.rowIndex;
      nextColumnId = target.columnId;
      break;
    }
  }

  const nextRow = rows[nextRowIndex];
  if (!nextRow) return null;
  if (nextRow.id === from.rowId && nextColumnId === from.columnId) return null;

  return { rowId: nextRow.id, columnId: nextColumnId };
}

function navigate(
  table: DataGridInstance,
  direction: NavigationDirection,
  options: NavigateOptions = {},
) {
  const ranges = table.atoms.cellSelection.get();
  const activeRange = ranges[ranges.length - 1];
  if (!activeRange) return null;

  if (!options.extend) {
    const target = getNavigationTarget(
      table,
      { rowId: activeRange.anchorRowId, columnId: activeRange.anchorColumnId },
      direction,
      options,
    );
    if (!target) return null;
    table.setFocusedCell(target.rowId, target.columnId);
    table.setEditingCell(null);
    return target;
  }

  const target = getNavigationTarget(
    table,
    { rowId: activeRange.focusRowId, columnId: activeRange.focusColumnId },
    direction,
    options,
  );
  if (!target) return null;
  table.setCellSelection([
    ...ranges.slice(0, -1),
    {
      ...activeRange,
      focusRowId: target.rowId,
      focusColumnId: target.columnId,
    },
  ]);
  return target;
}

const dataGridNavigationFeature: TableFeature = {
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    assignTableAPIs("dataGridNavigationFeature", table, {
      table_getNavigationTarget: {
        fn: (
          from: CellPosition,
          direction: NavigationDirection,
          options?: NavigateOptions,
        ) => getNavigationTarget(instance, from, direction, options),
      },
      table_navigate: {
        fn: (direction: NavigationDirection, options?: NavigateOptions) =>
          navigate(instance, direction, options),
      },
    });
  },
};

export const dataGridFeatures = tableFeatures({
  cellSelectionFeature,
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
  dataGridDataFeature,
  dataGridNavigationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  tableMeta: metaHelper<DataGridTableMeta>(),
  columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
