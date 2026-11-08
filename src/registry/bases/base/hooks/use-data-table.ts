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
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryState,
  type UseQueryStateOptions,
  useQueryStates,
} from "nuqs";
import * as React from "react";

import type {
  ColumnFilterItem,
  FilterVariant,
  JoinOperator,
} from "@/lib/data-table-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  type DataTableQueryKeyOptions,
  getColumnFilterParser,
  getColumnFilters,
  getColumnFiltersKey,
  getSortingStateParser,
  getUrlKeys,
  sortColumnFiltersBySearch,
} from "@/lib/data-table-parsers";
import {
  getActiveFilters,
  getColumnId,
  getFilterVariant,
  JOIN_OPERATORS,
  normalizeColumnFilter,
} from "@/lib/data-table-utils";

const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;
const DEFAULT_PAGE_SIZE = 10;
const EMPTY_SORTING: SortingState = [];

interface FiltersDraft {
  filters: ColumnFiltersState;
  urlFiltersKey: string;
  pageToReset: number | null;
}

interface GlobalFilterDraft {
  value: string;
  urlValue: string;
  pageToReset: number | null;
}

type UseDataTableProps<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "pageCount"
  | "features"
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
> &
  DataTableQueryKeyOptions & {
    startTransition?: React.TransitionStartFunction;
    history?: "push" | "replace";
    debounceMs?: number;
    throttleMs?: number;
    clearOnDefault?: boolean;
    scroll?: boolean;
    shallow?: boolean;
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
  columns,
  mode = "server",
  pageCount,
  initialState,
  startTransition,
  queryKeys,
  queryKeyPrefix,
  history = "replace",
  debounceMs = DEBOUNCE_MS,
  throttleMs = THROTTLE_MS,
  clearOnDefault = false,
  scroll = false,
  shallow: shallowProp = true,
  enableGlobalFilter = true,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server";
  const shallow = isServer ? shallowProp : true;

  const queryStateOptions = React.useMemo<
    Omit<UseQueryStateOptions<string>, "parse">
  >(
    () => ({
      history,
      scroll,
      shallow,
      throttleMs,
      debounceMs,
      clearOnDefault,
      startTransition,
    }),
    [
      history,
      scroll,
      shallow,
      throttleMs,
      debounceMs,
      clearOnDefault,
      startTransition,
    ],
  );

  const [initialTableState] = React.useState(initialState);

  const pageParser = React.useMemo(
    () => parseAsInteger.withOptions(queryStateOptions).withDefault(1),
    [queryStateOptions],
  );
  const perPageParser = React.useMemo(
    () =>
      parseAsInteger
        .withOptions(queryStateOptions)
        .withDefault(
          initialTableState?.pagination?.pageSize ?? DEFAULT_PAGE_SIZE,
        ),
    [initialTableState, queryStateOptions],
  );

  const columnIndex = React.useMemo(() => {
    const sortableIds = new Set<string>();
    const filterableVariants = new Map<string, FilterVariant>();

    for (const column of columns) {
      const id = getColumnId(column);
      if (!id) continue;
      const hasAccessor = "accessorKey" in column || "accessorFn" in column;
      if (hasAccessor && column.enableSorting !== false) {
        sortableIds.add(id);
      }
      if (!column.enableColumnFilter) continue;

      filterableVariants.set(id, getFilterVariant(column.meta));
    }

    return {
      sortableIds,
      filterableIds: [...filterableVariants.keys()],
      variantById: Object.fromEntries(filterableVariants),
      normalizeColumnFilters: (filters: ColumnFiltersState) =>
        filters.map((filter) =>
          normalizeColumnFilter(
            filter,
            filterableVariants.get(filter.id) ?? "text",
          ),
        ),
    };
  }, [columns]);

  const pageKey = queryKeys?.page;
  const perPageKey = queryKeys?.perPage;
  const sortKey = queryKeys?.sort;
  const joinOperatorKey = queryKeys?.joinOperator;
  const globalFilterKey = queryKeys?.globalFilter;

  const urlKeys = React.useMemo(() => {
    const { page, perPage, sort, joinOperator, search, ...filterUrlKeys } =
      getUrlKeys(columnIndex.filterableIds, {
        queryKeys: {
          page: pageKey,
          perPage: perPageKey,
          sort: sortKey,
          joinOperator: joinOperatorKey,
          globalFilter: globalFilterKey,
        },
        queryKeyPrefix,
      });

    return {
      page,
      perPage,
      sort,
      joinOperator,
      globalFilter: search,
      filters: filterUrlKeys,
      idByFilterKey: new Map(
        Object.entries(filterUrlKeys).map(([id, urlKey]) => [urlKey, id]),
      ),
    };
  }, [
    columnIndex,
    pageKey,
    perPageKey,
    sortKey,
    joinOperatorKey,
    globalFilterKey,
    queryKeyPrefix,
  ]);

  const [page, setPage] = useQueryState(urlKeys.page, pageParser);
  const [perPage, setPerPage] = useQueryState(urlKeys.perPage, perPageParser);

  const sortingParser = React.useMemo(
    () =>
      getSortingStateParser(columnIndex.sortableIds)
        .withOptions(queryStateOptions)
        .withDefault(initialTableState?.sorting ?? EMPTY_SORTING),
    [columnIndex, initialTableState, queryStateOptions],
  );

  const [sorting, setSorting] = useQueryState(urlKeys.sort, sortingParser);

  const getNextSorting = useChainedUpdate(sorting);

  function onSortingChange(updater: Updater<SortingState>) {
    void setSorting(getNextSorting(updater));
  }

  const joinOperatorParser = React.useMemo(
    () =>
      parseAsStringEnum([...JOIN_OPERATORS])
        .withOptions(queryStateOptions)
        .withDefault(initialTableState?.joinOperator ?? "and"),
    [initialTableState, queryStateOptions],
  );

  const [joinOperator, setJoinOperator] = useQueryState(
    urlKeys.joinOperator,
    joinOperatorParser,
  );

  const getNextJoinOperator = useChainedUpdate(joinOperator);

  function onJoinOperatorChange(updater: Updater<JoinOperator>) {
    void setJoinOperator(getNextJoinOperator(updater));
  }

  const filterParsers = React.useMemo(
    () =>
      Object.fromEntries(
        columnIndex.filterableIds.map((id) => [
          id,
          getColumnFilterParser(
            id,
            columnIndex.variantById[id] ?? "text",
          ).withOptions(queryStateOptions),
        ]),
      ),
    [columnIndex, queryStateOptions],
  );

  const [filterParams, setFilterParams] = useQueryStates(filterParsers, {
    urlKeys: urlKeys.filters,
  });

  const search = React.useSyncExternalStore(
    subscribeToHistory,
    getLocationSearch,
    getServerLocationSearch,
  );

  const filterOrder = React.useMemo(
    () =>
      [...new Set(new URLSearchParams(search).keys())]
        .flatMap((key) => urlKeys.idByFilterKey.get(key) ?? [])
        .join("&"),
    [urlKeys, search],
  );

  const urlFilters = React.useMemo(
    () =>
      sortColumnFiltersBySearch(
        getColumnFilters(
          columnIndex.filterableIds,
          (id) => filterParams[id] ?? [],
        ),
        filterOrder,
      ),
    [columnIndex, filterParams, filterOrder],
  );
  const urlFiltersKey = getColumnFiltersKey(urlFilters);

  const [filtersDraft, setFiltersDraft] = React.useState<FiltersDraft | null>(
    () => {
      const initialFilters = initialTableState?.columnFilters;
      if (urlFilters.length > 0 || !initialFilters?.length) return null;

      return {
        filters: columnIndex.normalizeColumnFilters(initialFilters),
        urlFiltersKey,
        pageToReset: null,
      };
    },
  );

  const activeDraft =
    filtersDraft?.urlFiltersKey === urlFiltersKey ? filtersDraft : null;
  const columnFilters = activeDraft?.filters ?? urlFilters;

  const globalFilterParser = React.useMemo(
    () => parseAsString.withOptions(queryStateOptions).withDefault(""),
    [queryStateOptions],
  );

  const [urlGlobalFilter, setUrlGlobalFilter] = useQueryState(
    urlKeys.globalFilter,
    globalFilterParser,
  );
  const [globalFilterDraft, setGlobalFilterDraft] =
    React.useState<GlobalFilterDraft | null>(() => {
      if (!enableGlobalFilter) return null;
      const initialGlobalFilter = getGlobalFilterValue(
        initialTableState?.globalFilter,
      );
      if (urlGlobalFilter !== "" || initialGlobalFilter === "") return null;

      return {
        value: initialGlobalFilter,
        urlValue: urlGlobalFilter,
        pageToReset: null,
      };
    });

  const activeGlobalFilterDraft =
    globalFilterDraft?.urlValue === urlGlobalFilter ? globalFilterDraft : null;
  const globalFilter = enableGlobalFilter
    ? (activeGlobalFilterDraft?.value ?? urlGlobalFilter)
    : "";

  const pageIndex =
    activeDraft?.pageToReset === page ||
    activeGlobalFilterDraft?.pageToReset === page
      ? 0
      : page - 1;

  const pagination = React.useMemo<PaginationState>(
    () => ({ pageIndex, pageSize: perPage }),
    [pageIndex, perPage],
  );

  const getNextPagination = useChainedUpdate(pagination);

  function onPaginationChange(updater: Updater<PaginationState>) {
    const next = getNextPagination(updater);
    if (next.pageIndex !== pagination.pageIndex) {
      if (activeDraft?.pageToReset) {
        setFiltersDraft((prev) => prev && { ...prev, pageToReset: null });
      }
      if (activeGlobalFilterDraft?.pageToReset) {
        setGlobalFilterDraft((prev) => prev && { ...prev, pageToReset: null });
      }
      void setPage(next.pageIndex + 1);
    }
    if (next.pageSize !== pagination.pageSize) {
      void setPerPage(next.pageSize);
    }
  }

  const debouncedWriteFilters = useDebouncedCallback(
    (columnFilters: ColumnFiltersState, sourceUrlFiltersKey: string) => {
      if (sourceUrlFiltersKey !== urlFiltersKey) return;

      const filters = getActiveFilters(
        columnIndex.normalizeColumnFilters(columnFilters),
      ).filter((filter) => Object.hasOwn(columnIndex.variantById, filter.id));
      const params = new Map<string, ColumnFilterItem[] | null>();

      for (const filter of filters) {
        const group = params.get(filter.id);
        if (group) group.push(filter);
        else params.set(filter.id, [filter]);
      }
      for (const id of columnIndex.filterableIds) {
        if (!params.has(id)) params.set(id, null);
      }

      const nextUrlFiltersKey = getColumnFiltersKey(filters);
      setFiltersDraft(
        (prev) => prev && { ...prev, urlFiltersKey: nextUrlFiltersKey },
      );
      if (page !== 1) void setPage(1);
      void setFilterParams(Object.fromEntries(params));
    },
    debounceMs,
  );

  const getNextColumnFilters = useChainedUpdate(columnFilters);

  function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
    const filters = getNextColumnFilters(updater);
    setFiltersDraft({
      filters,
      urlFiltersKey,
      pageToReset: !isServer && page !== 1 ? page : null,
    });
    debouncedWriteFilters(filters, urlFiltersKey);
  }

  const debouncedWriteGlobalFilter = useDebouncedCallback(
    (value: string, sourceUrlValue: string) => {
      if (sourceUrlValue !== urlGlobalFilter) return;

      setGlobalFilterDraft((prev) => prev && { ...prev, urlValue: value });
      if (page !== 1) void setPage(1);
      void setUrlGlobalFilter(value || null);
    },
    debounceMs,
  );

  const getNextGlobalFilter = useChainedUpdate<unknown>(globalFilter);

  function onGlobalFilterChange(updater: Updater<unknown>) {
    if (!enableGlobalFilter) return;
    const value = getGlobalFilterValue(getNextGlobalFilter(updater));
    setGlobalFilterDraft({
      value,
      urlValue: urlGlobalFilter,
      pageToReset: !isServer && page !== 1 ? page : null,
    });
    debouncedWriteGlobalFilter(value, urlGlobalFilter);
  }

  const table = useTable(
    {
      ...props,
      features: dataTableFeatures,
      columns,
      enableGlobalFilter,
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

export { useDataTable, type UseDataTableProps };

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
