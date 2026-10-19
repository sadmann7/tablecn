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
  constructRow,
  copyInstancePropertiesWithoutMemos,
  createFilteredRowModel,
  makeObjectMap,
  makeStateUpdater,
  metaHelper,
  type OnChangeFn,
  type Row,
  type RowData,
  type RowModel,
  rowSelectionFeature,
  rowSortingFeature,
  setStateSlice,
  skipFirstRun,
  type SortFn,
  sortFn_alphanumeric,
  sortFn_alphanumericCaseSensitive,
  sortFn_datetime,
  sortFn_text,
  type SortFnDef,
  type Table,
  type TableFeature,
  type TableFeatures,
  tableFeatures,
  tableMemo,
  type Updater,
} from "@tanstack/react-table";
import {
  column_getCanSort,
  column_getSortFn,
  table_autoResetCellSelection,
  table_autoResetExpanded,
  table_autoResetPageIndex,
  table_autoResetSorting,
} from "@tanstack/react-table/static-functions";

import type {
  CellPosition,
  CellPresence,
  CellUpdate,
  ClipboardNotice,
  ColumnValueReader,
  ContextMenuState,
  DataGridColumnMeta,
  Direction,
  FileCellData,
  NavigationDirection,
  PasteDialogState,
  RowHeightValue,
} from "@/lib/data-grid-types";

import {
  getCellKey,
  getColumnValueReader,
  getEmptyCellValue,
  getFocusedCellPosition,
  getHasCellRangeSelection,
  getHasCustomCell,
  getIsDataColumn,
  getLineCount,
  getRowHeightValue,
  getRowIndexById,
  getTabTargetCell,
  parsePastedCellValue,
  parseTsv,
  serializeCellValue,
  stringifyUnknown,
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

interface ColumnDef_DataGridColumnOrdering {
  enableOrdering?: boolean;
}

interface Column_DataGridColumnOrdering {
  getCanOrder: () => boolean;
}

interface StopEditingOptions {
  direction?: NavigationDirection;
  moveToNextRow?: boolean;
}

interface Table_DataGridCellEditing {
  getEditingCell: () => CellPosition | null;
  setEditingCell: (updater: Updater<CellPosition | null>) => void;
  resetEditingCell: (defaultState?: boolean) => void;
  stopEditing: (options?: StopEditingOptions) => void;
}

interface Column_DataGridCellEditing {
  getCanEdit: () => boolean;
}

interface Cell_DataGridCellEditing {
  getCanEdit: () => boolean;
  getIsEditing: () => boolean;
  startEditing: () => void;
}

interface TableOptions_DataGridData<TData extends RowData> {
  readOnly?: boolean;
  onDataChange?: (data: TData[]) => void;
  onRowsDelete?: (rows: TData[], rowIds: string[]) => void | Promise<void>;
  onFilesUpload?: (params: {
    files: File[];
    rowId: string;
    columnId: string;
  }) => Promise<FileCellData[]>;
  onFilesDelete?: (params: {
    fileIds: string[];
    rowId: string;
    columnId: string;
  }) => void | Promise<void>;
}

interface Table_DataGridData {
  getIsReadOnly: () => boolean;
  updateCells: (updates: CellUpdate | Array<CellUpdate>) => void;
  clearCells: (cells: Array<CellPosition>) => void;
  deleteRows: (rowIds: string[]) => Promise<void>;
}

interface Cell_DataGridData {
  setValue: (value: unknown) => void;
  clearValue: () => void;
}

interface TableState_DataGridNavigation {
  focusedHeaderColumnId: string | null;
}

interface TableOptions_DataGridNavigation {
  dir?: Direction;
  onCellScroll?: (cell: CellPosition) => void;
  onCellFocus?: (cell: CellPosition) => void;
  onFocusedHeaderColumnIdChange?: OnChangeFn<string | null>;
}

interface NavigateOptions {
  extend?: boolean;
  pageSize?: number;
}

interface Table_DataGridNavigation {
  getNavigationTarget: (
    from: CellPosition,
    direction: NavigationDirection,
    options?: NavigateOptions,
  ) => CellPosition | null;
  navigate: (
    direction: NavigationDirection,
    options?: NavigateOptions,
  ) => CellPosition | null;
  scrollToCell: (rowId: string, columnId: string) => void;
  getFocusedHeaderColumnId: () => string | null;
  setFocusedHeaderColumnId: (updater: Updater<string | null>) => void;
}

interface TableState_DataGridClipboard {
  cutCellGrid: Array<Array<CellPosition | null>>;
  pasteDialog: PasteDialogState;
}

interface TableOptions_DataGridClipboard {
  enablePaste?: boolean;
  onPaste?: (updates: Array<CellUpdate>) => void | Promise<void>;
  onRowsAdd?: (count: number) => void | Promise<void>;
  onClipboardNotice?: (notice: ClipboardNotice) => void;
  onCutCellGridChange?: OnChangeFn<Array<Array<CellPosition | null>>>;
  onPasteDialogChange?: OnChangeFn<PasteDialogState>;
}

interface PasteCellsOptions {
  expandRows?: boolean;
}

interface Table_DataGridClipboard {
  getSelectedCells: () => Array<CellPosition>;
  getCutCellGrid: () => Array<Array<CellPosition | null>>;
  setCutCellGrid: (updater: Updater<Array<Array<CellPosition | null>>>) => void;
  resetCutCellGrid: (defaultState?: boolean) => void;
  getPasteDialog: () => PasteDialogState;
  setPasteDialog: (updater: Updater<PasteDialogState>) => void;
  resetPasteDialog: (defaultState?: boolean) => void;
  copySelectedCells: () => Promise<void>;
  cutSelectedCells: () => Promise<void>;
  pasteCells: (options?: PasteCellsOptions) => Promise<void>;
}

interface TableState_DataGridSearch {
  searchOpen: boolean;
  searchQuery: string;
  searchMatchIndex: number;
}

interface TableOptions_DataGridSearch {
  enableSearch?: boolean;
  onSearchOpenChange?: OnChangeFn<boolean>;
  onSearchQueryChange?: OnChangeFn<string>;
  onSearchMatchIndexChange?: OnChangeFn<number>;
}

interface Table_DataGridSearch {
  getSearchOpen: () => boolean;
  openSearch: () => void;
  closeSearch: () => void;
  getSearchQuery: () => string;
  setSearchQuery: (query: string) => void;
  getSearchMatchIndex: () => number;
  getSearchMatches: () => Array<CellPosition>;
  getSearchMatchesByRowId: () => Map<string, Set<string>>;
  getActiveSearchMatch: () => CellPosition | null;
  goToNextSearchMatch: () => void;
  goToPrevSearchMatch: () => void;
}

interface Cell_DataGridSearch {
  getIsSearchMatch: () => boolean;
  getIsActiveSearchMatch: () => boolean;
}

interface TableState_DataGridPresence {
  cellPresence: Array<CellPresence>;
}

interface TableOptions_DataGridPresence {
  onCellPresenceChange?: OnChangeFn<Array<CellPresence>>;
}

interface Table_DataGridPresence {
  getCellPresence: () => Array<CellPresence>;
  setCellPresence: (updater: Updater<Array<CellPresence>>) => void;
  getCellPresenceByRowId: () => Map<string, Map<string, CellPresence>>;
}

interface Cell_DataGridPresence {
  getPresence: () => CellPresence | null;
}

interface TableState_DataGridSelection {
  cellDragAnchor: CellPosition | null;
  contextMenu: ContextMenuState;
}

interface TableOptions_DataGridSelection {
  enableSingleCellSelection?: boolean;
  enableColumnSelection?: boolean;
  onCellDragAnchorChange?: OnChangeFn<CellPosition | null>;
  onContextMenuChange?: OnChangeFn<ContextMenuState>;
}

interface Table_DataGridSelection {
  getHasCellRangeSelection: () => boolean;
  getHasRowSelection: () => boolean;
  getIsCellSelected: (rowId: string, columnId: string) => boolean;
  getSelectedRangeCellCount: () => number;
  clearSelection: () => void;
  clearRowSelection: () => void;
  selectAllDataCells: () => void;
  extendCellSelectionTo: (cell: CellPosition) => void;
  selectColumnCells: (columnId: string) => void;
  getCellDragAnchor: () => CellPosition | null;
  startCellDrag: (cell: CellPosition) => void;
  endCellDrag: () => void;
  getContextMenu: () => ContextMenuState;
  openContextMenu: (position: { x: number; y: number }) => void;
  closeContextMenu: () => void;
}

declare module "@tanstack/react-table" {
  interface Plugins {
    dataGridRowHeightFeature: TableFeature;
    dataGridCellEditingFeature: TableFeature;
    dataGridColumnOrderingFeature: TableFeature;
    dataGridDataFeature: TableFeature;
    dataGridNavigationFeature: TableFeature;
    dataGridClipboardFeature: TableFeature;
    dataGridSearchFeature: TableFeature;
    dataGridPresenceFeature: TableFeature;
    dataGridSelectionFeature: TableFeature;
  }

  interface TableState_FeatureMap {
    dataGridRowHeightFeature: TableState_DataGridRowHeight;
    dataGridCellEditingFeature: TableState_DataGridCellEditing;
    dataGridNavigationFeature: TableState_DataGridNavigation;
    dataGridClipboardFeature: TableState_DataGridClipboard;
    dataGridSearchFeature: TableState_DataGridSearch;
    dataGridPresenceFeature: TableState_DataGridPresence;
    dataGridSelectionFeature: TableState_DataGridSelection;
  }

  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridRowHeightFeature: TableOptions_DataGridRowHeight;
    dataGridCellEditingFeature: TableOptions_DataGridCellEditing;
    dataGridDataFeature: TableOptions_DataGridData<TData>;
    dataGridNavigationFeature: TableOptions_DataGridNavigation;
    dataGridClipboardFeature: TableOptions_DataGridClipboard;
    dataGridSearchFeature: TableOptions_DataGridSearch;
    dataGridPresenceFeature: TableOptions_DataGridPresence;
    dataGridSelectionFeature: TableOptions_DataGridSelection;
  }

  interface ColumnDef_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData,
  > {
    dataGridCellEditingFeature: ColumnDef_DataGridCellEditing;
    dataGridColumnOrderingFeature: ColumnDef_DataGridColumnOrdering;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridRowHeightFeature: Table_DataGridRowHeight;
    dataGridCellEditingFeature: Table_DataGridCellEditing;
    dataGridDataFeature: Table_DataGridData;
    dataGridNavigationFeature: Table_DataGridNavigation;
    dataGridClipboardFeature: Table_DataGridClipboard;
    dataGridSearchFeature: Table_DataGridSearch;
    dataGridPresenceFeature: Table_DataGridPresence;
    dataGridSelectionFeature: Table_DataGridSelection;
  }

  interface Column_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataGridCellEditingFeature: Column_DataGridCellEditing;
    dataGridColumnOrderingFeature: Column_DataGridColumnOrdering;
  }

  interface Cell_FeatureMap {
    dataGridCellEditingFeature: Cell_DataGridCellEditing;
    dataGridDataFeature: Cell_DataGridData;
    dataGridSearchFeature: Cell_DataGridSearch;
    dataGridPresenceFeature: Cell_DataGridPresence;
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
      setStateSlice(instance, "rowHeight", updater);

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
    column.columnDef.enableCellEditing !== false &&
    !getHasCustomCell(column)
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
      setStateSlice(instance, "editingCell", updater);

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
      table_stopEditing: {
        fn: (options?: StopEditingOptions) => {
          if (!instance.atoms.editingCell.get()) return;

          setEditingCell(null);

          const direction = options?.moveToNextRow
            ? "down"
            : options?.direction;
          if (direction) instance.navigate(direction);
        },
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
      cell_startEditing: {
        fn: (
          cell: DataGridCellRef & {
            column: Parameters<typeof getCanEditColumn>[0];
          },
        ) => {
          if (!getCanEditColumn(cell.column)) return;

          const table = asDataGrid(cell.table);
          table.setFocusedCell(cell.row.id, cell.column.id);
          table.setEditingCell({
            rowId: cell.row.id,
            columnId: cell.column.id,
          });
        },
      },
    });
  },
};

const dataGridColumnOrderingFeature: TableFeature = {
  assignColumnPrototype: (prototype, table) => {
    assignPrototypeAPIs("dataGridColumnOrderingFeature", prototype, table, {
      column_getCanOrder: {
        fn: (column: { columnDef: ColumnDef_DataGridColumnOrdering }) =>
          column.columnDef.enableOrdering !== false,
      },
    });
  },
};

interface DataGridCellRef {
  table: object;
  row: { id: string };
  column: { id: string };
}

function copyRowRecord(row: RowData): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row));
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
      updatedRow = copyRowRecord(data[row.index] ?? row.original);
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
  const deletedRows: typeof rows = [];
  let firstDeletedIndex = -1;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row || !rowIdSet.has(row.id)) continue;
    if (firstDeletedIndex === -1) firstDeletedIndex = index;
    deletedRows.push(row);
  }
  if (firstDeletedIndex === -1) return;

  let nextFocusedRow = rows[firstDeletedIndex - 1];
  for (let index = firstDeletedIndex + 1; index < rows.length; index++) {
    const row = rows[index];
    if (row && !rowIdSet.has(row.id)) {
      nextFocusedRow = row;
      break;
    }
  }
  const focusedColumn = table.getFocusedCell()?.column;
  const focusedColumnId =
    focusedColumn && !getIsDataColumn(focusedColumn)
      ? table.getVisibleLeafColumns().find(getIsDataColumn)?.id
      : focusedColumn?.id;

  await onRowsDelete(
    deletedRows.map((row) => row.original),
    deletedRows.map((row) => row.id),
  );

  table.resetEditingCell(true);
  table.resetRowSelection(true);
  if (nextFocusedRow && focusedColumnId) {
    table.setFocusedCell(nextFocusedRow.id, focusedColumnId);
    table.options.onCellFocus?.({
      rowId: nextFocusedRow.id,
      columnId: focusedColumnId,
    });
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
    .filter(getIsDataColumn)
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
  getInitialState: (initialState) => ({
    focusedHeaderColumnId: null,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataGridNavigation = {
      onFocusedHeaderColumnIdChange: makeStateUpdater(
        "focusedHeaderColumnId",
        table,
      ),
    };
    return options;
  },
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
      table_scrollToCell: {
        fn: (rowId: string, columnId: string) =>
          instance.options.onCellScroll?.({ rowId, columnId }),
      },
      table_getFocusedHeaderColumnId: {
        fn: () => instance.atoms.focusedHeaderColumnId.get(),
      },
      table_setFocusedHeaderColumnId: {
        fn: (updater: Updater<string | null>) =>
          setStateSlice(instance, "focusedHeaderColumnId", updater),
      },
    });
  },
};

const DEFAULT_PASTE_DIALOG: PasteDialogState = {
  open: false,
  rowsNeeded: 0,
  clipboardText: "",
};
const ROWS_ADD_POLL_INTERVAL_MS = 100;
const ROWS_ADD_POLL_ATTEMPTS = 50;

function getDataColumnIds(table: DataGridInstance) {
  return table
    .getVisibleLeafColumns()
    .filter(getIsDataColumn)
    .map((column) => column.id);
}

function getSelectedCells(table: DataGridInstance) {
  const bounds = table.getCellSelectionBounds();
  if (bounds.length === 0) return [];

  const rows = table.getRowModel().rows;
  const columnIds: string[] = [];
  for (const [columnId, columnIndex] of Object.entries(
    table.getCellSelectionColumnIndexes(),
  )) {
    columnIds[columnIndex] = columnId;
  }
  const dataColumnIds = new Set(getDataColumnIds(table));

  const cells: Array<CellPosition> = [];
  for (const bound of bounds) {
    for (
      let rowIndex = bound.minRowIndex;
      rowIndex <= bound.maxRowIndex;
      rowIndex++
    ) {
      const rowId = rows[rowIndex]?.id;
      if (!rowId) continue;

      for (
        let columnIndex = bound.minColumnIndex;
        columnIndex <= bound.maxColumnIndex;
        columnIndex++
      ) {
        const columnId = columnIds[columnIndex];
        if (columnId && dataColumnIds.has(columnId)) {
          cells.push({ rowId, columnId });
        }
      }
    }
  }
  return cells;
}

function pluralizeCells(count: number) {
  return `${count} cell${count !== 1 ? "s" : ""}`;
}

function quoteTsvField(field: string) {
  return /[\t\n\r]/.test(field) || field.startsWith('"')
    ? `"${field.replaceAll('"', '""')}"`
    : field;
}

function serializeCellRange(
  table: DataGridInstance,
  bound: ReturnType<DataGridInstance["getCellSelectionBounds"]>[number],
  includeCellGrid: boolean,
) {
  const columnIndexes = table.getCellSelectionColumnIndexes();
  const columns = table.getVisibleLeafColumns().filter((column) => {
    const columnIndex = columnIndexes[column.id];
    return (
      getIsDataColumn(column) &&
      columnIndex !== undefined &&
      columnIndex >= bound.minColumnIndex &&
      columnIndex <= bound.maxColumnIndex
    );
  });
  const rows = table
    .getRowModel()
    .rows.slice(bound.minRowIndex, bound.maxRowIndex + 1);
  if (columns.length === 0 || rows.length === 0) return null;

  const readValues = columns.map(getColumnValueReader);
  const variants = columns.map(
    (column) => column.columnDef.meta?.cell?.variant,
  );
  const lines: Array<string> = [];
  for (const row of rows) {
    let line = "";
    for (let index = 0; index < columns.length; index++) {
      if (index > 0) line += "\t";
      line += quoteTsvField(
        serializeCellValue(readValues[index]?.(row), variants[index]),
      );
    }
    lines.push(line);
  }

  return {
    text: lines.join("\n"),
    cellGrid: includeCellGrid
      ? rows.map((row) =>
          columns.map((column) => ({ rowId: row.id, columnId: column.id })),
        )
      : [],
    cellCount: rows.length * columns.length,
  };
}

function serializeSelectedCells(
  table: DataGridInstance,
  includeCellGrid: boolean,
) {
  const bounds = table.getCellSelectionBounds();
  const [bound] = bounds;
  if (bounds.length === 1 && bound) {
    return serializeCellRange(table, bound, includeCellGrid);
  }

  const cells = getSelectedCells(table);
  if (cells.length === 0) return null;

  const cellKeys = new Set(cells.map((c) => getCellKey(c.rowId, c.columnId)));
  const rowIds = new Set(cells.map((cell) => cell.rowId));
  const columnIdSet = new Set(cells.map((cell) => cell.columnId));
  const rows = table.getRowModel().rows.filter((row) => rowIds.has(row.id));
  const columnIds = getDataColumnIds(table).filter((id) => columnIdSet.has(id));

  const cellGrid = rows.map((row) =>
    columnIds.map((columnId) =>
      cellKeys.has(getCellKey(row.id, columnId))
        ? { rowId: row.id, columnId }
        : null,
    ),
  );

  const text = rows
    .map((row) => {
      const cellsByColumnId = row.getAllCellsByColumnId();
      return columnIds
        .map((columnId) => {
          if (!cellKeys.has(getCellKey(row.id, columnId))) return "";
          const cell = cellsByColumnId[columnId];
          return cell
            ? quoteTsvField(
                serializeCellValue(
                  cell.getValue(),
                  cell.column.columnDef.meta?.cell?.variant,
                ),
              )
            : "";
        })
        .join("\t");
    })
    .join("\n");

  return { text, cellGrid, cellCount: cells.length };
}

async function writeSelectedCells(table: DataGridInstance, isCut: boolean) {
  const notify = table.options.onClipboardNotice;
  if (isCut && table.options.readOnly) return;

  const serialized = serializeSelectedCells(table, isCut);
  if (!serialized) return;

  try {
    await navigator.clipboard.writeText(serialized.text);
    if (isCut) table.setCutCellGrid(serialized.cellGrid);
    else if (table.atoms.cutCellGrid.get().length > 0)
      table.resetCutCellGrid(true);
    notify?.({
      variant: "success",
      message: `${pluralizeCells(serialized.cellCount)} ${isCut ? "cut" : "copied"}`,
    });
  } catch (error) {
    notify?.({
      variant: "error",
      message:
        error instanceof Error
          ? error.message
          : `Failed to ${isCut ? "cut" : "copy"} to clipboard`,
    });
  }
}

async function waitForRowCount(table: DataGridInstance, rowCount: number) {
  for (
    let attempt = 0;
    attempt < ROWS_ADD_POLL_ATTEMPTS &&
    table.getRowModel().rows.length < rowCount;
    attempt++
  ) {
    await new Promise((resolve) =>
      setTimeout(resolve, ROWS_ADD_POLL_INTERVAL_MS),
    );
  }
}

function getPasteTarget(
  table: DataGridInstance,
  focusedCell: CellPosition,
  clipboardRows: string[][],
  dataColumnIds: string[],
) {
  const rows = table.getRowModel().rows;
  const target = {
    rowIndex: getRowIndexById(table, focusedCell.rowId),
    columnIndex: dataColumnIds.indexOf(focusedCell.columnId),
    values: clipboardRows,
    isFill: false,
  };

  const singleValue = clipboardRows[0]?.[0];
  const isSingleValue =
    clipboardRows.length === 1 && clipboardRows[0]?.length === 1;
  const selectedCells = getSelectedCells(table);
  if (!isSingleValue || singleValue === undefined || selectedCells.length < 2) {
    return target;
  }

  const rowIndexById = new Map(rows.map((row, index) => [row.id, index]));
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minColumn = Infinity;
  let maxColumn = -Infinity;
  for (const { rowId, columnId } of selectedCells) {
    const rowIndex = rowIndexById.get(rowId) ?? -1;
    const columnIndex = dataColumnIds.indexOf(columnId);
    if (rowIndex === -1 || columnIndex === -1) continue;
    minRow = Math.min(minRow, rowIndex);
    maxRow = Math.max(maxRow, rowIndex);
    minColumn = Math.min(minColumn, columnIndex);
    maxColumn = Math.max(maxColumn, columnIndex);
  }
  if (minRow === Infinity) return target;

  return {
    rowIndex: minRow,
    columnIndex: minColumn,
    values: Array.from({ length: maxRow - minRow + 1 }, () =>
      Array.from({ length: maxColumn - minColumn + 1 }, () => singleValue),
    ),
    isFill: true,
  };
}

async function pasteCells(
  table: DataGridInstance,
  { expandRows = false }: PasteCellsOptions = {},
) {
  const { readOnly, onRowsAdd, onPaste } = table.options;
  const notify = table.options.onClipboardNotice;
  if (readOnly) return;

  const focusedCell = table.getFocusedCell();
  if (!focusedCell) return;

  const pasteDialog = table.atoms.pasteDialog.get();
  const dataColumnIds = getDataColumnIds(table);

  try {
    const clipboardText =
      pasteDialog.clipboardText || (await navigator.clipboard.readText());
    if (!clipboardText) return;

    const target = getPasteTarget(
      table,
      { rowId: focusedCell.row.id, columnId: focusedCell.column.id },
      parseTsv(clipboardText, dataColumnIds.length),
      dataColumnIds,
    );
    if (target.rowIndex === -1 || target.columnIndex === -1) return;

    const rowCount = table.getRowModel().rows.length;
    const rowsNeeded = target.rowIndex + target.values.length - rowCount;

    if (rowsNeeded > 0 && onRowsAdd) {
      if (!expandRows && !pasteDialog.clipboardText) {
        table.setPasteDialog({ open: true, rowsNeeded, clipboardText });
        return;
      }
      if (expandRows) {
        await onRowsAdd(rowsNeeded);
        await waitForRowCount(table, rowCount + rowsNeeded);
      }
    }

    const rows = table.getRowModel().rows;
    const cutCellGrid = table.atoms.cutCellGrid.get();
    const updates: Array<CellUpdate> = [];
    const writtenCellKeys = new Set<string>();
    const movedSourceCells: Array<CellPosition> = [];
    let skippedCount = 0;
    let endRowIndex = target.rowIndex;
    let endColumnIndex = target.columnIndex;

    for (const [pasteRowIndex, pasteRow] of target.values.entries()) {
      const rowIndex = target.rowIndex + pasteRowIndex;
      const rowId = rows[rowIndex]?.id;
      if (!rowId) break;

      for (const [pasteColumnIndex, text] of pasteRow.entries()) {
        const columnIndex = target.columnIndex + pasteColumnIndex;
        const columnId = dataColumnIds[columnIndex];
        if (!columnId) break;

        endRowIndex = Math.max(endRowIndex, rowIndex);
        endColumnIndex = Math.max(endColumnIndex, columnIndex);

        const column = table.getAllFlatColumnsById()[columnId];
        const parsed = column?.getCanEdit()
          ? parsePastedCellValue(text, column.columnDef.meta?.cell)
          : null;
        if (!parsed) {
          skippedCount++;
          continue;
        }

        updates.push({ rowId, columnId, value: parsed.value });
        writtenCellKeys.add(getCellKey(rowId, columnId));

        const sourceCell = target.isFill
          ? cutCellGrid[0]?.[0]
          : cutCellGrid[pasteRowIndex]?.[pasteColumnIndex];
        if (sourceCell) movedSourceCells.push(sourceCell);
      }
    }

    if (updates.length > 0) {
      await onPaste?.(updates);

      const clearedSourceUpdates = movedSourceCells
        .filter(
          (cell) => !writtenCellKeys.has(getCellKey(cell.rowId, cell.columnId)),
        )
        .map((cell) => ({
          ...cell,
          value: getEmptyValueForColumn(table, cell.columnId),
        }));
      table.resetCutCellGrid(true);
      updateCells(table, [...updates, ...clearedSourceUpdates]);

      const startRowId = rows[target.rowIndex]?.id;
      const startColumnId = dataColumnIds[target.columnIndex];
      const endRowId = rows[endRowIndex]?.id;
      const endColumnId = dataColumnIds[endColumnIndex];
      if (startRowId && startColumnId && endRowId && endColumnId) {
        table.selectCellRange({
          anchorRowId: startRowId,
          anchorColumnId: startColumnId,
          focusRowId: endRowId,
          focusColumnId: endColumnId,
        });
      }

      notify?.({
        variant: "success",
        message:
          skippedCount > 0
            ? `${pluralizeCells(updates.length)} pasted, ${skippedCount} skipped`
            : `${pluralizeCells(updates.length)} pasted`,
      });
    } else if (skippedCount > 0) {
      notify?.({
        variant: "error",
        message: `${pluralizeCells(skippedCount)} skipped pasting for invalid data`,
      });
    }

    if (pasteDialog.open) table.resetPasteDialog(true);
  } catch (error) {
    notify?.({
      variant: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to paste. Please try again.",
    });
  }
}

const dataGridClipboardFeature: TableFeature = {
  getInitialState: (initialState) => ({
    cutCellGrid: [],
    pasteDialog: DEFAULT_PASTE_DIALOG,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataGridClipboard = {
      onCutCellGridChange: makeStateUpdater("cutCellGrid", table),
      onPasteDialogChange: makeStateUpdater("pasteDialog", table),
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    const setCutCellGrid = (
      updater: Updater<Array<Array<CellPosition | null>>>,
    ) => setStateSlice(instance, "cutCellGrid", updater);
    const setPasteDialog = (updater: Updater<PasteDialogState>) =>
      setStateSlice(instance, "pasteDialog", updater);

    assignTableAPIs("dataGridClipboardFeature", table, {
      table_getSelectedCells: {
        fn: () => getSelectedCells(instance),
      },
      table_getCutCellGrid: {
        fn: () => instance.atoms.cutCellGrid.get(),
      },
      table_setCutCellGrid: { fn: setCutCellGrid },
      table_resetCutCellGrid: {
        fn: (defaultState?: boolean) =>
          setCutCellGrid(
            defaultState ? [] : (instance.initialState.cutCellGrid ?? []),
          ),
      },
      table_getPasteDialog: {
        fn: () => instance.atoms.pasteDialog.get(),
      },
      table_setPasteDialog: { fn: setPasteDialog },
      table_resetPasteDialog: {
        fn: (defaultState?: boolean) =>
          setPasteDialog(
            defaultState
              ? DEFAULT_PASTE_DIALOG
              : (instance.initialState.pasteDialog ?? DEFAULT_PASTE_DIALOG),
          ),
      },
      table_copySelectedCells: {
        fn: () => writeSelectedCells(instance, false),
      },
      table_cutSelectedCells: {
        fn: () => writeSelectedCells(instance, true),
      },
      table_pasteCells: {
        fn: (options?: PasteCellsOptions) => pasteCells(instance, options),
      },
    });
  },
};

interface SearchResult {
  query: string;
  rows: Array<SearchRow>;
  columnsKey: string;
  rowTexts: Array<Array<string>>;
  matchedRows: Array<number>;
  matches: Array<CellPosition>;
  matchesByRowId: Map<string, Set<string>>;
}

interface SearchTextCache {
  columnsKey: string;
  textsByRow: WeakMap<object, Array<string>>;
  columnSets: Map<number | string, Set<string>>;
  result: SearchResult | null;
}

type SearchRow = ReturnType<DataGridInstance["getRowModel"]>["rows"][number];
type SearchColumns = ReturnType<DataGridInstance["getVisibleLeafColumns"]>;

function getSearchColumnIds(columns: SearchColumns, cache: SearchTextCache) {
  const dataColumnIds = columns
    .filter(getIsDataColumn)
    .map((column) => column.id);

  const columnsKey = dataColumnIds.join("\u0000");
  if (cache.columnsKey !== columnsKey) {
    cache.columnsKey = columnsKey;
    cache.textsByRow = new WeakMap();
    cache.columnSets = new Map();
    cache.result = null;
  }
  return dataColumnIds;
}

function getRowSearchTexts(
  row: SearchRow,
  readValues: Array<ColumnValueReader>,
  cache: SearchTextCache,
  lowerByValue: Map<unknown, string>,
) {
  const original = row.original;
  const isCacheable = typeof original === "object" && original !== null;
  let texts = isCacheable ? cache.textsByRow.get(original) : undefined;
  if (texts) return texts;

  texts = readValues.map((readValue) => {
    const value = readValue(row);
    let text = lowerByValue.get(value);
    if (text === undefined) {
      text = stringifyUnknown(value).toLowerCase();
      lowerByValue.set(value, text);
    }
    return text;
  });
  if (isCacheable) cache.textsByRow.set(original, texts);
  return texts;
}

function getSearchMatches(
  query: string,
  rows: Array<SearchRow>,
  columns: SearchColumns,
  cache: SearchTextCache,
) {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  const dataColumnIds = getSearchColumnIds(columns, cache);
  const readValues = columns.filter(getIsDataColumn).map(getColumnValueReader);
  const lowerByValue = new Map<unknown, string>();

  const previous = cache.result;
  const isNarrowing =
    previous !== null &&
    previous.rows === rows &&
    previous.columnsKey === cache.columnsKey &&
    lowerQuery.includes(previous.query);
  const candidateCount = isNarrowing
    ? previous.matchedRows.length
    : rows.length;

  const hasSameRows =
    previous !== null &&
    previous.rows === rows &&
    previous.columnsKey === cache.columnsKey;
  const rowTexts: Array<Array<string>> = hasSameRows ? previous.rowTexts : [];
  const useBitmask = dataColumnIds.length <= 31;

  const matches: Array<CellPosition> = [];
  const matchesByRowId = new Map<string, Set<string>>();
  const matchedRows: Array<number> = [];

  for (let candidate = 0; candidate < candidateCount; candidate++) {
    const rowIndex = isNarrowing ? previous.matchedRows[candidate] : candidate;
    if (rowIndex === undefined) continue;
    const row = rows[rowIndex];
    if (!row) continue;
    let texts = rowTexts[rowIndex];
    if (!texts) {
      texts = getRowSearchTexts(row, readValues, cache, lowerByValue);
      rowTexts[rowIndex] = texts;
    }

    let mask = 0;
    let maskKey = "";
    for (let index = 0; index < texts.length; index++) {
      const columnId = dataColumnIds[index];
      if (columnId === undefined || !texts[index]?.includes(lowerQuery)) {
        continue;
      }
      matches.push({ rowId: row.id, columnId });
      if (useBitmask) mask |= 1 << index;
      else maskKey += `${index},`;
    }
    const setKey = useBitmask ? mask : maskKey;
    if (!setKey) continue;

    let columnSet = cache.columnSets.get(setKey);
    if (!columnSet) {
      columnSet = new Set(
        useBitmask
          ? dataColumnIds.filter((_, index) => mask & (1 << index))
          : maskKey
              .slice(0, -1)
              .split(",")
              .flatMap((index) => dataColumnIds[Number(index)] ?? []),
      );
      cache.columnSets.set(setKey, columnSet);
    }
    matchesByRowId.set(row.id, columnSet);
    matchedRows.push(rowIndex);
  }

  cache.result = {
    query: lowerQuery,
    rows,
    columnsKey: cache.columnsKey,
    rowTexts,
    matchedRows,
    matches,
    matchesByRowId,
  };
  return matches;
}

function warmSearchTextCache(table: DataGridInstance, cache: SearchTextCache) {
  if (typeof requestIdleCallback === "undefined") return;

  const rows = table.getRowModel().rows;
  const columns = table.getVisibleLeafColumns();
  getSearchColumnIds(columns, cache);
  const readValues = columns.filter(getIsDataColumn).map(getColumnValueReader);
  const columnsKey = cache.columnsKey;
  const lowerByValue = new Map<unknown, string>();
  let index = 0;

  function onIdle(deadline: IdleDeadline) {
    if (!table.atoms.searchOpen.get() || cache.columnsKey !== columnsKey) {
      return;
    }
    while (index < rows.length && deadline.timeRemaining() > 1) {
      const row = rows[index++];
      if (row) getRowSearchTexts(row, readValues, cache, lowerByValue);
    }
    if (index < rows.length) requestIdleCallback(onIdle);
  }

  requestIdleCallback(onIdle);
}

function goToSearchMatch(table: DataGridInstance, step: 1 | -1) {
  const matches = table.getSearchMatches();
  if (matches.length === 0) return;

  const index =
    (table.atoms.searchMatchIndex.get() + step + matches.length) %
    matches.length;
  const match = matches[index];
  if (!match) return;

  setStateSlice(table, "searchMatchIndex", index);
  table.setFocusedCell(match.rowId, match.columnId);
}

const dataGridSearchFeature: TableFeature = {
  getInitialState: (initialState) => ({
    searchOpen: false,
    searchQuery: "",
    searchMatchIndex: -1,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataGridSearch = {
      onSearchOpenChange: makeStateUpdater("searchOpen", table),
      onSearchQueryChange: makeStateUpdater("searchQuery", table),
      onSearchMatchIndexChange: makeStateUpdater("searchMatchIndex", table),
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    const searchTextCache: SearchTextCache = {
      columnsKey: "",
      textsByRow: new WeakMap(),
      columnSets: new Map(),
      result: null,
    };

    const setSearchQuery = (query: string) => {
      setStateSlice(instance, "searchQuery", query);
      const firstMatch = instance.getSearchMatches()[0];
      setStateSlice(instance, "searchMatchIndex", firstMatch ? 0 : -1);
      if (firstMatch) {
        instance.setFocusedCell(firstMatch.rowId, firstMatch.columnId);
      }
    };

    assignTableAPIs("dataGridSearchFeature", table, {
      table_getSearchOpen: {
        fn: () => instance.atoms.searchOpen.get(),
      },
      table_openSearch: {
        fn: () => {
          if (!instance.options.enableSearch) return;
          setStateSlice(instance, "searchOpen", true);
          warmSearchTextCache(instance, searchTextCache);
        },
      },
      table_closeSearch: {
        fn: () => {
          setStateSlice(instance, "searchQuery", "");
          setStateSlice(instance, "searchMatchIndex", -1);
          setStateSlice(instance, "searchOpen", false);
        },
      },
      table_getSearchQuery: {
        fn: () => instance.atoms.searchQuery.get(),
      },
      table_setSearchQuery: { fn: setSearchQuery },
      table_getSearchMatchIndex: {
        fn: () => instance.atoms.searchMatchIndex.get(),
      },
      table_getSearchMatches: {
        fn: (query: string, rows: Array<SearchRow>, columns: SearchColumns) =>
          getSearchMatches(query, rows, columns, searchTextCache),
        memoDeps: () => [
          instance.atoms.searchQuery.get(),
          instance.getRowModel().rows,
          instance.getVisibleLeafColumns(),
        ],
      },
      table_getSearchMatchesByRowId: {
        fn: (matches: Array<CellPosition>) => {
          const { result } = searchTextCache;
          if (result?.matches === matches) return result.matchesByRowId;

          const matchesByRowId = new Map<string, Set<string>>();
          for (const { rowId, columnId } of matches) {
            let columnIds = matchesByRowId.get(rowId);
            if (!columnIds) {
              columnIds = new Set();
              matchesByRowId.set(rowId, columnIds);
            }
            columnIds.add(columnId);
          }
          return matchesByRowId;
        },
        memoDeps: () => [instance.getSearchMatches()],
      },
      table_getActiveSearchMatch: {
        fn: () =>
          instance.getSearchMatches()[instance.atoms.searchMatchIndex.get()] ??
          null,
      },
      table_goToNextSearchMatch: {
        fn: () => goToSearchMatch(instance, 1),
      },
      table_goToPrevSearchMatch: {
        fn: () => goToSearchMatch(instance, -1),
      },
    });
  },
  assignCellPrototype: (prototype, table) => {
    assignPrototypeAPIs("dataGridSearchFeature", prototype, table, {
      cell_getIsSearchMatch: {
        fn: (cell: DataGridCellRef) =>
          asDataGrid(cell.table)
            .getSearchMatchesByRowId()
            .get(cell.row.id)
            ?.has(cell.column.id) ?? false,
      },
      cell_getIsActiveSearchMatch: {
        fn: (cell: DataGridCellRef) => {
          const match = asDataGrid(cell.table).getActiveSearchMatch();
          return (
            match?.rowId === cell.row.id && match.columnId === cell.column.id
          );
        },
      },
    });
  },
};

const EMPTY_CELL_PRESENCE: Array<CellPresence> = [];

const dataGridPresenceFeature: TableFeature = {
  getInitialState: (initialState) => ({
    cellPresence: EMPTY_CELL_PRESENCE,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataGridPresence = {
      onCellPresenceChange: makeStateUpdater("cellPresence", table),
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    assignTableAPIs("dataGridPresenceFeature", table, {
      table_getCellPresence: {
        fn: () => instance.atoms.cellPresence.get(),
      },
      table_setCellPresence: {
        fn: (updater: Updater<Array<CellPresence>>) =>
          setStateSlice(instance, "cellPresence", updater),
      },
      table_getCellPresenceByRowId: {
        fn: (cellPresence: Array<CellPresence>) => {
          const presenceByRowId = new Map<string, Map<string, CellPresence>>();
          for (const presence of cellPresence) {
            let presenceByColumnId = presenceByRowId.get(presence.rowId);
            if (!presenceByColumnId) {
              presenceByColumnId = new Map();
              presenceByRowId.set(presence.rowId, presenceByColumnId);
            }
            presenceByColumnId.set(presence.columnId, presence);
          }
          return presenceByRowId;
        },
        memoDeps: () => [instance.atoms.cellPresence.get()],
      },
    });
  },
  assignCellPrototype: (prototype, table) => {
    assignPrototypeAPIs("dataGridPresenceFeature", prototype, table, {
      cell_getPresence: {
        fn: (cell: DataGridCellRef) =>
          asDataGrid(cell.table)
            .getCellPresenceByRowId()
            .get(cell.row.id)
            ?.get(cell.column.id) ?? null,
      },
    });
  },
};

const DEFAULT_CONTEXT_MENU: ContextMenuState = { open: false, x: 0, y: 0 };

function getHasRowSelection(table: DataGridInstance) {
  return Object.keys(table.atoms.rowSelection.get()).length > 0;
}

function clearRowSelection(table: DataGridInstance) {
  if (getHasRowSelection(table)) makeStateUpdater("rowSelection", table)({});
}

function selectAllDataCells(table: DataGridInstance) {
  const rows = table.getRowModel().rows;
  const dataColumnIds = getDataColumnIds(table);
  const firstRowId = rows[0]?.id;
  const lastRowId = rows[rows.length - 1]?.id;
  const firstColumnId = dataColumnIds[0];
  const lastColumnId = dataColumnIds[dataColumnIds.length - 1];
  if (!firstRowId || !lastRowId || !firstColumnId || !lastColumnId) return;

  const allRange = {
    anchorRowId: firstRowId,
    anchorColumnId: firstColumnId,
    focusRowId: lastRowId,
    focusColumnId: lastColumnId,
  };
  const focusedCell = getFocusedCellPosition(table.atoms.cellSelection.get());

  table.setCellSelection(
    focusedCell
      ? [
          allRange,
          {
            anchorRowId: focusedCell.rowId,
            anchorColumnId: focusedCell.columnId,
            focusRowId: focusedCell.rowId,
            focusColumnId: focusedCell.columnId,
          },
        ]
      : [allRange],
  );
}

const dataGridSelectionFeature: TableFeature = {
  getInitialState: (initialState) => ({
    cellDragAnchor: null,
    contextMenu: DEFAULT_CONTEXT_MENU,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataGridSelection = {
      onCellDragAnchorChange: makeStateUpdater("cellDragAnchor", table),
      onContextMenuChange: makeStateUpdater("contextMenu", table),
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = asDataGrid(table);

    const clearSelection = () => {
      const focusedCell = getFocusedCellPosition(
        instance.atoms.cellSelection.get(),
      );
      if (focusedCell) {
        instance.setFocusedCell(focusedCell.rowId, focusedCell.columnId);
      } else {
        instance.resetCellSelection(true);
      }
      clearRowSelection(instance);
      setStateSlice(instance, "cellDragAnchor", null);
    };

    assignTableAPIs("dataGridSelectionFeature", table, {
      table_getHasCellRangeSelection: {
        fn: () => getHasCellRangeSelection(instance.atoms.cellSelection.get()),
      },
      table_getHasRowSelection: {
        fn: () => getHasRowSelection(instance),
      },
      table_getIsCellSelected: {
        fn: (rowId: string, columnId: string) => {
          if (
            !instance.options.enableSingleCellSelection &&
            !getHasCellRangeSelection(instance.atoms.cellSelection.get())
          ) {
            return false;
          }
          if (
            getHasRowSelection(instance) &&
            !instance.atoms.rowSelection.get()[rowId]
          ) {
            return false;
          }
          const row = instance.getRowModel().rowsById[rowId];
          return (
            row?.getAllCellsByColumnId()[columnId]?.getIsSelected() ?? false
          );
        },
      },
      table_getSelectedRangeCellCount: {
        fn: () =>
          instance.options.enableSingleCellSelection ||
          getHasCellRangeSelection(instance.atoms.cellSelection.get())
            ? instance.getSelectedCellCount()
            : 0,
      },
      table_clearSelection: { fn: clearSelection },
      table_clearRowSelection: {
        fn: () => clearRowSelection(instance),
      },
      table_selectAllDataCells: {
        fn: () => selectAllDataCells(instance),
      },
      table_extendCellSelectionTo: {
        fn: (cell: CellPosition) => {
          instance.setCellSelection((ranges) => {
            const activeRange = ranges[ranges.length - 1];
            if (!activeRange) {
              return [
                {
                  anchorRowId: cell.rowId,
                  anchorColumnId: cell.columnId,
                  focusRowId: cell.rowId,
                  focusColumnId: cell.columnId,
                },
              ];
            }
            return [
              ...ranges.slice(0, -1),
              {
                ...activeRange,
                focusRowId: cell.rowId,
                focusColumnId: cell.columnId,
              },
            ];
          });
        },
      },
      table_selectColumnCells: {
        fn: (columnId: string) => {
          if (!instance.options.enableColumnSelection) {
            clearSelection();
            return;
          }
          const rows = instance.getRowModel().rows;
          const firstRowId = rows[0]?.id;
          const lastRowId = rows[rows.length - 1]?.id;
          if (!firstRowId || !lastRowId) return;
          instance.selectCellRange({
            anchorRowId: firstRowId,
            anchorColumnId: columnId,
            focusRowId: lastRowId,
            focusColumnId: columnId,
          });
        },
      },
      table_getCellDragAnchor: {
        fn: () => instance.atoms.cellDragAnchor.get(),
      },
      table_startCellDrag: {
        fn: (cell: CellPosition) => {
          clearRowSelection(instance);
          setStateSlice(instance, "cellDragAnchor", cell);
        },
      },
      table_endCellDrag: {
        fn: () => {
          if (instance.atoms.cellDragAnchor.get()) {
            setStateSlice(instance, "cellDragAnchor", null);
          }
        },
      },
      table_getContextMenu: {
        fn: () => instance.atoms.contextMenu.get(),
      },
      table_openContextMenu: {
        fn: ({ x, y }: { x: number; y: number }) =>
          setStateSlice(instance, "contextMenu", { open: true, x, y }),
      },
      table_closeContextMenu: {
        fn: () => {
          const contextMenu = instance.atoms.contextMenu.get();
          if (!contextMenu.open) return;
          setStateSlice(instance, "contextMenu", {
            ...contextMenu,
            open: false,
          });
        },
      },
    });
  },
};

type CoreRow = Row<TableFeatures, RowData>;

function createDataGridCoreRowModel<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(): (table: Table<TFeatures, TData>) => () => RowModel<TFeatures, TData> {
  return (_table) => {
    const table = _table as unknown as Table<TableFeatures, RowData>;
    let previous: RowModel<TableFeatures, RowData> | null = null;
    return tableMemo({
      feature: "coreRowModelsFeature",
      table: _table,
      fnName: "table.getCoreRowModel",
      memoDeps: () => [table.options.data],
      fn: () => {
        previous = getCoreRowModel(table, previous);
        return previous as unknown as RowModel<TFeatures, TData>;
      },
      onAfterUpdate: skipFirstRun(() => {
        table_autoResetExpanded(table);
        table_autoResetPageIndex(table);
        table_autoResetSorting(table);
        table_autoResetCellSelection(table);
      }),
    });
  };
}

function getCoreRowModel(
  table: Table<TableFeatures, RowData>,
  previous: RowModel<TableFeatures, RowData> | null,
): RowModel<TableFeatures, RowData> {
  const { data, getSubRows } = table.options;

  if (previous && !getSubRows && previous.rows.length === data.length) {
    const rows = previous.rows.slice();
    const changedRows: Array<CoreRow> = [];
    let isSameShape = true;
    for (let i = 0; i < data.length; i++) {
      const originalRow = data[i];
      const previousRow = rows[i];
      if (originalRow === undefined || !previousRow) {
        isSameShape = false;
        break;
      }
      if (previousRow.original === originalRow) continue;
      const id = table.getRowId(originalRow, i);
      if (id !== previousRow.id) {
        isSameShape = false;
        break;
      }
      const row = constructRow(table, id, originalRow, i, 0);
      rows[i] = row;
      changedRows.push(row);
    }

    if (isSameShape) {
      const rowsById = previous.rowsById;
      for (const row of changedRows) rowsById[row.id] = row;
      return { rows, flatRows: rows.slice(), rowsById };
    }
  }

  const rowModel: RowModel<TableFeatures, RowData> = {
    rows: [],
    flatRows: [],
    rowsById: makeObjectMap<CoreRow>(),
  };

  function accessRows(
    originalRows: ReadonlyArray<RowData>,
    depth: number,
    previousRows: ReadonlyArray<CoreRow>,
    parentRow?: CoreRow,
  ) {
    const rows: Array<CoreRow> = [];
    for (let i = 0; i < originalRows.length; i++) {
      const originalRow = originalRows[i];
      if (originalRow === undefined) continue;
      const previousRow = previousRows[i];
      const row =
        !getSubRows && previousRow?.original === originalRow
          ? previousRow
          : constructRow(
              table,
              table.getRowId(originalRow, i, parentRow),
              originalRow,
              i,
              depth,
              undefined,
              parentRow?.id,
            );
      rowModel.flatRows.push(row);
      rowModel.rowsById[row.id] = row;
      rows.push(row);

      if (getSubRows) {
        row.originalSubRows = getSubRows(originalRow, i);
        if (row.originalSubRows?.length) {
          row.subRows = accessRows(row.originalSubRows, depth + 1, [], row);
        }
      }
    }
    return rows;
  }

  rowModel.rows = accessRows(data, 0, previous?.rows ?? []);
  return rowModel;
}

type SortedRow = Row<TableFeatures, RowData>;
type SortedRowFn = SortFn<TableFeatures, RowData>;

interface ResolvedSort {
  id: string;
  desc: boolean;
  invertSorting: boolean;
  sortUndefined: false | -1 | 1 | "first" | "last" | undefined;
  sortFn: SortedRowFn;
  compareValues: SortFnDef<TableFeatures, RowData>["sort"] | null;
}

const alphanumericCompares = new Set<unknown>([
  sortFn_alphanumeric.sort,
  sortFn_alphanumericCaseSensitive.sort,
]);

function compareBasic(a: unknown, b: unknown) {
  return a === b ? 0 : (a as number) > (b as number) ? 1 : -1;
}

function getIsDigit(code: number) {
  return code >= 48 && code <= 57;
}

function getAlphanumericSortKey(value: unknown) {
  if (typeof value !== "string") return null;
  let key = "";
  let index = 0;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code === 0 || code >= 0xff) return null;
    const isNumeric = getIsDigit(code);
    let end = index + 1;
    while (
      end < value.length &&
      getIsDigit(value.charCodeAt(end)) === isNumeric
    ) {
      end++;
    }
    if (isNumeric) {
      let start = index;
      while (start < end && value.charCodeAt(start) === 48) start++;
      const digitCount = end - start;
      if (digitCount > 15) return null;
      key += `\u00ff${String.fromCharCode(48 + digitCount)}${value.slice(start, end)}`;
    } else {
      key += `${value.slice(index, end)}\u0000`;
    }
    index = end;
  }
  return key;
}

function getAlphanumericSortKeys(values: Array<unknown>) {
  const keys: Array<string> = [];
  for (const value of values) {
    const key = getAlphanumericSortKey(value);
    if (key === null) return null;
    keys.push(key);
  }
  return keys;
}

function getValueSort(sortFn: SortedRowFn) {
  return "sort" in sortFn && typeof sortFn.sort === "function"
    ? (sortFn.sort as SortFnDef<TableFeatures, RowData>["sort"])
    : null;
}

function createDataGridSortedRowModel<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(): (table: Table<TFeatures, TData>) => () => RowModel<TFeatures, TData> {
  return (_table) => {
    const table = _table as unknown as Table<TableFeatures, RowData>;
    const cache: SortCaches = {
      current: null,
      unfiltered: null,
      filtered: null,
    };
    return tableMemo({
      feature: "rowSortingFeature",
      table: _table,
      fnName: "table.getSortedRowModel",
      memoDeps: () => [
        table.atoms.sorting?.get(),
        table.getPreSortedRowModel(),
      ],
      fn: () =>
        getSortedRowModel(table, cache) as unknown as RowModel<
          TFeatures,
          TData
        >,
      onAfterUpdate: skipFirstRun(() => table_autoResetPageIndex(table)),
    });
  };
}

interface SortCache {
  rows: Array<SortedRow>;
  sorting: Array<{ id: string; desc: boolean }>;
  order: Array<number>;
  getIsTie: (a: number, b: number) => boolean;
}

interface SortCaches {
  current: SortCache | null;
  unfiltered: SortCache | null;
  filtered: Pick<SortCache, "rows" | "sorting" | "order"> | null;
}

function getIsSameSorting(
  previous: SortCache["sorting"],
  sorting: Array<ResolvedSort>,
) {
  return (
    previous.length === sorting.length &&
    sorting.every(
      (sort, index) =>
        sort.id === previous[index]?.id && sort.desc === previous[index]?.desc,
    )
  );
}

function getUpdatedUnfilteredCache(
  table: Table<TableFeatures, RowData>,
  cache: SortCache,
  rows: Array<SortedRow>,
  sorting: Array<ResolvedSort>,
): SortCache | null {
  if (cache.rows === rows) return cache;
  if (cache.rows.length !== rows.length) return null;

  const columns = sorting.map((sort) => table.getColumn(sort.id));
  if (columns.some((column) => !column?.accessorFn)) return null;
  const readValues = columns.map(getColumnValueReader);

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const previousRow = cache.rows[index];
    if (row === previousRow) continue;
    if (!row || !previousRow || row.id !== previousRow.id) return null;
    for (const readValue of readValues) {
      if (!Object.is(readValue(row), readValue(previousRow))) return null;
    }
  }

  return { ...cache, rows };
}

function getIsFlippedSorting(
  previous: SortCache["sorting"],
  sorting: Array<ResolvedSort>,
) {
  return (
    previous.length === sorting.length &&
    sorting.every(
      (sort, index) =>
        sort.id === previous[index]?.id && sort.desc !== previous[index]?.desc,
    )
  );
}

function getFlippedOrder(
  order: Array<number>,
  getIsTie: (a: number, b: number) => boolean,
) {
  const flipped: Array<number> = [];
  let groupEnd = order.length;
  for (let index = order.length - 1; index >= 0; index--) {
    const current = order[index];
    const previous = order[index - 1];
    if (current === undefined) continue;
    if (previous === undefined || !getIsTie(previous, current)) {
      for (let i = index; i < groupEnd; i++) {
        const rowIndex = order[i];
        if (rowIndex !== undefined) flipped.push(rowIndex);
      }
      groupEnd = index;
    }
  }
  return flipped;
}

function getSortedRowModel(
  table: Table<TableFeatures, RowData>,
  cache: SortCaches,
): RowModel<TableFeatures, RowData> {
  const preSortedRowModel = table.getPreSortedRowModel();
  const sorting = table.atoms.sorting?.get();
  if (!preSortedRowModel.rows.length || !sorting?.length) {
    return preSortedRowModel;
  }

  const resolvedSorting: Array<ResolvedSort> = [];
  for (const sort of sorting) {
    const column = table.getColumn(sort.id);
    if (!column || !column_getCanSort(column)) continue;
    const sortFn = column_getSortFn(column);
    resolvedSorting.push({
      id: sort.id,
      desc: sort.desc,
      invertSorting: !!column.columnDef.invertSorting,
      sortUndefined: column.columnDef.sortUndefined,
      sortFn,
      compareValues: getValueSort(sortFn),
    });
  }
  if (!resolvedSorting.length) return preSortedRowModel;

  const sortedFlatRows: Array<SortedRow> = [];

  const isCacheable =
    preSortedRowModel.flatRows.length === preSortedRowModel.rows.length &&
    resolvedSorting.every(
      ({ sortUndefined }) =>
        sortUndefined !== "first" && sortUndefined !== "last",
    );
  const previous = cache.current;
  cache.current = null;

  const unfilteredRowModel = table.getPreFilteredRowModel();
  const unfilteredRows = unfilteredRowModel.rows;
  const isFlat =
    preSortedRowModel.flatRows.length === preSortedRowModel.rows.length &&
    unfilteredRowModel.flatRows.length === unfilteredRows.length;
  const isFiltered = preSortedRowModel.rows !== unfilteredRows;

  let unfiltered =
    isFlat && cache.unfiltered
      ? getUpdatedUnfilteredCache(
          table,
          cache.unfiltered,
          unfilteredRows,
          resolvedSorting,
        )
      : null;
  if (
    unfiltered &&
    !getIsSameSorting(unfiltered.sorting, resolvedSorting) &&
    !(isCacheable && getIsFlippedSorting(unfiltered.sorting, resolvedSorting))
  ) {
    unfiltered = null;
  }
  cache.unfiltered = unfiltered;

  const previousFiltered = cache.filtered;
  cache.filtered = null;

  if (unfiltered) {
    const sorting = resolvedSorting.map(({ id, desc }) => ({ id, desc }));
    const rowsById = preSortedRowModel.rowsById;
    let order: Array<number>;

    if (
      isFiltered &&
      isCacheable &&
      previousFiltered?.rows === preSortedRowModel.rows &&
      getIsFlippedSorting(previousFiltered.sorting, resolvedSorting)
    ) {
      order = getFlippedOrder(previousFiltered.order, unfiltered.getIsTie);
    } else {
      if (!getIsSameSorting(unfiltered.sorting, resolvedSorting)) {
        unfiltered = {
          ...unfiltered,
          sorting,
          order: getFlippedOrder(unfiltered.order, unfiltered.getIsTie),
        };
        cache.unfiltered = unfiltered;
      }
      if (isCacheable && !isFiltered) cache.current = unfiltered;

      order = isFiltered ? [] : unfiltered.order;
      if (isFiltered) {
        for (const index of unfiltered.order) {
          const row = unfilteredRows[index];
          if (row && rowsById[row.id] === row) order.push(index);
        }
      }
    }

    if (isFiltered) {
      cache.filtered = { rows: preSortedRowModel.rows, sorting, order };
    }

    const rows: Array<SortedRow> = [];
    for (const index of order) {
      const row = unfilteredRows[index];
      if (row) rows.push(row);
    }
    return { rows, flatRows: rows.slice(), rowsById };
  }

  function getRowsComparator(rows: Array<SortedRow>) {
    const rawValues = resolvedSorting.map((sort) =>
      sort.compareValues || sort.sortUndefined
        ? rows.map(getColumnValueReader(table.getColumn(sort.id)))
        : null,
    );
    const sortValues = resolvedSorting.map((sort, sortIndex) => {
      const values = rawValues[sortIndex];
      if (!sort.compareValues || !values) return null;
      const resolve = sort.sortFn.resolveDataValue;
      return resolve ? values.map((value) => resolve(value)) : values;
    });

    const sortKeys = resolvedSorting.map((sort, sortIndex) => {
      const values = sortValues[sortIndex];
      return values && alphanumericCompares.has(sort.compareValues)
        ? getAlphanumericSortKeys(values)
        : null;
    });

    return (a: number, b: number) => {
      const rowA = rows[a];
      const rowB = rows[b];
      if (!rowA || !rowB) return 0;
      for (let i = 0; i < resolvedSorting.length; i++) {
        const sort = resolvedSorting[i];
        if (!sort) continue;
        let sortInt = 0;

        const values = rawValues[i];
        if (sort.sortUndefined && values) {
          const isAUndefined = values[a] === undefined;
          const isBUndefined = values[b] === undefined;
          if (isAUndefined && isBUndefined) continue;
          if (isAUndefined || isBUndefined) {
            if (sort.sortUndefined === "first") return isAUndefined ? -1 : 1;
            if (sort.sortUndefined === "last") return isAUndefined ? 1 : -1;
            sortInt = isAUndefined ? sort.sortUndefined : -sort.sortUndefined;
          }
        }

        const keys = sortKeys[i];
        if (sortInt === 0 && keys) {
          sortInt = compareBasic(keys[a], keys[b]);
        } else if (sortInt === 0) {
          const values = sortValues[i];
          sortInt =
            values && sort.compareValues
              ? sort.compareValues(values[a], values[b], rowA, rowB, sort.id)
              : sort.sortFn(rowA, rowB, sort.id);
        }

        if (sortInt !== 0) {
          if (sort.desc) sortInt *= -1;
          if (sort.invertSorting) sortInt *= -1;
          return sortInt;
        }
      }
      return 0;
    };
  }

  function sortRows(rows: Array<SortedRow>, isTopLevel = false) {
    let order: Array<number>;
    let getIsTie: (a: number, b: number) => boolean;

    if (
      isTopLevel &&
      previous &&
      previous.rows === rows &&
      getIsFlippedSorting(previous.sorting, resolvedSorting)
    ) {
      order = getFlippedOrder(previous.order, previous.getIsTie);
      getIsTie = previous.getIsTie;
    } else {
      const compare = getRowsComparator(rows);
      order = rows.map((_, index) => index);
      order.sort(
        (a, b) =>
          compare(a, b) || (rows[a]?.index ?? 0) - (rows[b]?.index ?? 0),
      );
      getIsTie = (a, b) => compare(a, b) === 0;
    }

    if (isTopLevel) {
      const sortCache: SortCache = {
        rows,
        sorting: resolvedSorting.map(({ id, desc }) => ({ id, desc })),
        order,
        getIsTie,
      };
      if (isCacheable) cache.current = sortCache;
      if (isFlat && !isFiltered) cache.unfiltered = sortCache;
    }

    const sortedRows: Array<SortedRow> = [];
    let changed = false;
    for (const index of order) {
      const row = rows[index];
      if (!row) continue;
      if (row !== rows[sortedRows.length]) changed = true;
      const flatIndex = sortedFlatRows.length;
      sortedFlatRows.push(row);
      sortedRows.push(row);

      if (row.subRows.length) {
        const sortedSubRows = sortRows(row.subRows);
        if (sortedSubRows.changed) {
          const cloned = Object.create(Object.getPrototypeOf(row));
          copyInstancePropertiesWithoutMemos(cloned, row);
          cloned.subRows = sortedSubRows.rows;
          sortedRows[sortedRows.length - 1] = cloned;
          sortedFlatRows[flatIndex] = cloned;
          changed = true;
        }
      }
    }
    return { rows: sortedRows, changed };
  }

  return {
    rows: sortRows(preSortedRowModel.rows, true).rows,
    flatRows: sortedFlatRows,
    rowsById: preSortedRowModel.rowsById,
  };
}

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
  dataGridColumnOrderingFeature,
  dataGridDataFeature,
  dataGridNavigationFeature,
  dataGridClipboardFeature,
  dataGridSearchFeature,
  dataGridPresenceFeature,
  dataGridSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  coreRowModel: createDataGridCoreRowModel(),
  sortedRowModel: createDataGridSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
