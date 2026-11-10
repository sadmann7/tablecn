import {
  type ColumnDef,
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
import { useQueryState, type UseQueryStateOptions, useQueryStates } from "nuqs";
import * as React from "react";

import type { DataTableDefinition } from "@/lib/data-table-definition";
import type {
  ColumnFilterItem,
  DataTableColumnConfig,
  DataTableColumnConfigs,
  FilterVariant,
  JoinOperator,
} from "@/lib/data-table-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  getColumnConfigOptions,
  getDataTableFilterParsers,
  getDataTableStateParsers,
  getDataTableUrlKeys,
} from "@/lib/data-table-definition";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  getColumnFilters,
  getColumnFiltersKey,
  getFilterableColumns,
  getSortableColumns,
  sortColumnFiltersBySearch,
} from "@/lib/data-table-parsers";
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getActiveFilters,
  getActiveFiltersKey,
  getColumnId,
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

interface UrlStateOptions {
  history?: "push" | "replace";
  debounceMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
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
  UrlStateOptions & {
    startTransition?: React.TransitionStartFunction;
    pageSizeOptions?: readonly number[];
  } & (
    | {
        definition: Pick<
          DataTableDefinition,
          | "id"
          | "columns"
          | "defaultSorting"
          | "defaultPageSize"
          | "pageSizeOptions"
          | "defaultJoinOperator"
          | "enableGlobalFilter"
        >;
        id?: string;
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
        definition?: never;
        id?: string;
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
  initialState,
  definition,
  id = definition?.id,
  startTransition,
  history = "replace",
  debounceMs = DEBOUNCE_MS,
  clearOnDefault,
  scroll = false,
  shallow: shallowProp = true,
  enableGlobalFilter: enableGlobalFilterProp = true,
  pageSizeOptions: pageSizeOptionsProp,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server";

  const [initialTableState] = React.useState<InitialTableState>(() => {
    const state: InitialTableState = { ...initialState };
    if (!definition) return state;

    return {
      ...state,
      sorting: definition.defaultSorting,
      pagination: { pageIndex: 0, pageSize: definition.defaultPageSize },
      joinOperator: definition.defaultJoinOperator,
    };
  });

  const enableGlobalFilter =
    definition?.enableGlobalFilter ?? enableGlobalFilterProp;
  const pageSizeOptions =
    definition?.pageSizeOptions ??
    pageSizeOptionsProp ??
    DEFAULT_PAGE_SIZE_OPTIONS;

  const columnConfigs = React.useMemo(
    () => definition?.columns ?? getColumnConfigs(columns),
    [columns, definition],
  );

  const tableColumns = React.useMemo(
    () => columns.map((column) => getDefinedColumn(column, columnConfigs)),
    [columns, columnConfigs],
  );

  const columnIndex = React.useMemo(() => {
    const variantById: Record<string, FilterVariant> =
      getFilterableColumns(columnConfigs);

    return {
      sortableIds: new Set<string>(getSortableColumns(columnConfigs)),
      filterableIds: Object.keys(variantById),
      variantById,
      normalizeColumnFilters: (filters: ColumnFiltersState) =>
        filters.map((filter) =>
          normalizeColumnFilter(filter, variantById[filter.id] ?? "text"),
        ),
    };
  }, [columnConfigs]);

  const queryStateOptions = React.useMemo<
    Omit<UseQueryStateOptions<string>, "parse">
  >(
    () => ({
      history,
      scroll,
      shallow: isServer ? shallowProp : true,
      clearOnDefault,
      startTransition,
    }),
    [history, scroll, isServer, shallowProp, clearOnDefault, startTransition],
  );

  const urlKeys = React.useMemo(() => {
    const { page, perPage, sort, joinOperator, search, ...filters } =
      getDataTableUrlKeys(columnIndex.filterableIds, id);

    return {
      page,
      perPage,
      sort,
      joinOperator,
      search,
      filters,
      idByFilterKey: new Map(
        Object.entries(filters).map(([columnId, urlKey]) => [urlKey, columnId]),
      ),
    };
  }, [columnIndex, id]);

  const parsers = React.useMemo(() => {
    const state = getDataTableStateParsers({
      sortableIds: columnIndex.sortableIds,
      defaultSorting: initialTableState?.sorting,
      defaultPageSize: initialTableState?.pagination?.pageSize,
      pageSizeOptions,
      defaultJoinOperator: initialTableState?.joinOperator,
    });

    return {
      page: state.page.withOptions(queryStateOptions),
      perPage: state.perPage.withOptions(queryStateOptions),
      sort: state.sort.withOptions(queryStateOptions),
      joinOperator: state.joinOperator.withOptions(queryStateOptions),
      search: state.search.withOptions(queryStateOptions),
      filters: Object.fromEntries(
        Object.entries(getDataTableFilterParsers(columnIndex.variantById)).map(
          ([columnId, parser]) => [
            columnId,
            parser.withOptions(queryStateOptions),
          ],
        ),
      ),
    };
  }, [columnIndex, initialTableState, pageSizeOptions, queryStateOptions]);

  const [page, setPage] = useQueryState(urlKeys.page, parsers.page);
  const [perPage, setPerPage] = useQueryState(urlKeys.perPage, parsers.perPage);
  const [sorting, setSorting] = useQueryState(urlKeys.sort, parsers.sort);
  const [joinOperator, setJoinOperator] = useQueryState(
    urlKeys.joinOperator,
    parsers.joinOperator,
  );
  const [urlGlobalFilter, setUrlGlobalFilter] = useQueryState(
    urlKeys.search,
    parsers.search,
  );
  const [filterParams, setFilterParams] = useQueryStates(parsers.filters, {
    urlKeys: urlKeys.filters,
  });

  const locationSearch = React.useSyncExternalStore(
    subscribeToHistory,
    getLocationSearch,
    getServerLocationSearch,
  );

  const filterOrder = React.useMemo(
    () =>
      [...new Set(new URLSearchParams(locationSearch).keys())]
        .flatMap((key) => urlKeys.idByFilterKey.get(key) ?? [])
        .join("&"),
    [urlKeys, locationSearch],
  );

  const getNextSorting = useChainedUpdate(sorting);

  function onSortingChange(updater: Updater<SortingState>) {
    const next = getNextSorting(updater);
    if (JSON.stringify(next) === JSON.stringify(sorting)) return;
    if (page !== 1) void setPage(1);
    void setSorting(next);
  }

  const getNextJoinOperator = useChainedUpdate(joinOperator);

  function onJoinOperatorChange(updater: Updater<JoinOperator>) {
    const next = getNextJoinOperator(updater);
    if (next === joinOperator) return;
    if (page !== 1) void setPage(1);
    void setJoinOperator(next);
  }

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
      if (nextUrlFiltersKey === urlFiltersKey) return;

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
    const hasChanged =
      getActiveFiltersKey(columnIndex.normalizeColumnFilters(filters)) !==
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

function getDefinedColumn<TData extends RowData>(
  column: ColumnDef<DataTableFeatures, TData>,
  configs: DataTableColumnConfigs,
): ColumnDef<DataTableFeatures, TData> {
  if (getIsGroupColumn(column)) {
    return {
      ...column,
      columns: column.columns.map((child) => getDefinedColumn(child, configs)),
    };
  }

  const columnId = getColumnId(column);
  if (columnId === undefined || !Object.hasOwn(configs, columnId)) {
    return { ...column, enableColumnFilter: false, enableSorting: false };
  }
  const { meta, ...options } = getColumnConfigOptions(configs[columnId]);

  return { ...column, ...options, meta: { ...column.meta, ...meta } };
}

function getColumnConfigs<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
) {
  const configs: DataTableColumnConfigs = {};

  for (const column of getLeafColumns(columns)) {
    const columnId = getColumnId(column);
    if (!columnId) continue;
    configs[columnId] = getColumnConfig(column);
  }

  return configs;
}

function getLeafColumns<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
): ColumnDef<DataTableFeatures, TData>[] {
  return columns.flatMap((column) =>
    getIsGroupColumn(column) ? getLeafColumns(column.columns) : [column],
  );
}

function getIsGroupColumn<TData extends RowData>(
  column: ColumnDef<DataTableFeatures, TData>,
): column is ColumnDef<DataTableFeatures, TData> & {
  columns: ColumnDef<DataTableFeatures, TData>[];
} {
  return "columns" in column && Array.isArray(column.columns);
}

function getColumnConfig<TData extends RowData>(
  column: ColumnDef<DataTableFeatures, TData>,
): DataTableColumnConfig {
  const hasAccessor = "accessorKey" in column || "accessorFn" in column;
  const enableSorting = hasAccessor && column.enableSorting !== false;
  if (!column.enableColumnFilter) return { enableSorting };

  const meta = column.meta;
  switch (meta?.variant) {
    case "number":
    case "date":
      return { enableSorting, variant: meta.variant, filter: meta.filter };
    case "select":
    case "multi-select":
      return { enableSorting, variant: meta.variant };
    default:
      return { enableSorting, variant: meta?.variant ?? "text" };
  }
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
