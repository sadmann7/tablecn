import {
  type ColumnFiltersState,
  functionalUpdate,
  type PaginationState,
  type RowData,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  useTable,
} from "@tanstack/react-table";
import {
  debounce,
  type Options as QueryStateOptions,
  useQueryStates,
} from "nuqs";
import * as React from "react";

import type { ColumnFilterItem, JoinOperator } from "@/lib/data-table-types";

import {
  applyColumnConfig,
  createDataTableConfig,
  type DataTableConfig,
  getColumnConfigs,
  getUnmatchedConfigIds,
} from "@/lib/data-table-config";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  getColumnFilters,
  getColumnFiltersKey,
} from "@/lib/data-table-parsers";
import { asFilterItems, getActiveFilters } from "@/lib/data-table-utils";

const DEBOUNCE_MS = 300;

interface FiltersDraft {
  filters: ColumnFiltersState;
  urlFiltersKey: string;
}

type InitialTableState = Partial<TableState<DataTableFeatures>>;

type UseDataTableProps<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "onPaginationChange"
  | "onSortingChange"
  | "onColumnFiltersChange"
  | "onGlobalFilterChange"
  | "onJoinOperatorChange"
  | "pageCount"
  | "features"
  | "initialState"
  | "enableGlobalFilter"
  | "pageSizeOptions"
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
> &
  Pick<
    QueryStateOptions,
    "history" | "scroll" | "shallow" | "clearOnDefault" | "startTransition"
  > & {
    debounceMs?: number;
    config?: Omit<DataTableConfig, "parse">;
    initialState?: Omit<
      InitialTableState,
      | "columnFilters"
      | "globalFilter"
      | "sorting"
      | "pagination"
      | "joinOperator"
    >;
  } & (
    | {
        mode?: "server";
        pageCount: number;
      }
    | {
        mode: "client";
        pageCount?: never;
      }
  );

function useDataTable<TData extends RowData>({
  config: configProp,
  columns,
  mode = "server",
  pageCount,
  initialState,
  startTransition,
  history = "replace",
  debounceMs = DEBOUNCE_MS,
  clearOnDefault,
  scroll = false,
  shallow = true,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server";
  const columnConfigs = getColumnConfigs(columns);
  const columnConfigsKey = JSON.stringify(columnConfigs);
  const config = React.useMemo(
    () => configProp ?? createDataTableConfig({ columns: columnConfigs }),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `columnConfigsKey` rebuilds the config only when the column configs change by value
    [configProp, columnConfigsKey],
  );
  const { enableGlobalFilter, pageSizeOptions, filterVariants, urlKeys } =
    config;

  const queryParsers = React.useMemo(() => {
    const { page, perPage, sort, joinOperator, search, ...filters } =
      config.parsers;
    return { state: { page, perPage, sort, joinOperator, search }, filters };
  }, [config]);

  const [initialTableState] = React.useState<InitialTableState>(() => ({
    ...initialState,
    sorting: config.defaultSorting,
    pagination: { pageIndex: 0, pageSize: config.defaultPageSize },
    joinOperator: config.defaultJoinOperator,
  }));

  const tableColumns = React.useMemo(
    () =>
      configProp
        ? columns.map((column) => applyColumnConfig(column, configProp.columns))
        : columns,
    [columns, configProp],
  );

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || !configProp) return;
    const unmatchedIds = getUnmatchedConfigIds(configProp.columns, columns);
    if (unmatchedIds.length === 0) return;
    console.warn(
      `useDataTable: the config has no matching column for ${unmatchedIds.map((columnId) => `"${columnId}"`).join(", ")}. Rename the config key or add the column.`,
    );
  }, [configProp, columns]);

  const filterableIds = React.useMemo(
    () => Object.keys(filterVariants),
    [filterVariants],
  );

  const queryStateOptions = {
    urlKeys,
    history,
    scroll,
    shallow: isServer ? shallow : true,
    clearOnDefault,
    startTransition,
  };
  const shouldDebounce = isServer && !shallow;

  function getUrlUpdateOptions(isClearing: boolean) {
    return shouldDebounce && !isClearing
      ? { limitUrlUpdates: debounce(debounceMs) }
      : undefined;
  }

  const [
    { page, perPage, sort: sorting, joinOperator, search },
    setQueryState,
  ] = useQueryStates(queryParsers.state, queryStateOptions);
  const [filterParams, setFilterParams] = useQueryStates(
    queryParsers.filters,
    queryStateOptions,
  );

  const pagination = React.useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize: perPage }),
    [page, perPage],
  );

  const getNextPagination = useChainedUpdate(pagination);

  function onPaginationChange(updater: Updater<PaginationState>) {
    const next = getNextPagination(updater);
    if (next.pageIndex !== pagination.pageIndex) {
      void setQueryState({ page: next.pageIndex + 1 });
    }
    if (next.pageSize !== pagination.pageSize) {
      void setQueryState({ perPage: next.pageSize });
    }
  }

  const getNextSorting = useChainedUpdate(sorting);

  function onSortingChange(updater: Updater<SortingState>) {
    const next = getNextSorting(updater);
    if (JSON.stringify(next) === JSON.stringify(sorting)) return;
    void setQueryState({ sort: next, page: null });
  }

  const getNextJoinOperator = useChainedUpdate(joinOperator);

  function onJoinOperatorChange(updater: Updater<JoinOperator>) {
    const next = getNextJoinOperator(updater);
    if (next === joinOperator) return;
    void setQueryState({ joinOperator: next, page: null });
  }

  const globalFilter = enableGlobalFilter ? search : "";
  const getNextGlobalFilter = useChainedUpdate<unknown>(globalFilter);

  function onGlobalFilterChange(updater: Updater<unknown>) {
    if (!enableGlobalFilter) return;
    const value = getGlobalFilterValue(getNextGlobalFilter(updater));
    if (value === search) return;
    void setQueryState(
      { search: value, page: null },
      getUrlUpdateOptions(value === ""),
    );
  }

  const urlFilters = React.useMemo(
    () => getColumnFilters(filterableIds, filterParams),
    [filterableIds, filterParams],
  );
  const urlFiltersKey = getColumnFiltersKey(urlFilters);

  const [filtersDraft, setFiltersDraft] = React.useState<FiltersDraft | null>(
    null,
  );
  const columnFilters =
    filtersDraft?.urlFiltersKey === urlFiltersKey
      ? filtersDraft.filters
      : urlFilters;

  const getNextColumnFilters = useChainedUpdate(columnFilters);

  function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
    const filters = getNextColumnFilters(updater);
    const activeFilters = getActiveFilters(asFilterItems(filters)).filter(
      (filter) => Object.hasOwn(filterVariants, filter.id),
    );
    const nextUrlFiltersKey = getColumnFiltersKey(activeFilters);

    setFiltersDraft({ filters, urlFiltersKey: nextUrlFiltersKey });
    if (nextUrlFiltersKey === urlFiltersKey) return;

    const params: Record<string, ColumnFilterItem[] | null> = {};
    for (const id of filterableIds) params[id] = null;
    for (const filter of activeFilters) {
      params[filter.id] = [...(params[filter.id] ?? []), filter];
    }

    const options = getUrlUpdateOptions(
      activeFilters.length < urlFilters.length,
    );
    void setFilterParams(params, options);
    void setQueryState({ page: null }, options);
  }

  const table = useTable(
    {
      ...props,
      features: dataTableFeatures,
      columns: tableColumns,
      enableGlobalFilter,
      pageSizeOptions,
      initialState: initialTableState,
      pageCount: isServer ? pageCount : undefined,
      state: {
        pagination,
        sorting,
        columnFilters,
        joinOperator,
        globalFilter,
      },
      onPaginationChange,
      onSortingChange,
      onColumnFiltersChange,
      onJoinOperatorChange,
      onGlobalFilterChange,
      manualPagination: isServer,
      manualSorting: isServer,
      manualFiltering: isServer,
    },
    selectTableState,
  );

  return { table };
}

function getGlobalFilterValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function selectTableState(state: TableState<DataTableFeatures>) {
  return {
    columnFilters: state.columnFilters,
    globalFilter: state.globalFilter,
    joinOperator: state.joinOperator,
    pagination: state.pagination,
    sorting: state.sorting,
  };
}

function useChainedUpdate<TValue>(value: TValue) {
  const pendingRef = React.useRef<{ base: TValue; next: TValue } | null>(null);

  return (updater: Updater<TValue>) => {
    const pending = pendingRef.current;
    const next = functionalUpdate(
      updater,
      pending?.base === value ? pending.next : value,
    );
    pendingRef.current = { base: value, next };
    return next;
  };
}

export { useDataTable, type UseDataTableProps };
