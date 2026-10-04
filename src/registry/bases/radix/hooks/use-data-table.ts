import {
  type ColumnFiltersState,
  type PaginationState,
  type RowData,
  type SortingState,
  type TableOptions,
  type Updater,
  useTable,
} from "@tanstack/react-table";
import {
  parseAsInteger,
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
  DataTableQueryKeys,
} from "@/lib/data-table-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  getActiveFilters,
  JOIN_OPERATORS,
  normalizeColumnFilter,
} from "@/lib/data-table-utils";
import {
  getColumnFilterParser,
  getColumnFilters,
  getColumnFiltersKey,
  getSortingStateParser,
  sortColumnFiltersBySearch,
} from "@/lib/parsers";

const PAGE_KEY = "page";
const PER_PAGE_KEY = "perPage";
const SORT_KEY = "sort";
const JOIN_OPERATOR_KEY = "joinOperator";
const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;
const DEFAULT_PAGE_SIZE = 10;
const EMPTY_SORTING: SortingState = [];
const EMPTY_COLUMN_FILTERS: ColumnFiltersState = [];

type UseDataTableProps<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "pageCount"
  | "features"
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
> & {
  queryKeys?: Partial<DataTableQueryKeys>;
  history?: "push" | "replace";
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
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
  queryKeys,
  history = "replace",
  debounceMs = DEBOUNCE_MS,
  throttleMs = THROTTLE_MS,
  clearOnDefault = false,
  scroll = false,
  shallow: shallowProp = true,
  startTransition,
  ...props
}: UseDataTableProps<TData>) {
  const isServer = mode === "server";
  const shallow = isServer ? shallowProp : true;

  const pageKey = queryKeys?.page ?? PAGE_KEY;
  const perPageKey = queryKeys?.perPage ?? PER_PAGE_KEY;
  const sortKey = queryKeys?.sort ?? SORT_KEY;
  const joinOperatorKey = queryKeys?.joinOperator ?? JOIN_OPERATOR_KEY;

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

  const initialStateRef = React.useRef(initialState);

  const pageParser = React.useMemo(
    () => parseAsInteger.withOptions(queryStateOptions).withDefault(1),
    [queryStateOptions],
  );
  const perPageParser = React.useMemo(
    () =>
      parseAsInteger
        .withOptions(queryStateOptions)
        .withDefault(
          initialStateRef.current?.pagination?.pageSize ?? DEFAULT_PAGE_SIZE,
        ),
    [queryStateOptions],
  );

  const [page, setPage] = useQueryState(pageKey, pageParser);
  const [perPage, setPerPage] = useQueryState(perPageKey, perPageParser);

  const pagination = React.useMemo<PaginationState>(
    () => ({
      pageIndex: page - 1,
      pageSize: perPage,
    }),
    [page, perPage],
  );

  const onPaginationChange = React.useCallback(
    (updaterOrValue: Updater<PaginationState>) => {
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(pagination)
          : updaterOrValue;

      void setPage(next.pageIndex + 1);
      void setPerPage(next.pageSize);
    },
    [pagination, setPage, setPerPage],
  );

  const columnIndex = React.useMemo(() => {
    const sortableIds = new Set<string>();
    const filterableVariants = new Map<string, FilterVariant>();

    for (const column of columns) {
      if (!column.id) continue;
      const hasAccessor = "accessorKey" in column || "accessorFn" in column;
      if (hasAccessor && column.enableSorting !== false) {
        sortableIds.add(column.id);
      }
      if (!column.enableColumnFilter) continue;

      filterableVariants.set(column.id, column.meta?.variant ?? "text");
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

  const sortingParser = React.useMemo(
    () =>
      getSortingStateParser(columnIndex.sortableIds)
        .withOptions(queryStateOptions)
        .withDefault(initialStateRef.current?.sorting ?? EMPTY_SORTING),
    [columnIndex, queryStateOptions],
  );

  const [sorting, setSorting] = useQueryState(sortKey, sortingParser);

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(sorting)
          : updaterOrValue;

      void setSorting(next);
    },
    [sorting, setSorting],
  );

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
  const joinOperatorParser = React.useMemo(
    () =>
      parseAsStringEnum([...JOIN_OPERATORS])
        .withOptions(queryStateOptions)
        .withDefault(initialStateRef.current?.joinOperator ?? "and"),
    [queryStateOptions],
  );

  const [filterParams, setFilterParams] = useQueryStates(filterParsers);
  const [joinOperator, setJoinOperator] = useQueryState(
    joinOperatorKey,
    joinOperatorParser,
  );

  const urlFilters = React.useMemo(
    () =>
      getColumnFilters(
        columnIndex.filterableIds,
        (id) => filterParams[id] ?? [],
      ),
    [columnIndex, filterParams],
  );
  const urlFiltersKey = getColumnFiltersKey(urlFilters);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    () =>
      urlFilters.length > 0
        ? urlFilters
        : columnIndex.normalizeColumnFilters(
            initialStateRef.current?.columnFilters ?? EMPTY_COLUMN_FILTERS,
          ),
  );
  const [syncedFiltersKey, setSyncedFiltersKey] = React.useState(urlFiltersKey);

  // The URL changed from outside (back/forward, an edited link), so it wins
  // over the filters being edited.
  if (urlFiltersKey !== syncedFiltersKey) {
    setSyncedFiltersKey(urlFiltersKey);
    setColumnFilters(urlFilters);
  }

  // nuqs and the server render only see values per column, so filters read
  // from the URL start in column order and take the URL's order once mounted.
  React.useEffect(() => {
    if (urlFilters.length < 2) return;

    setColumnFilters((prev) =>
      prev === urlFilters
        ? sortColumnFiltersBySearch(urlFilters, window.location.search)
        : prev,
    );
  }, [urlFilters]);

  const debouncedSyncFilters = useDebouncedCallback(
    (columnFilters: ColumnFiltersState) => {
      // Filters without a value stay out of the URL, since `?title=` reads
      // back as no filter.
      const filters = getActiveFilters(
        columnIndex.normalizeColumnFilters(columnFilters),
      ).filter((filter) => Object.hasOwn(columnIndex.variantById, filter.id));
      // Params are written in insertion order, so columns land in the URL in
      // the order their first filter appears.
      const params = new Map<string, ColumnFilterItem[] | null>();

      for (const filter of filters) {
        const group = params.get(filter.id);
        if (group) group.push(filter);
        else params.set(filter.id, [filter]);
      }
      for (const id of columnIndex.filterableIds) {
        if (!params.has(id)) params.set(id, null);
      }

      setSyncedFiltersKey(getColumnFiltersKey(filters));
      void setPage(1);
      void setFilterParams(Object.fromEntries(params));
    },
    debounceMs,
  );

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      setColumnFilters((prev) => {
        const next =
          typeof updaterOrValue === "function"
            ? updaterOrValue(prev)
            : updaterOrValue;

        debouncedSyncFilters(next);
        return next;
      });
    },
    [debouncedSyncFilters],
  );

  const onJoinOperatorChange = React.useCallback(
    (updaterOrValue: Updater<JoinOperator>) => {
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(joinOperator)
          : updaterOrValue;

      void setJoinOperator(next);
    },
    [joinOperator, setJoinOperator],
  );

  const table = useTable(
    {
      ...props,
      features: dataTableFeatures,
      columns,
      initialState: initialStateRef.current,
      pageCount: isServer ? pageCount : undefined,
      state: {
        pagination,
        sorting,
        columnFilters,
        joinOperator,
      },
      onPaginationChange,
      onSortingChange,
      onColumnFiltersChange,
      onJoinOperatorChange,
      manualPagination: isServer,
      manualSorting: isServer,
      manualFiltering: isServer,
    },
    (state) => ({
      columnFilters: state.columnFilters,
      joinOperator: state.joinOperator,
      pagination: state.pagination,
      sorting: state.sorting,
    }),
  );

  return React.useMemo(() => ({ table }), [table]);
}

export { useDataTable, type UseDataTableProps };
