import {
  assignTableAPIs,
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
  FilterVariant,
  JoinOperator,
} from "@/lib/data-table-types";

import { createDataTableFilteredRowModel } from "@/lib/data-table-filters";
import { getIsSimpleFilter, toColumnFilterItem } from "@/lib/data-table-utils";

interface TableState_DataTableFiltering {
  filters: ColumnFilterItem[];
  joinOperator: JoinOperator;
}

interface TableOptions_DataTableFiltering {
  onFiltersChange?: OnChangeFn<ColumnFilterItem[]>;
  onJoinOperatorChange?: OnChangeFn<JoinOperator>;
}

interface Table_DataTableFiltering {
  getFilters: () => ColumnFilterItem[];
  setFilters: (updater: Updater<ColumnFilterItem[]>) => void;
  resetFilters: (defaultState?: boolean) => void;
  addFilter: (filter: ColumnFilterItem) => void;
  updateFilter: (
    filterId: string,
    updates: Partial<Omit<ColumnFilterItem, "filterId">>,
  ) => void;
  removeFilter: (filterId: string) => void;
  /**
   * Sets a column's toolbar filter from a toolbar value (e.g. `["todo"]` or
   * `[1, 5]`), keeping its position. An empty value removes it.
   */
  setSimpleFilter: (columnId: string, value: unknown) => void;
  getJoinOperator: () => JoinOperator;
  setJoinOperator: (updater: Updater<JoinOperator>) => void;
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
    filters: { get: () => ColumnFilterItem[] };
    joinOperator: { get: () => JoinOperator };
  };
  initialState: Partial<TableState_DataTableFiltering>;
  options: TableOptions_DataTableFiltering;
  getColumn: (
    columnId: string,
  ) => { columnDef: { meta?: { variant?: FilterVariant } } } | undefined;
}

/**
 * The one filter state of a data table: operator-based filter items joined by
 * `joinOperator`. The toolbar, filter list and filter menu all read and write
 * it, and the URL and server adapters use the same shape.
 *
 * TanStack's `columnFilters` slice stays unused; `columnFilteringFeature` is
 * only registered for `enableColumnFilter` and `column.getCanFilter()`.
 */
const dataTableFilteringFeature: TableFeature = {
  getInitialState: (initialState) => ({
    filters: [],
    joinOperator: "and" as JoinOperator,
    ...initialState,
  }),
  getDefaultTableOptions: (table) => {
    const options: TableOptions_DataTableFiltering = {
      onFiltersChange: makeStateUpdater(
        "filters" as never,
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
    const instance = table as unknown as DataTableFilteringInstance;

    const setFilters = (updater: Updater<ColumnFilterItem[]>) =>
      instance.options.onFiltersChange?.((old) =>
        functionalUpdate(updater, old),
      );

    const setJoinOperator = (updater: Updater<JoinOperator>) =>
      instance.options.onJoinOperatorChange?.((old) =>
        functionalUpdate(updater, old),
      );

    assignTableAPIs("dataTableFilteringFeature", table, {
      table_getFilters: {
        fn: () => instance.atoms.filters.get(),
      },
      table_setFilters: { fn: setFilters },
      table_resetFilters: {
        fn: (defaultState?: boolean) => {
          setFilters(defaultState ? [] : (instance.initialState.filters ?? []));
          setJoinOperator(
            defaultState
              ? "and"
              : (instance.initialState.joinOperator ?? "and"),
          );
        },
      },
      table_addFilter: {
        fn: (filter: ColumnFilterItem) => setFilters((old) => [...old, filter]),
      },
      table_updateFilter: {
        fn: (
          filterId: string,
          updates: Partial<Omit<ColumnFilterItem, "filterId">>,
        ) =>
          setFilters((old) =>
            old.map((filter) =>
              filter.filterId === filterId ? { ...filter, ...updates } : filter,
            ),
          ),
      },
      table_removeFilter: {
        fn: (filterId: string) =>
          setFilters((old) =>
            old.filter((filter) => filter.filterId !== filterId),
          ),
      },
      table_setSimpleFilter: {
        fn: (columnId: string, value: unknown) => {
          const variant =
            instance.getColumn(columnId)?.columnDef.meta?.variant ?? "text";
          const item = toColumnFilterItem(columnId, variant, value);

          setFilters((old) => {
            const index = old.findIndex(
              (filter) => filter.id === columnId && getIsSimpleFilter(filter),
            );

            if (index === -1) return item ? [...old, item] : old;
            if (!item) return old.filter((_, i) => i !== index);

            return old.map((filter, i) =>
              i === index ? { ...item, filterId: filter.filterId } : filter,
            );
          });
        },
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
  dataTableFilteringFeature,
  filteredRowModel: createDataTableFilteredRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  tableMeta: metaHelper<DataTableMeta>(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
