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
  getActiveFilters,
  getColumnId,
  getFilterVariant,
  normalizeColumnFilter,
} from "@/lib/data-table-utils";

const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;

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
  throttleMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

type InitialTableState = Partial<TableState<DataTableFeatures>>;

type UseDataTableProps<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "pageCount"
  | "features"
  | "initialState"
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
> &
  UrlStateOptions & {
    startTransition?: React.TransitionStartFunction;
  } & (
    | {
        definition: Pick<
          DataTableDefinition,
          "id" | "columns" | "defaultSorting" | "defaultPageSize"
        >;
        id?: never;
        initialState?: Omit<InitialTableState, "sorting" | "pagination">;
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
  throttleMs = THROTTLE_MS,
  clearOnDefault = false,
  scroll = false,
  shallow: shallowProp = true,
  enableGlobalFilter = true,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server";

  const [initialTableState] = React.useState<InitialTableState | undefined>(
    () =>
      definition
        ? {
            ...initialState,
            sorting: definition.defaultSorting,
            pagination: {
              pageIndex: 0,
              pageSize: definition.defaultPageSize,
            },
          }
        : initialState,
  );

  const tableColumns = React.useMemo(
    () =>
      definition
        ? columns.map((column) => getDefinedColumn(column, definition.columns))
        : columns,
    [columns, definition],
  );

  const columnIndex = React.useMemo(() => {
    const variantById: Record<string, FilterVariant> = definition
      ? getFilterableColumns(definition.columns)
      : getFilterableVariants(columns);

    return {
      sortableIds: new Set(
        definition
          ? getSortableColumns(definition.columns)
          : getSortableIds(columns),
      ),
      filterableIds: Object.keys(variantById),
      variantById,
      normalizeColumnFilters: (filters: ColumnFiltersState) =>
        filters.map((filter) =>
          normalizeColumnFilter(filter, variantById[filter.id] ?? "text"),
        ),
    };
  }, [columns, definition]);

  const {
    page,
    setPage,
    perPage,
    setPerPage,
    sorting,
    setSorting,
    joinOperator,
    setJoinOperator,
    filterParams,
    setFilterParams,
    filterOrder,
    globalFilter: urlGlobalFilter,
    setGlobalFilter: setUrlGlobalFilter,
  } = useUrlTableState({
    id,
    columnIndex,
    defaultPageSize: initialTableState?.pagination?.pageSize,
    defaultSorting: initialTableState?.sorting,
    defaultJoinOperator: initialTableState?.joinOperator,
    startTransition,
    history,
    debounceMs,
    throttleMs,
    clearOnDefault,
    scroll,
    shallow: isServer ? shallowProp : true,
  });

  const getNextSorting = useChainedUpdate(sorting);

  function onSortingChange(updater: Updater<SortingState>) {
    void setSorting(getNextSorting(updater));
  }

  const getNextJoinOperator = useChainedUpdate(joinOperator);

  function onJoinOperatorChange(updater: Updater<JoinOperator>) {
    void setJoinOperator(getNextJoinOperator(updater));
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
      columns: tableColumns,
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

interface ColumnIndex {
  sortableIds: Set<string>;
  filterableIds: string[];
  variantById: Record<string, FilterVariant>;
}

interface UseUrlTableStateOptions extends Required<UrlStateOptions> {
  id: string | undefined;
  columnIndex: ColumnIndex;
  defaultPageSize: number | undefined;
  defaultSorting: SortingState | undefined;
  defaultJoinOperator: JoinOperator | undefined;
  startTransition: React.TransitionStartFunction | undefined;
}

function useUrlTableState({
  id,
  columnIndex,
  defaultPageSize,
  defaultSorting,
  defaultJoinOperator,
  startTransition,
  history,
  debounceMs,
  throttleMs,
  clearOnDefault,
  scroll,
  shallow,
}: UseUrlTableStateOptions) {
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
      defaultSorting,
      defaultPageSize,
      defaultJoinOperator,
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
  }, [
    columnIndex,
    defaultSorting,
    defaultPageSize,
    defaultJoinOperator,
    queryStateOptions,
  ]);

  const [page, setPage] = useQueryState(urlKeys.page, parsers.page);
  const [perPage, setPerPage] = useQueryState(urlKeys.perPage, parsers.perPage);
  const [sorting, setSorting] = useQueryState(urlKeys.sort, parsers.sort);
  const [joinOperator, setJoinOperator] = useQueryState(
    urlKeys.joinOperator,
    parsers.joinOperator,
  );
  const [globalFilter, setGlobalFilter] = useQueryState(
    urlKeys.search,
    parsers.search,
  );
  const [filterParams, setFilterParams] = useQueryStates(parsers.filters, {
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

  return {
    page,
    setPage,
    perPage,
    setPerPage,
    sorting,
    setSorting,
    joinOperator,
    setJoinOperator,
    filterParams,
    setFilterParams,
    filterOrder,
    globalFilter,
    setGlobalFilter,
  };
}

function getDefinedColumn<TData extends RowData>(
  column: ColumnDef<DataTableFeatures, TData>,
  configs: DataTableColumnConfigs,
): ColumnDef<DataTableFeatures, TData> {
  const columnId = getColumnId(column);
  if (columnId === undefined || !Object.hasOwn(configs, columnId)) {
    return { ...column, enableColumnFilter: false, enableSorting: false };
  }
  const { meta, ...options } = getColumnConfigOptions(configs[columnId]);

  return { ...column, ...options, meta: { ...column.meta, ...meta } };
}

function getFilterableVariants<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
) {
  const variantById: Record<string, FilterVariant> = {};

  for (const column of columns) {
    const columnId = getColumnId(column);
    if (!columnId || !column.enableColumnFilter) continue;
    variantById[columnId] = getFilterVariant(column.meta);
  }

  return variantById;
}

function getSortableIds<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
) {
  return columns.flatMap((column) => {
    const columnId = getColumnId(column);
    const hasAccessor = "accessorKey" in column || "accessorFn" in column;
    return columnId && hasAccessor && column.enableSorting !== false
      ? [columnId]
      : [];
  });
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
