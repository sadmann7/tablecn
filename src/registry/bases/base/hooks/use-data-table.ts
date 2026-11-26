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
  DataLoadMoreStatus,
  DataQuery,
  DataResult,
  DataStatus,
  JoinOperator,
} from "@/lib/data-table-types";

import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
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
  normalizeColumnFilters,
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
  filtersKey: string;
}

type QueryPatch = Partial<Omit<DataQuery, "page">> & {
  page?: Partial<DataQuery["page"]>;
};

interface QueryUpdateOptions {
  resetsPage?: boolean;
  isDebounced?: boolean;
  isClearing?: boolean;
}

interface QueryStore {
  query: DataQuery;
  setQuery: (patch: QueryPatch, options?: QueryUpdateOptions) => void;
}

interface QueryStoreOptions {
  config: Omit<DataTableConfig, "parse">;
  query: DataQuery | undefined;
  onQueryChange: ((query: DataQuery) => void) | undefined;
  urlOptions: Partial<QueryStateOptions> & {
    urlKeys: DataTableConfig["urlKeys"];
  };
  debounceMs: number | undefined;
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

interface LoadMoreState {
  request: FetchRequest;
  status: Exclude<DataLoadMoreStatus, "idle">;
  error: unknown;
}

interface LoadMoreRequest {
  controller: AbortController;
}

interface FetchState<TData> {
  attempt: number;
  request: FetchRequest | null;
  result: DataResult<TData> | undefined;
  status: DataStatus;
  error: unknown;
  more: LoadMoreState | null;
}

type FetchAction<TData> =
  | { type: "retry" }
  | { type: "settle"; request: FetchRequest; result: DataResult<TData> }
  | { type: "fail"; request: FetchRequest; error: unknown }
  | { type: "loadMoreStart"; request: FetchRequest }
  | { type: "loadMoreFail"; request: FetchRequest; error: unknown };

const INITIAL_FETCH_STATE: FetchState<never> = {
  attempt: 0,
  request: null,
  result: undefined,
  status: "loading",
  error: undefined,
  more: null,
};

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
    /** The sorting, filters, join operator, search and page, held by the app instead of the URL, so the table needs no nuqs adapter. */
    query?: DataQuery;
    /** Runs with the next query when the table changes a controlled `query`. */
    onQueryChange?: (query: DataQuery) => void;
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
        pagination?: never;
      })
    | (StatusProps<TData> & {
        mode: "client";
        data: TableOptions<DataTableFeatures, TData>["data"];
        pageCount?: never;
        rowCount?: number;
        result?: never;
        fetcher?: never;
        pagination?: never;
      })
    | (StatusProps<TData> & {
        mode?: "server";
        /** The rows and total row count for the current `query`, fetched outside the table, in place of `data` and `pageCount`. */
        result: DataResult<TData> | undefined;
        data?: never;
        pageCount?: never;
        rowCount?: never;
        fetcher?: never;
        pagination?: never;
      })
    | {
        mode?: "server";
        /** Fetches the rows for each `query`, so the table owns the loading, refreshing and error states. */
        fetcher: DataFetcher<TData>;
        /** Pages by `page` with a pager, or by `cursor` with a Load more row that appends each page. */
        pagination?: "offset" | "cursor";
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
  pagination: paginationMode = "offset",
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
  query: queryProp,
  onQueryChange,
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

  const [isControlled] = React.useState(queryProp !== undefined);
  const hasSwitchedControl = isControlled !== (queryProp !== undefined);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || !hasSwitchedControl) return;
    console.warn(
      "useDataTable: `query` switched between set and unset. The table keeps the mode it mounted with, so pass `query` on every render or never.",
    );
  }, [hasSwitchedControl]);

  const { query: storedQuery, setQuery } = useQueryStore(isControlled, {
    config,
    query: queryProp,
    onQueryChange,
    urlOptions: {
      urlKeys,
      history,
      scroll,
      shallow: isServer ? shallow : true,
      clearOnDefault,
      startTransition,
    },
    debounceMs: isServer && !shallow ? debounceMs : undefined,
  });
  const isCursor = paginationMode === "cursor" && fetcher !== undefined;
  const query = useStableQuery(
    isCursor
      ? { ...storedQuery, page: { index: 0, size: storedQuery.page.size } }
      : storedQuery,
  );
  const { sorting, joinOperator } = query;

  const lastPageIndex =
    isServer && pageCount !== undefined && pageCount >= 0
      ? Math.max(pageCount, 1) - 1
      : Number.POSITIVE_INFINITY;
  const pageIndex = Math.min(query.page.index, lastPageIndex);

  const pagination = React.useMemo<PaginationState>(
    () => ({ pageIndex, pageSize: query.page.size }),
    [pageIndex, query.page.size],
  );

  const setQueryRef = React.useRef(setQuery);
  useIsomorphicLayoutEffect(() => {
    setQueryRef.current = setQuery;
  });

  React.useEffect(() => {
    if (query.page.index === pageIndex) return;
    setQueryRef.current({ page: { index: pageIndex } });
  }, [query.page.index, pageIndex]);

  const getNextPagination = useChainedUpdate(pagination);

  function onPaginationChange(updater: Updater<PaginationState>) {
    const next = getNextPagination(updater);
    if (
      next.pageIndex === pagination.pageIndex &&
      next.pageSize === pagination.pageSize
    ) {
      return;
    }
    setQuery({
      page: {
        index:
          next.pageIndex === pagination.pageIndex ? undefined : next.pageIndex,
        size: next.pageSize === pagination.pageSize ? undefined : next.pageSize,
      },
    });
  }

  const getNextSorting = useChainedUpdate(sorting);

  function onSortingChange(updater: Updater<SortingState>) {
    const next = getNextSorting(updater);
    if (JSON.stringify(next) === JSON.stringify(sorting)) return;
    setQuery({ sorting: next }, { resetsPage: true });
  }

  const getNextJoinOperator = useChainedUpdate(joinOperator);

  function onJoinOperatorChange(updater: Updater<JoinOperator>) {
    const next = getNextJoinOperator(updater);
    if (next === joinOperator) return;
    setQuery({ joinOperator: next }, { resetsPage: true });
  }

  const globalFilter = enableGlobalFilter ? query.search : "";
  const getNextGlobalFilter = useChainedUpdate<unknown>(globalFilter);

  function onGlobalFilterChange(updater: Updater<unknown>) {
    if (!enableGlobalFilter) return;
    const value = getGlobalFilterValue(getNextGlobalFilter(updater));
    if (value === query.search) return;
    setQuery(
      { search: value },
      { resetsPage: true, isDebounced: true, isClearing: value === "" },
    );
  }

  const queryFilters = query.filters;
  const filtersKey = getColumnFiltersKey(queryFilters);

  const [filtersDraft, setFiltersDraft] = React.useState<FiltersDraft | null>(
    null,
  );
  const columnFilters =
    filtersDraft?.filtersKey === filtersKey
      ? filtersDraft.filters
      : queryFilters;

  const getNextColumnFilters = useChainedUpdate(columnFilters);

  function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
    const filters = getNextColumnFilters(updater);
    const activeFilters = getActiveFilters(asFilterItems(filters)).filter(
      (filter) => Object.hasOwn(filterVariants, filter.id),
    );
    const nextFiltersKey = getColumnFiltersKey(activeFilters);

    setFiltersDraft({ filters, filtersKey: nextFiltersKey });
    if (
      nextFiltersKey === filtersKey &&
      getFilterColumnOrder(activeFilters) === getFilterColumnOrder(queryFilters)
    ) {
      return;
    }

    setQuery(
      { filters: activeFilters },
      {
        resetsPage: true,
        isDebounced: true,
        isClearing: activeFilters.length < queryFilters.length,
      },
    );
  }

  const messagesRef = React.useRef(messages);
  useIsomorphicLayoutEffect(() => {
    messagesRef.current = messages;
  });

  const fetched = useFetcher(
    data === undefined && resultProp === undefined ? fetcher : undefined,
    query,
    isCursor,
    messagesRef,
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
      loadMore: fetched?.loadMore,
    },
    selectTableState,
  );

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

  const resultsKey = JSON.stringify([filtersKey, globalFilter, joinOperator]);
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

  return {
    table,
    query,
    status,
    error,
    refetch: onRetry ?? noop,
    loadMore: fetched?.loadMore,
  };
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
  const { query } = useUrlQueryStore({
    config,
    query: undefined,
    onQueryChange: undefined,
    urlOptions: { urlKeys: config.urlKeys },
    debounceMs: undefined,
  });
  return query;
}

function useQueryStore(
  isControlled: boolean,
  options: QueryStoreOptions,
): QueryStore {
  // oxlint-disable-next-line react/rules-of-hooks -- `isControlled` is fixed at mount, so the same hooks run on every render.
  return (isControlled ? useControlledQueryStore : useUrlQueryStore)(options);
}

function useControlledQueryStore({
  query: queryProp,
  onQueryChange,
  config,
}: QueryStoreOptions): QueryStore {
  const query = useStableQuery(queryProp ?? config.defaultQuery);
  const pendingRef = React.useRef<{ base: DataQuery; next: DataQuery } | null>(
    null,
  );

  function setQuery(patch: QueryPatch, options: QueryUpdateOptions = {}) {
    const pending = pendingRef.current;
    const base = pending?.base === query ? pending.next : query;
    const next = mergeQuery(
      base,
      patch.filters
        ? {
            ...patch,
            filters: normalizeColumnFilters(
              patch.filters,
              config.filterVariants,
            ),
          }
        : patch,
      options,
    );
    pendingRef.current = { base: query, next };
    onQueryChange?.(next);
  }

  return { query, setQuery };
}

function useUrlQueryStore({
  config,
  urlOptions,
  debounceMs,
}: QueryStoreOptions): QueryStore {
  const [{ page, perPage, sort, joinOperator, search }, setQueryState] =
    useQueryStates(config.stateParsers, urlOptions);
  const [filterParams, setFilterParams] = useQueryStates(
    config.filterParsers,
    urlOptions,
  );
  const { filterableIds, urlFilters } = useUrlFilters(config, filterParams);

  const query = useStableQuery({
    sorting: sort,
    filters: urlFilters,
    joinOperator,
    search: config.enableGlobalFilter ? search : "",
    page: { index: page - 1, size: perPage },
  });

  function setQuery(patch: QueryPatch, options: QueryUpdateOptions = {}) {
    const updateOptions =
      options.isDebounced && debounceMs !== undefined && !options.isClearing
        ? { limitUrlUpdates: debounce(debounceMs) }
        : undefined;

    if (patch.filters) {
      const params: Record<string, ColumnFilterItem[] | null> = {};
      for (const filter of patch.filters) {
        params[filter.id] = [...(params[filter.id] ?? []), filter];
      }
      for (const id of filterableIds) params[id] ??= null;
      void setFilterParams(params, updateOptions);
    }

    const pageIndex = patch.page?.index;
    void setQueryState(
      {
        sort: patch.sorting,
        joinOperator: patch.joinOperator,
        search: patch.search,
        page: options.resetsPage
          ? null
          : pageIndex === undefined
            ? undefined
            : pageIndex + 1,
        perPage: patch.page?.size,
      },
      updateOptions,
    );
  }

  return { query, setQuery };
}

function useFetcher<TData>(
  fetcher: DataFetcher<TData> | undefined,
  query: DataQuery,
  isCursor: boolean,
  messagesRef: React.RefObject<Partial<DataTableMessages> | undefined>,
) {
  const [state, dispatch] = React.useReducer(
    fetchReducer<TData>,
    INITIAL_FETCH_STATE,
  );
  const fetcherRef = React.useRef(fetcher);
  const queryRef = React.useRef(query);
  const stateRef = React.useRef(state);
  const requestIdRef = React.useRef(0);
  const moreRequestRef = React.useRef<LoadMoreRequest | null>(null);
  const isEnabled = fetcher !== undefined;
  const { attempt } = state;

  useIsomorphicLayoutEffect(() => {
    fetcherRef.current = fetcher;
    queryRef.current = query;
    stateRef.current = state;
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

    new Promise<DataResult<TData>>((resolve) => {
      resolve(fetchRows(query, { signal: controller.signal }));
    }).then(
      (result) => {
        if (getIsCurrent()) dispatch({ type: "settle", request, result });
      },
      (error: unknown) => {
        if (getIsCurrent()) dispatch({ type: "fail", request, error });
      },
    );

    return () => {
      controller.abort();
      moreRequestRef.current?.controller.abort();
      moreRequestRef.current = null;
    };
  }, [isEnabled, query, attempt]);

  const refetch = React.useCallback(() => dispatch({ type: "retry" }), []);

  const loadMore = React.useCallback(() => {
    const fetchRows = fetcherRef.current;
    const { request, result } = stateRef.current;
    const nextCursor = getIsSettled(stateRef.current, queryRef.current)
      ? result?.nextCursor
      : undefined;
    if (!fetchRows || !request || !result || !nextCursor) return;
    if (moreRequestRef.current) return;

    const controller = new AbortController();
    const moreRequest = { controller };
    moreRequestRef.current = moreRequest;
    dispatch({ type: "loadMoreStart", request });

    function getIsCurrent() {
      return (
        !controller.signal.aborted && moreRequestRef.current === moreRequest
      );
    }

    new Promise<DataResult<TData>>((resolve) => {
      resolve(
        fetchRows(
          { ...request.query, cursor: nextCursor },
          { signal: controller.signal },
        ),
      );
    }).then(
      (page) => {
        if (!getIsCurrent()) return;
        moreRequestRef.current = null;
        const rows = [...result.rows, ...page.rows];
        const rowCount = page.rowCount ?? result.rowCount;
        dispatch({
          type: "settle",
          request,
          result: { rows, rowCount, nextCursor: page.nextCursor ?? null },
        });

        const loadedMore =
          messagesRef.current?.loadedMore ??
          defaultDataTableMessages.loadedMore;
        announce(
          loadedMore({
            count: page.rows.length,
            loadedCount: rows.length,
            rowCount: rowCount ?? null,
          }),
        );
      },
      (error: unknown) => {
        if (!getIsCurrent()) return;
        moreRequestRef.current = null;
        dispatch({ type: "loadMoreFail", request, error });

        const loadMoreFailed =
          messagesRef.current?.loadMoreFailed ??
          defaultDataTableMessages.loadMoreFailed;
        announce(loadMoreFailed(getStatusErrorMessage(error)), {
          assertiveness: "assertive",
        });
      },
    );
  }, [messagesRef]);

  const isSettled = getIsSettled(state, query);
  const moreStatus: DataLoadMoreStatus =
    isSettled && state.more?.request === state.request
      ? state.more.status
      : "idle";
  const moreError = moreStatus === "error" ? state.more?.error : undefined;
  const hasMore = Boolean(isSettled && state.result?.nextCursor);

  const loadMoreState = React.useMemo(
    () =>
      isCursor
        ? {
            hasMore,
            status: moreStatus,
            error: moreError,
            onLoadMore: loadMore,
          }
        : undefined,
    [isCursor, hasMore, moreStatus, moreError, loadMore],
  );

  if (!isEnabled) return null;

  return {
    result: state.result,
    status: isSettled
      ? state.status
      : state.result
        ? ("refreshing" as const)
        : ("loading" as const),
    error: isSettled ? state.error : undefined,
    refetch,
    loadMore: loadMoreState,
  };
}

function fetchReducer<TData>(
  state: FetchState<TData>,
  action: FetchAction<TData>,
): FetchState<TData> {
  switch (action.type) {
    case "retry":
      return { ...state, attempt: state.attempt + 1 };
    case "settle":
      return {
        ...state,
        request: action.request,
        result: action.result,
        status: "idle",
        error: undefined,
        more: null,
      };
    case "fail":
      return {
        ...state,
        request: action.request,
        result: undefined,
        status: "error",
        error: action.error,
        more: null,
      };
    case "loadMoreStart":
      return {
        ...state,
        more: { request: action.request, status: "loading", error: undefined },
      };
    case "loadMoreFail":
      return {
        ...state,
        more: { request: action.request, status: "error", error: action.error },
      };
  }
}

function getIsSettled<TData>(state: FetchState<TData>, query: DataQuery) {
  return (
    state.request?.query === query && state.request.attempt === state.attempt
  );
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

function useStableQuery({
  joinOperator,
  search,
  ...query
}: DataQuery): DataQuery {
  const sorting = useStableValue(query.sorting);
  const filters = useStableValue(query.filters);
  const page = useStableValue(query.page);
  return React.useMemo(
    () => ({ sorting, filters, joinOperator, search, page }),
    [sorting, filters, joinOperator, search, page],
  );
}

function useStableValue<TValue>(value: TValue): TValue {
  const key = JSON.stringify(value);
  return React.useMemo(() => JSON.parse(key), [key]);
}

function mergeQuery(
  query: DataQuery,
  patch: QueryPatch,
  { resetsPage }: QueryUpdateOptions,
): DataQuery {
  const { page, ...rest } = patch;
  return {
    ...query,
    ...rest,
    page: {
      index: resetsPage ? 0 : (page?.index ?? query.page.index),
      size: page?.size ?? query.page.size,
    },
  };
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
