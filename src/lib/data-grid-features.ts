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
  makeStateUpdater,
  metaHelper,
  type OnChangeFn,
  type RowData,
  rowSelectionFeature,
  rowSortingFeature,
  setStateSlice,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  type Table,
  type TableFeature,
  type TableFeatures,
  tableFeatures,
  type Updater,
} from "@tanstack/react-table";

import type {
  CellPosition,
  CellPresence,
  ClipboardNotice,
  CellUpdate,
  ContextMenuState,
  DataGridColumnMeta,
  FileCellData,
  Direction,
  NavigationDirection,
  PasteDialogState,
  RowHeightValue,
} from "@/lib/data-grid-types";

import {
  getCellKey,
  getEmptyCellValue,
  getFocusedCellPosition,
  getHasCellRangeSelection,
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
  /** Moves focus after committing, like Tab or the arrow keys. */
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
  /** Disables every data mutation, including cell edits and row deletion. */
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

interface TableState_DataGridNavigation {
  /** Column whose header holds keyboard focus, which hides the focused cell while the selection stays. */
  focusedHeaderColumnId: string | null;
}

interface TableOptions_DataGridNavigation {
  /** Reading direction, so left and right follow the visual layout. */
  dir?: Direction;
  /** Brings a cell into view, provided by the layer that owns the scroll container. */
  onScrollToCell?: (cell: CellPosition) => void;
  onFocusedHeaderColumnIdChange?: OnChangeFn<string | null>;
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
  /** Scrolls a cell into view without moving focus or selection. */
  scrollToCell: (rowId: string, columnId: string) => void;
  getFocusedHeaderColumnId: () => string | null;
  setFocusedHeaderColumnId: (updater: Updater<string | null>) => void;
}

interface TableState_DataGridClipboard {
  /** Cut source cells laid out in the same rows and columns as the clipboard text. */
  cutCellGrid: Array<Array<CellPosition | null>>;
  pasteDialog: PasteDialogState;
}

interface TableOptions_DataGridClipboard {
  enablePaste?: boolean;
  /** Called with the parsed updates before they are written through `onDataChange`. */
  onPaste?: (updates: Array<CellUpdate>) => void | Promise<void>;
  /** Adds rows when a paste needs more rows than the table has. */
  onRowsAdd?: (count: number) => void | Promise<void>;
  onClipboardNotice?: (notice: ClipboardNotice) => void;
  onCutCellGridChange?: OnChangeFn<Array<Array<CellPosition | null>>>;
  onPasteDialogChange?: OnChangeFn<PasteDialogState>;
}

interface PasteCellsOptions {
  /** Adds the rows a paste needs through `onRowsAdd` instead of asking first. */
  expandRows?: boolean;
}

interface Table_DataGridClipboard {
  /** Selected cells in data columns, row by row in display order. */
  getSelectedCells: () => Array<CellPosition>;
  getCutCellGrid: () => Array<Array<CellPosition | null>>;
  setCutCellGrid: (updater: Updater<Array<Array<CellPosition | null>>>) => void;
  resetCutCellGrid: (defaultState?: boolean) => void;
  getPasteDialog: () => PasteDialogState;
  setPasteDialog: (updater: Updater<PasteDialogState>) => void;
  resetPasteDialog: (defaultState?: boolean) => void;
  copySelectedCells: () => Promise<void>;
  /** Copies the selection and clears it from its source on the next paste. */
  cutSelectedCells: () => Promise<void>;
  /** Pastes clipboard text at the focused cell, or fills the selection with a single value. */
  pasteCells: (options?: PasteCellsOptions) => Promise<void>;
}

interface TableState_DataGridSearch {
  searchOpen: boolean;
  searchQuery: string;
  /** Index into `getSearchMatches()` of the active match, `-1` when there is none. */
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
  /** Closes search, clears the query and leaves focus on the active match. */
  closeSearch: () => void;
  getSearchQuery: () => string;
  /** Applies a query and moves focus to its first match. */
  setSearchQuery: (query: string) => void;
  getSearchMatchIndex: () => number;
  /** Data cells whose value contains the query, row by row in display order. */
  getSearchMatches: () => Array<CellPosition>;
  /** Matched column ids per row id, for re-rendering only the rows that match. */
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
  /** Cells collaborators are on, kept out of undo history since it comes from the network. */
  cellPresence: Array<CellPresence>;
}

interface TableOptions_DataGridPresence {
  onCellPresenceChange?: OnChangeFn<Array<CellPresence>>;
}

interface Table_DataGridPresence {
  getCellPresence: () => Array<CellPresence>;
  setCellPresence: (updater: Updater<Array<CellPresence>>) => void;
  /** Collaborators per column id per row id, for re-rendering only the rows they are on. */
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
  /** Highlights the lone focused cell as a one-cell selection. */
  enableSingleCellSelection?: boolean;
  /** Clicking a column header selects its cells instead of clearing the selection. */
  enableColumnSelection?: boolean;
  onCellDragAnchorChange?: OnChangeFn<CellPosition | null>;
  onContextMenuChange?: OnChangeFn<ContextMenuState>;
}

interface Table_DataGridSelection {
  getHasCellRangeSelection: () => boolean;
  getHasRowSelection: () => boolean;
  /** Whether the cell is highlighted, the lone focused cell only counts with `enableSingleCellSelection`. */
  getIsCellSelected: (rowId: string, columnId: string) => boolean;
  /** Number of highlighted cells, following the same rule as `getIsCellSelected`. */
  getSelectedRangeCellCount: () => number;
  /** Clears cell and row selection, keeping the focused cell. */
  clearSelection: () => void;
  /** Unlike `resetRowSelection`, skips `onRowSelectionChange` so the cell selection stays put. */
  clearRowSelection: () => void;
  /** Selects every data cell while the focused cell stays active. */
  selectAllDataCells: () => void;
  /** Moves the active range's far corner, keeping its anchor and any earlier ranges. */
  extendCellSelectionTo: (cell: CellPosition) => void;
  /** Selects a column's cells, or clears the selection when column selection is off. */
  selectColumnCells: (columnId: string) => void;
  getCellDragAnchor: () => CellPosition | null;
  /** Starts a drag selection from the cell and drops any row selection. */
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
          instance.options.onScrollToCell?.({ rowId, columnId }),
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

function serializeSelectedCells(table: DataGridInstance) {
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
            ? serializeCellValue(
                cell.getValue(),
                cell.column.columnDef.meta?.cell?.variant,
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

  const serialized = serializeSelectedCells(table);
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
    // New rows only reach the table after the consumer's data update re-renders it
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

function getSearchMatches(
  query: string,
  rows: ReturnType<DataGridInstance["getRowModel"]>["rows"],
  columns: ReturnType<DataGridInstance["getVisibleLeafColumns"]>,
) {
  const lowerQuery = query.trim().toLowerCase();
  if (!lowerQuery) return [];

  const dataColumnIds = columns
    .filter(getIsDataColumn)
    .map((column) => column.id);

  const matches: Array<CellPosition> = [];
  for (const row of rows) {
    const cellsByColumnId = row.getAllCellsByColumnId();
    for (const columnId of dataColumnIds) {
      const value = cellsByColumnId[columnId]?.getValue();
      if (stringifyUnknown(value).toLowerCase().includes(lowerQuery)) {
        matches.push({ rowId: row.id, columnId });
      }
    }
  }
  return matches;
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
        fn: getSearchMatches,
        memoDeps: () => [
          instance.atoms.searchQuery.get(),
          instance.getRowModel().rows,
          instance.getVisibleLeafColumns(),
        ],
      },
      table_getSearchMatchesByRowId: {
        fn: (matches: Array<CellPosition>) => {
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

  // The focused cell stays the active range so selecting everything doesn't move focus
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
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  columnMeta: metaHelper<DataGridColumnMeta>(),
});

export type DataGridFeatures = typeof dataGridFeatures;
