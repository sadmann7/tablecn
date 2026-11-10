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
import { useQueryStates } from "nuqs";
import * as React from "react";

import type {
  ColumnFilterItem,
  DataTableColumnConfigs,
  JoinOperator,
} from "@/lib/data-table-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  applyColumnConfig,
  createDataTableConfig,
  type DataTableConfig,
  getColumnConfigs,
} from "@/lib/data-table-config";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  getColumnFilters,
  getColumnFiltersKey,
  sortColumnFiltersBySearch,
} from "@/lib/data-table-parsers";
import {
  getActiveFilters,
  getActiveFiltersKey,
  normalizeColumnFilter,
} from "@/lib/data-table-utils";

const DEBOUNCE_MS = 300;

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

interface BuiltInConfigOptions {
  columns: DataTableColumnConfigs;
  pageSizeOptions?: number[];
  enableGlobalFilter?: boolean;
}

interface UrlStateOptions {
  history?: "push" | "replace";
  debounceMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
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
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
> &
  UrlStateOptions &
  (
    | {
        config: Omit<DataTableConfig, "parse">;
        enableGlobalFilter?: never;
        pageSizeOptions?: never;
        initialState?: Omit<
          InitialTableState,
          | "sorting"
          | "pagination"
          | "joinOperator"
          | "columnFilters"
          | "globalFilter"
        >;
      }
    | {
        config?: never;
        initialState?: InitialTableState;
      }
  ) &
  (
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
  initialState: initialStateProp,
  config: configProp,
  startTransition,
  history = "replace",
  debounceMs = DEBOUNCE_MS,
  clearOnDefault,
  scroll = false,
  shallow = true,
  enableGlobalFilter: enableGlobalFilterProp,
  pageSizeOptions: pageSizeOptionsProp,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server";

  const [initialState] = React.useState<InitialTableState | undefined>(
    initialStateProp,
  );

  const configKey = configProp
    ? ""
    : JSON.stringify({
        columns: getColumnConfigs(columns),
        pageSizeOptions: pageSizeOptionsProp,
        enableGlobalFilter: enableGlobalFilterProp,
      });

  const config = React.useMemo(() => {
    if (configProp) return configProp;
    const options = JSON.parse(configKey) as BuiltInConfigOptions;

    return createDataTableConfig({
      ...options,
      defaultSorting: initialState?.sorting,
      defaultPageSize: initialState?.pagination?.pageSize,
      defaultJoinOperator: initialState?.joinOperator,
    });
  }, [configProp, configKey, initialState]);
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
    () => columns.map((column) => applyColumnConfig(column, config.columns)),
    [columns, config],
  );

  const filterableIds = React.useMemo(
    () => Object.keys(filterVariants),
    [filterVariants],
  );

  function normalizeColumnFilters(filters: ColumnFiltersState) {
    return filters.map((filter) =>
      normalizeColumnFilter(filter, filterVariants[filter.id] ?? "text"),
    );
  }

  const queryStateOptions = {
    urlKeys,
    history,
    scroll,
    shallow: isServer ? shallow : true,
    clearOnDefault,
    startTransition,
  };

  const [
    { page, perPage, sort: sorting, joinOperator, search: urlGlobalFilter },
    setQueryState,
  ] = useQueryStates(queryParsers.state, queryStateOptions);
  const [filterParams, setFilterParams] = useQueryStates(
    queryParsers.filters,
    queryStateOptions,
  );

  function resetPage() {
    if (page !== 1) void setQueryState({ page: 1 });
  }

  const locationSearch = React.useSyncExternalStore(
    subscribeToHistory,
    getLocationSearch,
    getServerLocationSearch,
  );

  const filterOrder = React.useMemo(() => {
    const idByUrlKey = new Map(
      filterableIds.map((columnId) => [urlKeys[columnId], columnId]),
    );

    return [...new Set(new URLSearchParams(locationSearch).keys())]
      .flatMap((key) => idByUrlKey.get(key) ?? [])
      .join("&");
  }, [filterableIds, urlKeys, locationSearch]);

  const getNextSorting = useChainedUpdate(sorting);

  function onSortingChange(updater: Updater<SortingState>) {
    const next = getNextSorting(updater);
    if (JSON.stringify(next) === JSON.stringify(sorting)) return;
    resetPage();
    void setQueryState({ sort: next });
  }

  const getNextJoinOperator = useChainedUpdate(joinOperator);

  function onJoinOperatorChange(updater: Updater<JoinOperator>) {
    const next = getNextJoinOperator(updater);
    if (next === joinOperator) return;
    resetPage();
    void setQueryState({ joinOperator: next });
  }

  const urlFilters = React.useMemo(
    () =>
      sortColumnFiltersBySearch(
        getColumnFilters(filterableIds, filterParams),
        filterOrder,
      ),
    [filterableIds, filterParams, filterOrder],
  );
  const urlFiltersKey = getColumnFiltersKey(urlFilters);

  const [filtersDraft, setFiltersDraft] = React.useState<FiltersDraft | null>(
    () => {
      const initialFilters = initialTableState?.columnFilters;
      if (urlFilters.length > 0 || !initialFilters?.length) return null;

      return {
        filters: normalizeColumnFilters(initialFilters),
        urlFiltersKey,
        pageToReset: null,
      };
    },
  );

  const activeDraft =
    filtersDraft?.urlFiltersKey === urlFiltersKey ? filtersDraft : null;
  const columnFilters = activeDraft?.filters ?? urlFilters;

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
      void setQueryState({ page: next.pageIndex + 1 });
    }
    if (next.pageSize !== pagination.pageSize) {
      void setQueryState({ perPage: next.pageSize });
    }
  }

  const debouncedWriteFilters = useDebouncedCallback(
    (columnFilters: ColumnFiltersState, sourceUrlFiltersKey: string) => {
      if (sourceUrlFiltersKey !== urlFiltersKey) return;

      const filters = getActiveFilters(
        normalizeColumnFilters(columnFilters),
      ).filter((filter) => Object.hasOwn(filterVariants, filter.id));
      const params = new Map<string, ColumnFilterItem[] | null>();

      for (const filter of filters) {
        const group = params.get(filter.id);
        if (group) group.push(filter);
        else params.set(filter.id, [filter]);
      }
      for (const id of filterableIds) {
        if (!params.has(id)) params.set(id, null);
      }

      const nextUrlFiltersKey = getColumnFiltersKey(filters);
      if (nextUrlFiltersKey === urlFiltersKey) return;

      setFiltersDraft(
        (prev) => prev && { ...prev, urlFiltersKey: nextUrlFiltersKey },
      );
      resetPage();
      void setFilterParams(Object.fromEntries(params));
    },
    debounceMs,
  );

  const getNextColumnFilters = useChainedUpdate(columnFilters);

  function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
    const filters = getNextColumnFilters(updater);
    const hasChanged =
      getActiveFiltersKey(normalizeColumnFilters(filters)) !==
      getActiveFiltersKey(urlFilters);
    setFiltersDraft({
      filters,
      urlFiltersKey,
      pageToReset: hasChanged && !isServer && page !== 1 ? page : null,
    });
    debouncedWriteFilters(filters, urlFiltersKey);
  }

  const debouncedWriteGlobalFilter = useDebouncedCallback(
    (value: string, sourceUrlValue: string) => {
      if (sourceUrlValue !== urlGlobalFilter || value === urlGlobalFilter) {
        return;
      }

      setGlobalFilterDraft((prev) => prev && { ...prev, urlValue: value });
      resetPage();
      void setQueryState({ search: value || null });
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
      pageToReset:
        value !== urlGlobalFilter && !isServer && page !== 1 ? page : null,
    });
    debouncedWriteGlobalFilter(value, urlGlobalFilter);
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
