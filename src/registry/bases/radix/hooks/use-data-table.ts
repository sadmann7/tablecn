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
  JOIN_OPERATORS,
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

type UseDataTableProps<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  | "state"
  | "pageCount"
  | "features"
  | "manualFiltering"
  | "manualPagination"
  | "manualSorting"
> & {
  queryKeys?: Partial<QueryKeys>;
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
    const filterableColumns: { id: string; variant: FilterVariant }[] = [];
    const filterableVariants = new Map<string, FilterVariant>();

    for (const column of columns) {
      if (!column.id) continue;
      sortableIds.add(column.id);
      if (!column.enableColumnFilter) continue;

      const variant = column.meta?.variant ?? "text";
      filterableColumns.push({ id: column.id, variant });
      filterableVariants.set(column.id, variant);
    }

    return {
      sortableIds,
      filterableColumns,
      filterableIds: filterableColumns.map((column) => column.id),
      resolveColumnFilters: (filters: ColumnFiltersState) =>
        filters.map((filter) =>
          resolveColumnFilter(
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

  const jsonFiltersParser = React.useMemo(
    () =>
      getFiltersStateParser(columnIndex.filterableIds)
        .withOptions(queryStateOptions)
        .withDefault(
          columnIndex.resolveColumnFilters(
            initialStateRef.current?.columnFilters ?? EMPTY_COLUMN_FILTERS,
          ),
        ),
    [columnIndex, queryStateOptions],
  );
  const plainFilterParsers = React.useMemo(() => {
    const parsers: Record<
      string,
      SingleParser<string> | SingleParser<string[]>
    > = {};

    for (const column of columnIndex.filterableColumns) {
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
      parseAsStringEnum([...JOIN_OPERATORS])
        .withOptions(queryStateOptions)
        .withDefault(initialStateRef.current?.joinOperator ?? "and"),
    [queryStateOptions],
  );

  const [jsonFilters, setJsonFilters] = useQueryState(
    filtersKey,
    jsonFiltersParser,
  );
  const [plainFilters, setPlainFilters] = useQueryStates(plainFilterParsers);
  const [joinOperator, setJoinOperator] = useQueryState(
    joinOperatorKey,
    joinOperatorParser,
  );

  const debouncedSyncFilters = useDebouncedCallback(
    (columnFilters: ColumnFiltersState) => {
      const filters = columnIndex.resolveColumnFilters(columnFilters);
      const validFilters = getValidFilters(filters);
      const writeAsPlainFilters = getCanWriteAsKeys(
        validFilters,
        columnIndex.filterableIds,
      );
      const valueById = new Map(
        validFilters.map((filter) => [filter.id, filter.value]),
      );

      void setPage(1);
      void setJsonFilters(
        writeAsPlainFilters || filters.length === 0 ? null : filters,
      );
      void setPlainFilters(
        Object.fromEntries(
          columnIndex.filterableIds.map((id) => [
            id,
            writeAsPlainFilters ? (valueById.get(id) ?? null) : null,
          ]),
        ),
      );
    },
    debounceMs,
  );

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    () => [
      ...jsonFilters,
      ...columnIndex.filterableColumns.flatMap((column) => {
        const item = toColumnFilterItem(
          column.id,
          column.variant,
          plainFilters[column.id],
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
