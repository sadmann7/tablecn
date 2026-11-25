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

import type {
  ColumnFilterItem,
  DataFetcher,
  DataQuery,
  DataResult,
  DataStatus,
  JoinOperator,
} from "@/lib/data-table-types";

import {
  announce,
  type DataTableMessages,
  defaultDataTableMessages,
  getSortingKey,
} from "@/lib/data-grid-announcer";
import {
  applyColumnConfig,
  createConfigFromInputKey,
  type DataTableConfig,
  type DataTableConfigInput,
  getConfigInputKey,
  getIsDataTableConfig,
  getUnmatchedConfigIds,
} from "@/lib/data-table-config";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  getColumnFilters,
  getColumnFiltersKey,
  sortColumnFiltersByIds,
} from "@/lib/data-table-parsers";
import {
  asFilterItems,
  getActiveFilters,
  getStatusErrorMessage,
} from "@/lib/data-table-utils";

const DEBOUNCE_MS = 300;
const EMPTY_ROWS: never[] = [];

interface FiltersDraft {
  filters: ColumnFiltersState;
  urlFiltersKey: string;
}

type InitialTableState = Partial<TableState<DataTableFeatures>>;

type StatusProps<TData extends RowData> = Pick<
  TableOptions<DataTableFeatures, TData>,
  "status" | "error" | "onRetry"
>;

interface FetchRequest {
  query: DataQuery;
  attempt: number;
}

interface FetchState<TData> {
  request: FetchRequest | null;
  result: DataResult<TData> | undefined;
  status: DataStatus;
  error: unknown;
}

type UseDataTableProps<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "data"
  | "rowCount"
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
  | "autoResetPageIndex"
  | "manualSorting"
  | "status"
  | "error"
  | "onRetry"
> &
  Pick<
    QueryStateOptions,
    "history" | "scroll" | "shallow" | "clearOnDefault" | "startTransition"
  > & {
    debounceMs?: number;
    config?: DataTableConfigInput;
    /** Overrides the screen reader announcements for sorting, result counts and load failures. */
    messages?: Partial<DataTableMessages>;
    initialState?: Omit<
      InitialTableState,
      | "columnFilters"
      | "globalFilter"
      | "sorting"
      | "pagination"
      | "joinOperator"
    >;
  } & (
    | (StatusProps<TData> & {
        mode?: "server";
        data: TableOptions<DataTableFeatures, TData>["data"];
        pageCount: number;
        rowCount?: number;
        result?: never;
        fetcher?: never;
      })
    | (StatusProps<TData> & {
        mode: "client";
        data: TableOptions<DataTableFeatures, TData>["data"];
        pageCount?: never;
        rowCount?: number;
        result?: never;
        fetcher?: never;
      })
    | (StatusProps<TData> & {
        mode?: "server";
        /** The rows and total row count for the current `query`, fetched outside the table, in place of `data` and `pageCount`. */
        result: DataResult<TData> | undefined;
        data?: never;
        pageCount?: never;
        rowCount?: never;
        fetcher?: never;
      })
    | {
        mode?: "server";
        /** Fetches the rows for each `query`, so the table owns the loading, refreshing and error states. */
        fetcher: DataFetcher<TData>;
        data?: never;
        result?: never;
        pageCount?: never;
        rowCount?: never;
        status?: never;
        error?: never;
        onRetry?: never;
      }
  );

function useDataTable<TData extends RowData>({
  config: configProp,
  columns,
  mode = "server",
  data,
  result: resultProp,
  fetcher,
  pageCount,
  rowCount,
  initialState,
  startTransition,
  history = "replace",
  debounceMs = DEBOUNCE_MS,
  clearOnDefault,
  scroll = false,
  shallow = true,
  messages,
  status: statusProp = "idle",
  error: errorProp,
  onRetry: onRetryProp,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server";
  const isResult = data === undefined;
  const { config, builtConfig } = useConfig(configProp, columns);
  const { enableGlobalFilter, pageSizeOptions, filterVariants, urlKeys } =
    config;

  const [initialTableState] = React.useState<InitialTableState>(() => ({
    ...initialState,
    sorting: config.defaultSorting,
    pagination: { pageIndex: 0, pageSize: config.defaultPageSize },
    joinOperator: config.defaultJoinOperator,
  }));

  const tableColumns = React.useMemo(
    () =>
      builtConfig
        ? columns.map((column) =>
            applyColumnConfig(column, builtConfig.columns),
          )
        : columns,
    [columns, builtConfig],
  );

  const hasInlineColumns =
    configProp !== undefined && !builtConfig && "columns" in configProp;

  const hasDataAndResult = data !== undefined && resultProp !== undefined;
  const hasFetcherAndRows =
    fetcher !== undefined && (data !== undefined || resultProp !== undefined);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (hasDataAndResult) {
      console.warn(
        "useDataTable: pass either `data` or `result`, not both. The table shows `data` and ignores `result`.",
      );
    }
    if (hasFetcherAndRows) {
      console.warn(
        "useDataTable: pass either `fetcher` or `data` and `result`, not both. The table shows `data` or `result` and doesn't fetch.",
      );
    }
    if (hasInlineColumns) {
      console.warn(
        "useDataTable: an inline config ignores `columns`. Pass the config through createDataTableConfig, or set the filter and sorting on the column defs.",
      );
    }
    if (!builtConfig) return;
    const unmatchedIds = getUnmatchedConfigIds(builtConfig.columns, columns);
    if (unmatchedIds.length === 0) return;
    console.warn(
      `useDataTable: the config has no matching column for ${unmatchedIds.map((columnId) => `"${columnId}"`).join(", ")}. Rename the config key or add the column.`,
    );
  }, [
    hasDataAndResult,
    hasFetcherAndRows,
    hasInlineColumns,
    builtConfig,
    columns,
  ]);

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
  ] = useQueryStates(config.stateParsers, queryStateOptions);
  const [filterParams, setFilterParams] = useQueryStates(
    config.filterParsers,
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

  const { filterableIds, urlFilters } = useUrlFilters(config, filterParams);
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
    if (
      nextUrlFiltersKey === urlFiltersKey &&
      getFilterColumnOrder(activeFilters) === getFilterColumnOrder(urlFilters)
    ) {
      return;
    }

    const params: Record<string, ColumnFilterItem[] | null> = {};
    for (const filter of activeFilters) {
      params[filter.id] = [...(params[filter.id] ?? []), filter];
    }
    for (const id of filterableIds) params[id] ??= null;

    const options = getUrlUpdateOptions(
      activeFilters.length < urlFilters.length,
    );
    void setFilterParams(params, options);
    void setQueryState({ page: null }, options);
  }

  const query = useStableQuery({
    sorting,
    filters: urlFilters,
    joinOperator,
    search: globalFilter,
    page: { index: pagination.pageIndex, size: pagination.pageSize },
  });

  const fetched = useFetcher(
    data === undefined && resultProp === undefined ? fetcher : undefined,
    query,
  );
  const result = fetched ? fetched.result : resultProp;
  const status = fetched ? fetched.status : statusProp;
  const error = fetched ? fetched.error : errorProp;
  const onRetry = fetched ? fetched.refetch : onRetryProp;
  const rows = data ?? result?.rows ?? EMPTY_ROWS;

  const table = useTable(
    {
      ...props,
      data: rows,
      features: dataTableFeatures,
      columns: tableColumns,
      enableGlobalFilter,
      pageSizeOptions,
      initialState: initialTableState,
      pageCount: isServer && !isResult ? pageCount : undefined,
      rowCount: isResult ? result?.rowCount : rowCount,
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
      autoResetPageIndex: false,
      manualSorting: isServer,
      manualFiltering: isServer,
      status,
      error,
      onRetry,
    },
    selectTableState,
  );

  const messagesRef = React.useRef(messages);
  React.useEffect(() => {
    messagesRef.current = messages;
  });

  const sortingKey = getSortingKey(sorting);
  const sortingKeyRef = React.useRef(sortingKey);

  React.useEffect(() => {
    if (sortingKeyRef.current === sortingKey) return;
    sortingKeyRef.current = sortingKey;

    const sorted =
      messagesRef.current?.sorted ?? defaultDataTableMessages.sorted;
    announce(
      sorted(
        sorting.map(({ id, desc }) => ({
          label: table.getColumn(id)?.columnDef.meta?.label ?? id,
          desc,
        })),
      ),
    );
  }, [sorting, sortingKey, table]);

  const resultsKey = JSON.stringify([
    urlFiltersKey,
    globalFilter,
    joinOperator,
  ]);
  const resultsRef = React.useRef({
    key: resultsKey,
    isPending: false,
    data: rows,
    status,
  });

  React.useEffect(() => {
    const prev = resultsRef.current;
    const isPending = prev.isPending || prev.key !== resultsKey;
    const hasNewData = prev.data !== rows;
    resultsRef.current = {
      key: resultsKey,
      isPending,
      data: rows,
      status,
    };

    if (status === "error") {
      if (prev.status === "error") return;
      const formatFailed =
        messagesRef.current?.failed ?? defaultDataTableMessages.failed;
      announce(formatFailed(getStatusErrorMessage(error)), {
        assertiveness: "assertive",
      });
      return;
    }
    if (status !== "idle") return;

    const hasSettled = prev.status !== "idle";
    if (!hasSettled && (!isPending || (isServer && !hasNewData))) return;
    resultsRef.current.isPending = false;

    const pageCount = table.getPageCount();
    const rowCount =
      table.options.rowCount ??
      (!isServer || pageCount <= 1 ? table.getRowCount() : null);
    const formatResults =
      messagesRef.current?.results ?? defaultDataTableMessages.results;
    announce(formatResults({ rowCount, pageCount }));
  }, [resultsKey, rows, status, error, isServer, table]);

  return { table, query, status, error, refetch: onRetry ?? noop };
}

interface UseDataTableQueryProps<TData extends RowData> {
  config?: DataTableConfigInput;
  columns?: TableOptions<DataTableFeatures, TData>["columns"];
}

/** Reads the current `DataQuery` from the URL, so it can be fetched before the table is created with its `result`. */
function useDataTableQuery<TData extends RowData>({
  config: configProp,
  columns = [],
}: UseDataTableQueryProps<TData>): DataQuery {
  const { config } = useConfig(configProp, columns);
  const queryStateOptions = { urlKeys: config.urlKeys };
  const [{ page, perPage, sort, joinOperator, search }] = useQueryStates(
    config.stateParsers,
    queryStateOptions,
  );
  const [filterParams] = useQueryStates(
    config.filterParsers,
    queryStateOptions,
  );
  const { urlFilters } = useUrlFilters(config, filterParams);

  return useStableQuery({
    sorting: sort,
    filters: urlFilters,
    joinOperator,
    search: config.enableGlobalFilter ? search : "",
    page: { index: page - 1, size: perPage },
  });
}

function useFetcher<TData>(
  fetcher: DataFetcher<TData> | undefined,
  query: DataQuery,
) {
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<FetchState<TData>>({
    request: null,
    result: undefined,
    status: "loading",
    error: undefined,
  });
  const fetcherRef = React.useRef(fetcher);
  const requestIdRef = React.useRef(0);
  const isEnabled = fetcher !== undefined;

  React.useEffect(() => {
    fetcherRef.current = fetcher;
  });

  React.useEffect(() => {
    const fetchRows = fetcherRef.current;
    if (!isEnabled || !fetchRows) return;

    const request = { query, attempt };
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    function getIsCurrent() {
      return !controller.signal.aborted && requestId === requestIdRef.current;
    }

    fetchRows(query, { signal: controller.signal }).then(
      (result) => {
        if (!getIsCurrent()) return;
        setState({ request, result, status: "idle", error: undefined });
      },
      (error: unknown) => {
        if (!getIsCurrent()) return;
        setState({ request, result: undefined, status: "error", error });
      },
    );

    return () => controller.abort();
  }, [isEnabled, query, attempt]);

  const refetch = React.useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  if (!isEnabled) return null;

  const isSettled =
    state.request?.query === query && state.request.attempt === attempt;

  return {
    result: state.result,
    status: isSettled
      ? state.status
      : state.result
        ? ("refreshing" as const)
        : ("loading" as const),
    error: isSettled ? state.error : undefined,
    refetch,
  };
}

function useConfig<TData extends RowData>(
  configProp: DataTableConfigInput | undefined,
  columns: TableOptions<DataTableFeatures, TData>["columns"],
) {
  const builtConfig = getIsDataTableConfig(configProp) ? configProp : undefined;
  const configInputKey = builtConfig
    ? ""
    : getConfigInputKey(columns, configProp);
  const config = React.useMemo(
    () => builtConfig ?? createConfigFromInputKey(configInputKey),
    [builtConfig, configInputKey],
  );

  return { config, builtConfig };
}

function useUrlFilters(
  {
    filterVariants,
    urlKeys,
  }: Pick<DataTableConfig, "filterVariants" | "urlKeys">,
  filterParams: Partial<Record<string, unknown>>,
) {
  const filterableIds = React.useMemo(
    () => Object.keys(filterVariants),
    [filterVariants],
  );

  const locationSearch = React.useSyncExternalStore(
    subscribeToHistory,
    getLocationSearch,
    getServerLocationSearch,
  );

  const filterOrderKey = React.useMemo(() => {
    const idsByUrlKey = new Map(filterableIds.map((id) => [urlKeys[id], id]));
    const urlKeyOrder = new Set(new URLSearchParams(locationSearch).keys());
    return JSON.stringify(
      [...urlKeyOrder].flatMap((key) => idsByUrlKey.get(key) ?? []),
    );
  }, [filterableIds, urlKeys, locationSearch]);

  const urlFilters = React.useMemo(
    () =>
      sortColumnFiltersByIds(
        getColumnFilters(filterableIds, filterParams),
        JSON.parse(filterOrderKey),
      ),
    [filterableIds, filterParams, filterOrderKey],
  );

  return { filterableIds, urlFilters };
}

function useStableQuery(query: DataQuery) {
  const queryKey = JSON.stringify(query);
  return React.useMemo<DataQuery>(() => JSON.parse(queryKey), [queryKey]);
}

function noop() {}

function subscribeToHistory(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function getLocationSearch() {
  return window.location.search;
}

function getServerLocationSearch() {
  return "";
}

function getFilterColumnOrder(filters: ColumnFilterItem[]) {
  return JSON.stringify([...new Set(filters.map((filter) => filter.id))]);
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

export {
  useDataTable,
  type UseDataTableProps,
  useDataTableQuery,
  type UseDataTableQueryProps,
};
