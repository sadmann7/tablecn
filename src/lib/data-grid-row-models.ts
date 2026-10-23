import {
  constructRow,
  copyInstancePropertiesWithoutMemos,
  createFilteredRowModel,
  makeObjectMap,
  type Row,
  type RowData,
  type RowModel,
  skipFirstRun,
  type SortFn,
  sortFn_alphanumeric,
  sortFn_alphanumericCaseSensitive,
  type SortFnDef,
  type Table,
  type TableFeatures,
  tableMemo,
} from "@tanstack/react-table";
import {
  column_getCanSort,
  column_getSortFn,
  table_autoResetCellSelection,
  table_autoResetExpanded,
  table_autoResetPageIndex,
  table_autoResetSorting,
} from "@tanstack/react-table/static-functions";

import { getColumnValueReader } from "@/lib/data-grid-utils";

// Rows whose `original` was swapped for a copy in place. The row models rebuild them
// even when the data hands back that copy, and the sort cache doesn't trust their
// old values, so sorting and filtering see what changed
export const patchedRows = new WeakSet();

export interface RowChangeHint {
  from: ReadonlyArray<RowData>;
  removedIndexes: number[];
  insertedIndexes: number[];
}

// What a row change did to the data it was built from, so the core row model can shift
// its rows instead of rebuilding every row after the change
export const rowChangeHints = new WeakMap<
  ReadonlyArray<RowData>,
  RowChangeHint
>();

type CoreRow = Row<TableFeatures, RowData>;

// TanStack's filtered row model, except that with no filters it hands back the rows
// as they are. TanStack resets every row's filter results on each data change, which
// allocates two objects per row, so only the first pass after filters clear does that
export function createDataGridFilteredRowModel<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(): (table: Table<TFeatures, TData>) => () => RowModel<TFeatures, TData> {
  const createFiltered = createFilteredRowModel<TFeatures, TData>();
  return (_table) => {
    const getFilteredRowModel = createFiltered(_table);
    const table = _table as unknown as Table<TableFeatures, RowData>;
    let hasFilterResults = false;
    return () => {
      const columnFilters = table.atoms.columnFilters?.get();
      const globalFilter = table.atoms.globalFilter?.get();
      const hasFilters =
        !!columnFilters?.length ||
        (globalFilter !== undefined &&
          globalFilter !== null &&
          globalFilter !== "");
      if (!hasFilters && !hasFilterResults) {
        return _table.getPreFilteredRowModel();
      }
      hasFilterResults = hasFilters;
      return getFilteredRowModel();
    };
  };
}

export function createDataGridCoreRowModel<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(): (table: Table<TFeatures, TData>) => () => RowModel<TFeatures, TData> {
  return (_table) => {
    const table = _table as unknown as Table<TableFeatures, RowData>;
    let previous: RowModel<TableFeatures, RowData> | null = null;
    let previousData: ReadonlyArray<RowData> | null = null;
    return tableMemo({
      feature: "coreRowModelsFeature",
      table: _table,
      fnName: "table.getCoreRowModel",
      memoDeps: () => [table.options.data],
      fn: () => {
        const { data } = table.options;
        const hint = rowChangeHints.get(data);
        previous =
          previous &&
          hint?.from === previousData &&
          table.options.getRowId &&
          !table.options.getSubRows
            ? getShiftedRowModel(table, previous, hint)
            : getCoreRowModel(table, previous);
        previousData = data;
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

// Rebuilds the core rows after rows were added or removed, reusing every row that
// stayed and updating its index, so the change costs index writes, not new rows.
// Needs `getRowId`, since index-based IDs would change too
function getShiftedRowModel(
  table: Table<TableFeatures, RowData>,
  previous: RowModel<TableFeatures, RowData>,
  { removedIndexes, insertedIndexes }: RowChangeHint,
): RowModel<TableFeatures, RowData> {
  const { data } = table.options;
  const { rowsById } = previous;
  const rows: Array<CoreRow> = Array.from({ length: data.length });
  let previousIndex = 0;
  let removed = 0;
  let inserted = 0;

  const skipRemoved = () => {
    while (removedIndexes[removed] === previousIndex) {
      const gone = previous.rows[previousIndex];
      if (gone) delete rowsById[gone.id];
      removed++;
      previousIndex++;
    }
  };

  for (let index = 0; index < data.length; index++) {
    const originalRow = data[index];
    if (originalRow === undefined) continue;
    let row: CoreRow | undefined;
    if (insertedIndexes[inserted] === index) {
      inserted++;
    } else {
      skipRemoved();
      row = previous.rows[previousIndex++];
    }
    if (row && getIsReusableRow(row, originalRow)) {
      if (row.index !== index) row.index = index;
    } else {
      row = constructRow(
        table,
        table.getRowId(originalRow, index),
        originalRow,
        index,
        0,
      );
      rowsById[row.id] = row;
    }
    rows[index] = row;
  }
  skipRemoved();

  return { rows, flatRows: rows.slice(), rowsById };
}

function getIsReusableRow(row: CoreRow, originalRow: RowData) {
  return row.original === originalRow && !patchedRows.has(row);
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
      if (getIsReusableRow(previousRow, originalRow)) continue;
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
        !getSubRows && previousRow && getIsReusableRow(previousRow, originalRow)
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

export function createDataGridSortedRowModel<
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

// Past this share of changed rows, sorting everything again is cheaper
const MAX_RESORTED_SHARE = 1 / 8;

// Keeps the cached order when rows kept their sort values, and moves just the rows
// whose values changed when there are few of them, instead of sorting every row again
function getUpdatedUnfilteredCache(
  table: Table<TableFeatures, RowData>,
  cache: SortCache,
  rows: Array<SortedRow>,
  sorting: Array<ResolvedSort>,
): SortCache | null {
  if (cache.rows === rows) return cache;
  if (cache.rows.length !== rows.length) return null;
  if (
    cache.sorting.length !== sorting.length ||
    cache.sorting.some((sort, index) => sort.id !== sorting[index]?.id)
  ) {
    return null;
  }

  const columns = sorting.map((sort) => table.getColumn(sort.id));
  if (columns.some((column) => !column?.accessorFn)) return null;
  const readValues = columns.map(getColumnValueReader);
  const maxChanged = Math.max(1, Math.floor(rows.length * MAX_RESORTED_SHARE));

  const changed: Array<number> = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const previousRow = cache.rows[index];
    if (row === previousRow) continue;
    if (!row || !previousRow || row.id !== previousRow.id) return null;
    // A row patched in place already reads its new values, so it counts as changed
    const isChanged =
      patchedRows.has(previousRow) ||
      readValues.some(
        (readValue) => !Object.is(readValue(row), readValue(previousRow)),
      );
    if (!isChanged) continue;
    changed.push(index);
    if (changed.length > maxChanged) return null;
  }
  if (changed.length === 0) return { ...cache, rows };

  // The cache may be sorted the other way, which the caller flips afterwards
  const cachedSorting = sorting.map((sort, index) => ({
    ...sort,
    desc: cache.sorting[index]?.desc ?? sort.desc,
  }));
  const compare = getLazyRowsComparator(rows, cachedSorting, readValues);
  const compareWithTie = (a: number, b: number) =>
    compare(a, b) || (rows[a]?.index ?? 0) - (rows[b]?.index ?? 0);

  const changedSet = new Set(changed);
  const remaining = cache.order.filter((index) => !changedSet.has(index));
  changed.sort(compareWithTie);

  const order: Array<number> = [];
  let from = 0;
  for (const index of changed) {
    let low = from;
    let high = remaining.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (compareWithTie(remaining[middle] as number, index) <= 0) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    for (; from < low; from++) order.push(remaining[from] as number);
    order.push(index);
  }
  for (; from < remaining.length; from++) order.push(remaining[from] as number);

  return {
    rows,
    sorting: cache.sorting,
    order,
    getIsTie: (a, b) => compare(a, b) === 0,
  };
}

// Compares rows like the full sort, reading values as it goes instead of up front,
// for the few comparisons moving changed rows takes
function getLazyRowsComparator(
  rows: Array<SortedRow>,
  sorting: Array<ResolvedSort>,
  readValues: Array<(row: SortedRow) => unknown>,
) {
  return (a: number, b: number) => {
    const rowA = rows[a];
    const rowB = rows[b];
    if (!rowA || !rowB) return 0;
    for (let i = 0; i < sorting.length; i++) {
      const sort = sorting[i];
      const readValue = readValues[i];
      if (!sort || !readValue) continue;
      let sortInt = 0;

      const valueA = readValue(rowA);
      const valueB = readValue(rowB);
      if (sort.sortUndefined) {
        const isAUndefined = valueA === undefined;
        const isBUndefined = valueB === undefined;
        if (isAUndefined && isBUndefined) continue;
        if (isAUndefined || isBUndefined) {
          if (sort.sortUndefined === "first") return isAUndefined ? -1 : 1;
          if (sort.sortUndefined === "last") return isAUndefined ? 1 : -1;
          sortInt = isAUndefined ? sort.sortUndefined : -sort.sortUndefined;
        }
      }

      if (sortInt === 0) {
        if (sort.compareValues) {
          const resolve = sort.sortFn.resolveDataValue;
          sortInt = sort.compareValues(
            resolve ? resolve(valueA) : valueA,
            resolve ? resolve(valueB) : valueB,
            rowA,
            rowB,
            sort.id,
          );
        } else {
          sortInt = sort.sortFn(rowA, rowB, sort.id);
        }
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
