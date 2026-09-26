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
  createPaginatedRowModel,
  createSortedRowModel,
  functionalUpdate,
  makeStateUpdater,
  metaHelper,
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
  DataTableMeta,
  JoinOperator,
} from "@/lib/data-table-types";

import { createDataTableFilteredRowModel } from "@/lib/data-table-filters";

interface TableState_AdvancedFiltering {
  advancedFilters: ColumnFilterItem[];
  joinOperator: JoinOperator;
}

interface TableOptions_AdvancedFiltering {
  onAdvancedFiltersChange?: OnChangeFn<ColumnFilterItem[]>;
  onJoinOperatorChange?: OnChangeFn<JoinOperator>;
  /**
   * Skip client-side evaluation of `advancedFilters`. Set this when the
   * server already applied them.
   */
  manualAdvancedFiltering?: boolean;
}

interface Table_AdvancedFiltering {
  getAdvancedFilters: () => ColumnFilterItem[];
  setAdvancedFilters: (updater: Updater<ColumnFilterItem[]>) => void;
  resetAdvancedFilters: (defaultState?: boolean) => void;
  addAdvancedFilter: (filter: ColumnFilterItem) => void;
  updateAdvancedFilter: (
    filterId: string,
    updates: Partial<Omit<ColumnFilterItem, "filterId">>,
  ) => void;
  removeAdvancedFilter: (filterId: string) => void;
  getJoinOperator: () => JoinOperator;
  setJoinOperator: (updater: Updater<JoinOperator>) => void;
}

declare module "@tanstack/react-table" {
  interface Plugins {
    advancedFilteringFeature: TableFeature;
  }

  interface TableState_FeatureMap {
    advancedFilteringFeature: TableState_AdvancedFiltering;
  }

  interface TableOptions_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    advancedFilteringFeature: TableOptions_AdvancedFiltering;
  }

  interface Table_FeatureMap<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
  > {
    advancedFilteringFeature: Table_AdvancedFiltering;
  }
}

interface AdvancedFilteringInstance {
  atoms: {
    advancedFilters: { get: () => ColumnFilterItem[] };
    joinOperator: { get: () => JoinOperator };
  };
  initialState: Partial<TableState_AdvancedFiltering>;
  options: TableOptions_AdvancedFiltering;
}

/**
 * Operator-based filters (`where status is not done and title contains x`)
 * as a table state slice, so filter UIs, URL sync and client-side filtering
 * all read and write the same state.
 */
const advancedFilteringFeature: TableFeature = {
  getInitialState: (initialState) => ({
    advancedFilters: [],
    joinOperator: "and" as JoinOperator,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_AdvancedFiltering = {
      onAdvancedFiltersChange: makeStateUpdater(
        "advancedFilters" as never,
        table,
      ) as unknown as OnChangeFn<ColumnFilterItem[]>,
      onJoinOperatorChange: makeStateUpdater(
        "joinOperator" as never,
        table,
      ) as unknown as OnChangeFn<JoinOperator>,
    };
    return options;
  },
  constructTableAPIs: (table) => {
    const instance = table as unknown as AdvancedFilteringInstance;

    const setAdvancedFilters = (updater: Updater<ColumnFilterItem[]>) =>
      instance.options.onAdvancedFiltersChange?.((old) =>
        functionalUpdate(updater, old),
      );

    const setJoinOperator = (updater: Updater<JoinOperator>) =>
      instance.options.onJoinOperatorChange?.((old) =>
        functionalUpdate(updater, old),
      );

    assignTableAPIs("advancedFilteringFeature", table, {
      table_getAdvancedFilters: {
        fn: () => instance.atoms.advancedFilters.get(),
      },
      table_setAdvancedFilters: { fn: setAdvancedFilters },
      table_resetAdvancedFilters: {
        fn: (defaultState?: boolean) => {
          setAdvancedFilters(
            defaultState ? [] : (instance.initialState.advancedFilters ?? []),
          );
          setJoinOperator(
            defaultState
              ? "and"
              : (instance.initialState.joinOperator ?? "and"),
          );
        },
      },
      table_addAdvancedFilter: {
        fn: (filter: ColumnFilterItem) =>
          setAdvancedFilters((old) => [...old, filter]),
      },
      table_updateAdvancedFilter: {
        fn: (
          filterId: string,
          updates: Partial<Omit<ColumnFilterItem, "filterId">>,
        ) =>
          setAdvancedFilters((old) =>
            old.map((filter) =>
              filter.filterId === filterId ? { ...filter, ...updates } : filter,
            ),
          ),
      },
      table_removeAdvancedFilter: {
        fn: (filterId: string) =>
          setAdvancedFilters((old) =>
            old.filter((filter) => filter.filterId !== filterId),
          ),
      },
      table_getJoinOperator: {
        fn: () => instance.atoms.joinOperator.get(),
      },
      table_setJoinOperator: { fn: setJoinOperator },
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
  advancedFilteringFeature,
  filteredRowModel: createDataTableFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  tableMeta: metaHelper<DataTableMeta>(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
