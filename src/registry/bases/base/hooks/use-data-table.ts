import {
  type ColumnFiltersState,
  type PaginationState,
  type RowData,
  type SortingState,
  type TableOptions,
  type TableState,
  type Updater,
  useTable,
} from "@tanstack/react-table";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  type SingleParser,
  useQueryState,
  type UseQueryStateOptions,
  useQueryStates,
} from "nuqs";
import * as React from "react";

import type {
  DataTableUrlFormat,
  FilterVariant,
  JoinOperator,
  QueryKeys,
} from "@/lib/data-table-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  getCanWriteAsKeys,
  getIsMultiValueVariant,
  getValidFilters,
  joinOperators,
  resolveColumnFilter,
  toColumnFilterItem,
} from "@/lib/data-table-utils";
import { getFiltersStateParser, getSortingStateParser } from "@/lib/parsers";

const PAGE_KEY = "page";
const PER_PAGE_KEY = "perPage";
const SORT_KEY = "sort";
const FILTERS_KEY = "filters";
const JOIN_OPERATOR_KEY = "joinOperator";
const ARRAY_SEPARATOR = ",";
const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;
const DEFAULT_PAGE_SIZE = 10;
const EMPTY_SORTING: SortingState = [];
const EMPTY_COLUMN_FILTERS: ColumnFiltersState = [];

function useShallow<T extends object>(value: T): T {
  const ref = React.useRef(value);
  const previous = ref.current;
  if (getIsShallowEqual(previous, value)) return previous;

  ref.current = value;
  return value;
}

function getIsShallowEqual(previous: object, next: object) {
  if (Object.is(previous, next)) return true;

  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return false;

  return nextKeys.every(
    (key) =>
      Object.hasOwn(previous, key) &&
      Object.is(
        (previous as Record<string, unknown>)[key],
        (next as Record<string, unknown>)[key],
      ),
  );
}

interface UseDataTableBaseProps<TData extends RowData> extends Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "pageCount"
  | "features"
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
> {
  initialState?: Partial<TableState<DataTableFeatures>>;
  queryKeys?: Partial<QueryKeys>;
  history?: "push" | "replace";
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  urlFormat?: DataTableUrlFormat;
  startTransition?: React.TransitionStartFunction;
}

type UseDataTableProps<TData extends RowData> = UseDataTableBaseProps<TData> &
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

function useDataTable<TData extends RowData>(props: UseDataTableProps<TData>) {
  const {
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
    urlFormat = "compact",
    startTransition,
    ...tableProps
  } = props;

  const isServer = mode === "server";
  const shallow = isServer ? shallowProp : true;
  const withJsonFilters = urlFormat === "json";

  const pageKey = queryKeys?.page ?? PAGE_KEY;
  const perPageKey = queryKeys?.perPage ?? PER_PAGE_KEY;
  const sortKey = queryKeys?.sort ?? SORT_KEY;
  const filtersKey = queryKeys?.filters ?? FILTERS_KEY;
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
      pageIndex: page - 1, // zero-based index -> one-based index
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
    const filterable: { id: string; variant: FilterVariant }[] = [];
    const variants = new Map<string, FilterVariant>();

    for (const column of columns) {
      if (!column.id) continue;
      sortableIds.add(column.id);
      if (!column.enableColumnFilter) continue;

      const variant = column.meta?.variant ?? "text";
      filterable.push({ id: column.id, variant });
      variants.set(column.id, variant);
    }

    return {
      sortableIds,
      filterable,
      filterableIds: filterable.map((column) => column.id),
      resolve: (filters: ColumnFiltersState) =>
        filters.map((filter) =>
          resolveColumnFilter(filter, variants.get(filter.id) ?? "text"),
        ),
    };
  }, [columns]);

  const sortingParser = React.useMemo(
    () =>
      getSortingStateParser(columnIndex.sortableIds, urlFormat)
        .withOptions(queryStateOptions)
        .withDefault(initialStateRef.current?.sorting ?? EMPTY_SORTING),
    [columnIndex, urlFormat, queryStateOptions],
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

  const filtersParser = React.useMemo(
    () =>
      getFiltersStateParser(columnIndex.filterableIds)
        .withOptions(queryStateOptions)
        .withDefault(
          columnIndex.resolve(
            initialStateRef.current?.columnFilters ?? EMPTY_COLUMN_FILTERS,
          ),
        ),
    [columnIndex, queryStateOptions],
  );
  const filterParsers = React.useMemo(() => {
    const parsers: Record<
      string,
      SingleParser<string> | SingleParser<string[]>
    > = {};

    for (const column of columnIndex.filterable) {
      parsers[column.id] = getIsMultiValueVariant(column.variant)
        ? parseAsArrayOf(parseAsString, ARRAY_SEPARATOR).withOptions(
            queryStateOptions,
          )
        : parseAsString.withOptions(queryStateOptions);
    }

    return parsers;
  }, [columnIndex, queryStateOptions]);
  const joinOperatorParser = React.useMemo(
    () =>
      parseAsStringEnum([...joinOperators])
        .withOptions(queryStateOptions)
        .withDefault(initialStateRef.current?.joinOperator ?? "and"),
    [queryStateOptions],
  );

  const [urlFilters, setUrlFilters] = useQueryState(filtersKey, filtersParser);
  const [filterValues, setFilterValues] = useQueryStates(filterParsers);
  const [joinOperator, setJoinOperator] = useQueryState(
    joinOperatorKey,
    joinOperatorParser,
  );

  const debouncedSetUrlFilters = useDebouncedCallback(
    (columnFilters: ColumnFiltersState) => {
      const filters = columnIndex.resolve(columnFilters);
      // Filters without a value don't filter, so they don't pick the format.
      const validFilters = getValidFilters(filters);
      const withKeys =
        !withJsonFilters &&
        getCanWriteAsKeys(validFilters, columnIndex.filterableIds);
      const valueById = new Map(
        validFilters.map((filter) => [filter.id, filter.value]),
      );

      void setPage(1);
      void setUrlFilters(withKeys || filters.length === 0 ? null : filters);
      void setFilterValues(
        Object.fromEntries(
          columnIndex.filterableIds.map((id) => [
            id,
            withKeys ? (valueById.get(id) ?? null) : null,
          ]),
        ) as typeof filterValues,
      );
    },
    debounceMs,
  );

  // Same order as `getDataTableQuery`: `filters` items, then per-column keys.
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    () => [
      ...urlFilters,
      ...columnIndex.filterable.flatMap((column) => {
        const item = toColumnFilterItem(
          column.id,
          column.variant,
          filterValues[column.id],
        );
        return item ? [item] : [];
      }),
    ],
  );

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      setColumnFilters((prev) => {
        const next =
          typeof updaterOrValue === "function"
            ? updaterOrValue(prev)
            : updaterOrValue;

        debouncedSetUrlFilters(next);
        return next;
      });
    },
    [debouncedSetUrlFilters],
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

  const stableTableProps = useShallow(tableProps);

  const tableOptions = React.useMemo<TableOptions<DataTableFeatures, TData>>(
    () => ({
      ...stableTableProps,
      features: dataTableFeatures,
      columns,
      initialState: initialStateRef.current,
      ...(isServer ? { pageCount } : {}),
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
    }),
    [
      stableTableProps,
      columns,
      isServer,
      pageCount,
      pagination,
      sorting,
      columnFilters,
      joinOperator,
      onPaginationChange,
      onSortingChange,
      onColumnFiltersChange,
      onJoinOperatorChange,
    ],
  );

  const selectState = React.useCallback(
    (state: TableState<DataTableFeatures>) => ({
      columnFilters: state.columnFilters,
      joinOperator: state.joinOperator,
      pagination: state.pagination,
      sorting: state.sorting,
    }),
    [],
  );

  const table = useTable(tableOptions, selectState);

  return React.useMemo(() => ({ table }), [table]);
}

export { useDataTable, type UseDataTableProps };
