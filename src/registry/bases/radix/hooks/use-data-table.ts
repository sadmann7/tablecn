import {
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
  JoinOperator,
  QueryKeys,
} from "@/lib/data-table-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  type DataTableFeatures,
  dataTableFeatures,
} from "@/lib/data-table-features";
import {
  dataTableConfig,
  getIsMultiValueVariant,
  getIsSimpleFilter,
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

/**
 * How filters are written to the URL. Both formats are always read.
 *
 * - `"keys"`: toolbar filters get one query param per column, e.g.
 *   `?status=todo,done&title=fix`. Filters the toolbar can't express (other
 *   operators, several per column) fall back to the `filters` param.
 * - `"json"`: every filter goes into the `filters` param.
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
> {
  initialState?: Partial<TableState<DataTableFeatures>>;
  queryKeys?: Partial<QueryKeys>;
  history?: "push" | "replace";
  debounceMs?: number;
  throttleMs?: number;
  clearOnDefault?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  filterUrlFormat?: DataTableFilterUrlFormat;
  startTransition?: React.TransitionStartFunction;
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
    filterUrlFormat = "keys",
    startTransition,
    ...tableProps
  } = props;
  const isServer = mode === "server";
  const shallow = isServer ? shallowProp : true;
  const withJsonFilters = filterUrlFormat === "json";

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
    return new Set(columns.flatMap((column) => (column.id ? [column.id] : [])));
  }, [columns]);

  const [sorting, setSorting] = useQueryState(
    sortKey,
    getSortingStateParser(columnIds)
      .withOptions(queryStateOptions)
      .withDefault(initialState?.sorting ?? []),
  );

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

  const filterableColumns = React.useMemo(
    () =>
      columns.flatMap((column) =>
        column.enableColumnFilter && column.id
          ? [{ id: column.id, variant: column.meta?.variant ?? "text" }]
          : [],
      ),
    [columns],
  );

  const filterableColumnIds = React.useMemo(
    () => filterableColumns.map((column) => column.id),
    [filterableColumns],
  );

  const [urlFilters, setUrlFilters] = useQueryState(
    filtersKey,
    getFiltersStateParser(filterableColumnIds)
      .withOptions(queryStateOptions)
      .withDefault(initialState?.filters ?? []),
  );

  const filterParsers = React.useMemo(() => {
    return filterableColumns.reduce<
      Record<string, SingleParser<string> | SingleParser<string[]>>
    >((acc, column) => {
      acc[column.id] = getIsMultiValueVariant(column.variant)
        ? parseAsArrayOf(parseAsString, ARRAY_SEPARATOR).withOptions(
            queryStateOptions,
          )
        : parseAsString.withOptions(queryStateOptions);

      return acc;
    }, {});
  }, [filterableColumns, queryStateOptions]);

  const [filterValues, setFilterValues] = useQueryStates(filterParsers);

  const [joinOperator, setJoinOperator] = useQueryState(
    joinOperatorKey,
    parseAsStringEnum([...dataTableConfig.joinOperators])
      .withOptions(queryStateOptions)
      .withDefault(initialState?.joinOperator ?? "and"),
  );

  const debouncedSetUrlFilters = useDebouncedCallback(
    (filters: ColumnFilterItem[]) => {
      const withKeys =
        !withJsonFilters && getCanWriteAsKeys(filters, filterableColumnIds);

      void setPage(1);
      void setUrlFilters(withKeys || filters.length === 0 ? null : filters);
      void setFilterValues(
        Object.fromEntries(
          filterableColumnIds.map((id) => [
            id,
            withKeys
              ? (filters.find((filter) => filter.id === id)?.value ?? null)
              : null,
          ]),
        ) as typeof filterValues,
      );
    },
    debounceMs,
  );

  // Same order as `getDataTableQuery`: `filters` items, then per-column keys.
  const [filters, setFilters] = React.useState<ColumnFilterItem[]>(() => [
    ...urlFilters,
    ...filterableColumns.flatMap((column) => {
      const item = toColumnFilterItem(
        column.id,
        column.variant,
        filterValues[column.id],
      );
      return item ? [item] : [];
    }),
  ]);

  const onFiltersChange = React.useCallback(
    (updaterOrValue: Updater<ColumnFilterItem[]>) => {
      setFilters((prev) => {
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
        filters,
        joinOperator,
      },
      defaultColumn: {
        ...tableProps.defaultColumn,
        enableColumnFilter: false,
      },
      onPaginationChange,
      onSortingChange,
      onFiltersChange,
      onJoinOperatorChange,
      manualPagination: isServer,
      manualSorting: isServer,
      manualFiltering: isServer,
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
      filters: state.filters,
      joinOperator: state.joinOperator,
      pagination: state.pagination,
      sorting: state.sorting,
    }),
  );

  return React.useMemo(() => ({ table }), [table]);
}

/**
 * Per-column keys hold at most one toolbar filter per column, read back in
 * column order, so only write them when that round-trips exactly.
 */
function getCanWriteAsKeys(filters: ColumnFilterItem[], columnIds: string[]) {
  let lastIndex = -1;

  return filters.every((filter) => {
    const index = columnIds.indexOf(filter.id);
    if (index <= lastIndex || !getIsSimpleFilter(filter)) return false;
    if (!toColumnFilterItem(filter.id, filter.variant, filter.value)) {
      return false;
    }
    lastIndex = index;
    return true;
  });
}

export { useDataTable, type UseDataTableProps };
