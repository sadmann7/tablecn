import {
  assignTableAPIs,
  type ColumnFilter,
  columnFacetingFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFacetedMinMaxValues,
  createFacetedUniqueValues,
  createPaginatedRowModel,
  createSortedRowModel,
  functionalUpdate,
  makeStateUpdater,
  metaHelper,
  setStateSlice,
  type OnChangeFn,
  type RowData,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  type TableFeature,
  type TableFeatures,
  tableFeatures,
  type Updater,
} from "@tanstack/react-table";

import type {
  ColumnFilterItem,
  DataTableColumnMeta,
  FilterVariant,
  JoinOperator,
} from "@/lib/data-table-types";

import {
  createDataTableFacetedRowModel,
  createDataTableFilteredRowModel,
  dataTableFilterFn,
} from "@/lib/data-table-filters";
import { resolveColumnFilter } from "@/lib/data-table-utils";

interface TableState_DataTableFiltering {
  joinOperator: JoinOperator;
}

interface TableOptions_DataTableFiltering {
  onJoinOperatorChange?: OnChangeFn<JoinOperator>;
}

interface Table_DataTableFiltering {
  /** `columnFilters` with every field resolved, for the filter list. */
  getColumnFilterItems: () => ColumnFilterItem[];
  addColumnFilter: (filter: ColumnFilterItem) => void;
  updateColumnFilter: (
    filterId: string,
    updates: Partial<Omit<ColumnFilterItem, "filterId">>,
  ) => void;
  removeColumnFilter: (filterId: string) => void;
  getJoinOperator: () => JoinOperator;
  setJoinOperator: (updater: Updater<JoinOperator>) => void;
  resetJoinOperator: (defaultState?: boolean) => void;
}

declare module "@tanstack/react-table" {
  interface Plugins {
    dataTableFilteringFeature: TableFeature;
  }

  interface TableState_FeatureMap {
    dataTableFilteringFeature: TableState_DataTableFiltering;
  }

  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataTableFilteringFeature: TableOptions_DataTableFiltering;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    dataTableFilteringFeature: Table_DataTableFiltering;
  }
}

interface DataTableFilteringInstance {
  atoms: {
    columnFilters: { get: () => ColumnFilter[] };
    joinOperator: { get: () => JoinOperator };
  };
  initialState: Partial<TableState_DataTableFiltering>;
  options: TableOptions_DataTableFiltering;
  getColumn: (columnId: string) => DataTableFilteringColumn | undefined;
  setColumnFilters: (updater: Updater<ColumnFilter[]>) => void;
}

interface DataTableFilteringColumn {
  columnDef: { meta?: { variant?: FilterVariant } };
  getFilterFn: () =>
    | {
        autoRemove?: (
          value: unknown,
          column: DataTableFilteringColumn,
        ) => boolean;
      }
    | undefined;
}

/**
 * Adds operator filters and a `joinOperator` on top of TanStack's
 * `columnFilteringFeature`, which stays the one filter state.
 *
 * `columnFilters` items may carry an `operator` (from the filter list and
 * menu). Toolbar filters set with `column.setFilterValue()` don't, and apply
 * their variant's toolbar operator through `dataTableFilterFn`, or through
 * the column's own `filterFn`.
 */
const dataTableFilteringFeature: TableFeature = {
  getInitialState: (initialState) => ({
    joinOperator: "and" as JoinOperator,
    ...initialState,
  }),
  getDefaultColumnDef: () => ({
    enableColumnFilter: false,
    filterFn: dataTableFilterFn,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataTableFiltering = {
      onJoinOperatorChange: makeStateUpdater(
        "joinOperator" as never,
        table,
      ) as unknown as OnChangeFn<JoinOperator>,
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = table as unknown as DataTableFilteringInstance;

    const resolve = (filter: ColumnFilter) =>
      resolveColumnFilter(
        filter,
        instance.getColumn(filter.id)?.columnDef.meta?.variant ?? "text",
      );

    const setJoinOperator = (updater: Updater<JoinOperator>) =>
      instance.options.onJoinOperatorChange?.((old) =>
        functionalUpdate(updater, old),
      );

    assignTableAPIs("dataTableFilteringFeature", table, {
      table_setColumnFilters: {
        fn: (updater: Updater<ColumnFilter[]>) =>
          setStateSlice(table, "columnFilters", (old: ColumnFilter[]) =>
            functionalUpdate(updater, old).filter(
              (filter) => !getShouldRemoveFilter(filter, instance),
            ),
          ),
      },
      table_getColumnFilterItems: {
        fn: () => instance.atoms.columnFilters.get().map(resolve),
        memoDeps: () => [instance.atoms.columnFilters.get()],
      },
      table_addColumnFilter: {
        fn: (filter: ColumnFilterItem) =>
          instance.setColumnFilters((old) => [...old, filter]),
      },
      table_updateColumnFilter: {
        fn: (
          filterId: string,
          updates: Partial<Omit<ColumnFilterItem, "filterId">>,
        ) =>
          instance.setColumnFilters((old) =>
            old.map((filter) => {
              const item = resolve(filter);
              return item.filterId === filterId
                ? { ...item, ...updates }
                : filter;
            }),
          ),
      },
      table_removeColumnFilter: {
        fn: (filterId: string) =>
          instance.setColumnFilters((old) =>
            old.filter((filter) => resolve(filter).filterId !== filterId),
          ),
      },
      table_getJoinOperator: {
        fn: () => instance.atoms.joinOperator.get(),
      },
      table_setJoinOperator: { fn: setJoinOperator },
      table_resetJoinOperator: {
        fn: (defaultState?: boolean) =>
          setJoinOperator(
            defaultState
              ? "and"
              : (instance.initialState.joinOperator ?? "and"),
          ),
      },
    });
  },
};

/**
 * TanStack's `autoRemove` rules for toolbar filters. Filters with an
 * `operator` are only removed by an `undefined` value, so empty drafts in the
 * filter list survive a column `filterFn` whose `autoRemove` would drop them.
 */
function getShouldRemoveFilter(
  filter: ColumnFilter,
  instance: DataTableFilteringInstance,
) {
  if (filter.value === undefined) return true;
  if (filter.operator) return false;

  const column = instance.getColumn(filter.id);
  if (!column) return false;

  const filterFn = column.getFilterFn();
  if (filterFn?.autoRemove) {
    return filterFn.autoRemove(filter.value, column);
  }
  return typeof filter.value === "string" && !filter.value;
}

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
  dataTableFilteringFeature,
  filteredRowModel: createDataTableFilteredRowModel(),
  facetedRowModel: createDataTableFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
