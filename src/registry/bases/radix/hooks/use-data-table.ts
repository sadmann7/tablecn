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
  ColumnFilterItem,
  ExtendedColumnFilter,
  ExtendedColumnSort,
  JoinOperator,
  QueryKeys,
} from "@/lib/data-table-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import { dataTableFilterFn } from "@/lib/data-table-filters";
import {
  dataTableConfig,
  toColumnFilterItem,
  toColumnFilterValue,
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

/**
 * How simple (toolbar) column filters are written to the URL.
 *
 * - `"keys"`: one query param per column, e.g. `?status=todo,done&title=fix`.
 *   Server code receives them per column.
 * - `"json"`: merged into the `filters` param as operator-based filter
 *   items, so simple and advanced filters share one server contract.
 */
type DataTableFilterUrlFormat = "keys" | "json";

interface UseDataTableBaseProps<TData extends RowData> extends Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "pageCount"
  | "features"
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
  | "manualAdvancedFiltering"
> {
  initialState?: Omit<Partial<TableState<DataTableFeatures>>, "sorting"> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  queryKeys?: Partial<QueryKeys>;
  history?: "push" | "replace";
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  startTransition?: React.TransitionStartFunction;
  filterUrlFormat?: DataTableFilterUrlFormat;
}

type UseDataTableProps<TData extends RowData> = UseDataTableBaseProps<TData> &
  (
    | {
        /** The server paginates, sorts and filters. `data` is one page. */
        mode?: "server";
        pageCount: number;
      }
    | {
        /** TanStack paginates, sorts and filters `data` in the browser. */
        mode: "client";
        pageCount?: never;
      }
  );

export function useDataTable<TData extends RowData>(
  props: UseDataTableProps<TData>,
) {
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
    startTransition,
    filterUrlFormat = "keys",
    ...tableProps
  } = props;
  const isServer: boolean = mode === "server";
  // A client table already has every row, so a deep (server) navigation
  // would only refetch the same data.
  const shallow = isServer ? shallowProp : true;
  const usesJsonFilters = filterUrlFormat === "json";

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

  const [page, setPage] = useQueryState(
    pageKey,
    parseAsInteger.withOptions(queryStateOptions).withDefault(1),
  );
  const [perPage, setPerPage] = useQueryState(
    perPageKey,
    parseAsInteger
      .withOptions(queryStateOptions)
      .withDefault(initialState?.pagination?.pageSize ?? 10),
  );

  const pagination: PaginationState = React.useMemo(() => {
    return {
      pageIndex: page - 1, // zero-based index -> one-based index
      pageSize: perPage,
    };
  }, [page, perPage]);

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

  const columnIds = React.useMemo(() => {
    return new Set(
      columns.map((column) => column.id).filter(Boolean) as string[],
    );
  }, [columns]);

  const [sorting, setSorting] = useQueryState(
    sortKey,
    getSortingStateParser<TData>(columnIds)
      .withOptions(queryStateOptions)
      .withDefault(initialState?.sorting ?? []),
  );

  const onSortingChange = React.useCallback(
    (updaterOrValue: Updater<SortingState>) => {
      const next =
        typeof updaterOrValue === "function"
          ? updaterOrValue(sorting)
          : updaterOrValue;

      void setSorting(next as ExtendedColumnSort<TData>[]);
    },
    [sorting, setSorting],
  );

  const filterableColumns = React.useMemo(
    () => columns.filter((column) => column.enableColumnFilter),
    [columns],
  );

  const filterableColumnIds = React.useMemo(
    () => filterableColumns.map((column) => column.id).filter(Boolean),
    [filterableColumns],
  );

  // Advanced filters: operator-based filter items in the `filters` param.
  const [urlFilters, setUrlFilters] = useQueryState(
    filtersKey,
    getFiltersStateParser<TData>(filterableColumnIds as string[])
      .withOptions(queryStateOptions)
      .withDefault(
        (initialState?.advancedFilters ?? []) as ExtendedColumnFilter<TData>[],
      ),
  );

  const [joinOperator, setJoinOperator] = useQueryState(
    joinOperatorKey,
    parseAsStringEnum([...dataTableConfig.joinOperators])
      .withOptions(queryStateOptions)
      .withDefault(initialState?.joinOperator ?? "and"),
  );

  const debouncedSetUrlFilters = useDebouncedCallback(
    (filters: ColumnFilterItem[]) => {
      void setPage(1);
      void setUrlFilters(filters as ExtendedColumnFilter<TData>[]);
    },
    debounceMs,
  );

  const [advancedFilters, setAdvancedFilters] =
    React.useState<ColumnFilterItem[]>(urlFilters);

  const onAdvancedFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFilterItem[]>) => {
      setAdvancedFilters((prev) => {
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

  // Simple filters, "keys" format: one param per filterable column.
  const filterParsers = React.useMemo(() => {
    if (usesJsonFilters) return {};

    return filterableColumns.reduce<
      Record<string, SingleParser<string> | SingleParser<string[]>>
    >((acc, column) => {
      if (!column.id) return acc;

      const isMultiValue =
        column.meta?.options !== undefined ||
        column.meta?.variant === "range" ||
        column.meta?.variant === "dateRange";

      acc[column.id] = isMultiValue
        ? parseAsArrayOf(parseAsString, ARRAY_SEPARATOR).withOptions(
            queryStateOptions,
          )
        : parseAsString.withOptions(queryStateOptions);

      return acc;
    }, {});
  }, [filterableColumns, queryStateOptions, usesJsonFilters]);

  const [filterValues, setFilterValues] = useQueryStates(filterParsers);

  const debouncedSetFilterValues = useDebouncedCallback(
    (values: typeof filterValues) => {
      void setPage(1);
      void setFilterValues(values);
    },
    debounceMs,
  );

  const initialColumnFilters: ColumnFiltersState = React.useMemo(() => {
    if (usesJsonFilters) {
      return urlFilters.map((filter) => ({
        id: filter.id,
        value: toColumnFilterValue(filter),
      }));
    }

    return Object.entries(filterValues).reduce<ColumnFiltersState>(
      (filters, [key, value]) => {
        if (value !== null) filters.push({ id: key, value });
        return filters;
      },
      [],
    );
  }, [filterValues, urlFilters, usesJsonFilters]);

  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters);

  const onColumnFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFiltersState>) => {
      setColumnFilters((prev) => {
        const next =
          typeof updaterOrValue === "function"
            ? updaterOrValue(prev)
            : updaterOrValue;

        if (usesJsonFilters) {
          const items = next.flatMap((filter) => {
            const column = filterableColumns.find(
              (column) => column.id === filter.id,
            );
            const item = toColumnFilterItem(
              filter.id,
              column?.meta?.variant ?? "text",
              filter.value,
            );
            return item ? [item] : [];
          });

          setAdvancedFilters(items);
          debouncedSetUrlFilters(items);
          return next;
        }

        const filterUpdates = next.reduce<
          Record<string, string | string[] | null>
        >((acc, filter) => {
          if (filterableColumns.some((column) => column.id === filter.id)) {
            acc[filter.id] = filter.value as string | string[];
          }
          return acc;
        }, {});

        for (const prevFilter of prev) {
          if (!next.some((filter) => filter.id === prevFilter.id)) {
            filterUpdates[prevFilter.id] = null;
          }
        }

        debouncedSetFilterValues(filterUpdates);
        return next;
      });
    },
    [
      debouncedSetFilterValues,
      debouncedSetUrlFilters,
      filterableColumns,
      usesJsonFilters,
    ],
  );

  const table = useTable(
    {
      ...tableProps,
      features: dataTableFeatures,
      columns,
      initialState,
      ...(isServer ? { pageCount } : {}),
      state: {
        pagination,
        sorting,
        columnFilters,
        advancedFilters,
        joinOperator,
      },
      defaultColumn: {
        ...(isServer ? {} : { filterFn: dataTableFilterFn }),
        ...tableProps.defaultColumn,
        enableColumnFilter: false,
      },
      onPaginationChange,
      onSortingChange,
      onColumnFiltersChange,
      onAdvancedFiltersChange,
      onJoinOperatorChange,
      manualPagination: isServer,
      manualSorting: isServer,
      manualFiltering: isServer,
      manualAdvancedFiltering: isServer,
      meta: {
        ...tableProps.meta,
        queryKeys: {
          page: pageKey,
          perPage: perPageKey,
          sort: sortKey,
          filters: filtersKey,
          joinOperator: joinOperatorKey,
        },
      },
    },
    (state) => ({
      advancedFilters: state.advancedFilters,
      columnFilters: state.columnFilters,
      joinOperator: state.joinOperator,
      pagination: state.pagination,
      sorting: state.sorting,
    }),
  );

  return React.useMemo(() => ({ table }), [table]);
}
