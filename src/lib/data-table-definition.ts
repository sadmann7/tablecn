import {
  createLoader,
  createParser,
  type LoaderInput,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

import type {
  ColumnFilterItem,
  ColumnSortItem,
  ColumnVariantOptions,
  DataTableColumnConfig,
  DataTableColumnConfigs,
  DataTableColumnDisplayMeta,
  DataTableQuery,
  FilterableColumnId,
  FilterVariant,
  JoinOperator,
  SortableColumnId,
} from "@/lib/data-table-types";

import {
  getColumnFilterParser,
  getColumnFilters,
  getFilterableColumns,
  getKeys,
  getSortableColumns,
  getSortingStateParser,
} from "@/lib/data-table-parsers";
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  JOIN_OPERATORS,
} from "@/lib/data-table-utils";

const DEFAULT_PAGE_SIZE = 10;

const DATA_TABLE_KEYS = [
  "page",
  "perPage",
  "sort",
  "joinOperator",
  "search",
] as const;

type DataTableKey = (typeof DATA_TABLE_KEYS)[number];

type ReservedColumnConfigs = Partial<
  Record<DataTableKey, { variant?: undefined }>
>;

export type ColumnDisplayMeta<TConfig> = DataTableColumnDisplayMeta &
  (TConfig extends {
    variant: infer TVariant extends keyof ColumnVariantOptions;
  }
    ? Partial<ColumnVariantOptions[TVariant]>
    : unknown);

interface DataTableDefinitionOptions<TColumns extends DataTableColumnConfigs> {
  id?: string;
  columns: TColumns & ReservedColumnConfigs;
  defaultSorting?: ColumnSortItem<NoInfer<SortableColumnId<TColumns>>>[];
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  defaultJoinOperator?: JoinOperator;
  enableGlobalFilter?: boolean;
}

export interface DataTableDefinition<
  TColumns extends DataTableColumnConfigs = DataTableColumnConfigs,
> {
  readonly id: string | undefined;
  readonly columns: TColumns;
  readonly defaultSorting: ColumnSortItem<SortableColumnId<TColumns>>[];
  readonly defaultPageSize: number;
  readonly pageSizeOptions: readonly number[];
  readonly defaultJoinOperator: JoinOperator;
  readonly enableGlobalFilter: boolean;
  readonly parsers: ReturnType<
    typeof getDataTableStateParsers<SortableColumnId<TColumns>>
  > &
    ReturnType<typeof getDataTableFilterParsers<FilterableColumnId<TColumns>>>;
  readonly urlKeys: Record<DataTableKey, string> &
    Record<FilterableColumnId<TColumns>, string>;
  parse(
    search: LoaderInput,
    options?: { id?: string },
  ): InferDataTableQuery<DataTableDefinition<TColumns>>;
}

export type InferDataTableQuery<TDefinition> =
  TDefinition extends DataTableDefinition<infer TColumns>
    ? DataTableQuery<FilterableColumnId<TColumns>, SortableColumnId<TColumns>>
    : never;

export function defineDataTable<const TColumns extends DataTableColumnConfigs>({
  id,
  columns: columnsProp,
  defaultSorting = [],
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultJoinOperator = "and",
  enableGlobalFilter = true,
}: DataTableDefinitionOptions<TColumns>): DataTableDefinition<TColumns> {
  const columns: TColumns = columnsProp;
  const filterableColumns = getFilterableColumns(columns);
  const filterableIds = getKeys(filterableColumns);
  const stateParsers = getDataTableStateParsers({
    sortableIds: getSortableColumns(columns),
    defaultSorting,
    defaultPageSize,
    pageSizeOptions,
    defaultJoinOperator,
  });
  const filterParsers = getDataTableFilterParsers(filterableColumns);
  const urlKeys = getDataTableUrlKeys(filterableIds, id);
  const loaders = getLoaders(urlKeys);

  function getLoaders(tableUrlKeys: typeof urlKeys) {
    return {
      loadState: createLoader(stateParsers, { urlKeys: tableUrlKeys }),
      loadFilters: createLoader(filterParsers, { urlKeys: tableUrlKeys }),
    };
  }

  return Object.freeze({
    id,
    columns,
    defaultSorting,
    defaultPageSize,
    pageSizeOptions,
    defaultJoinOperator,
    enableGlobalFilter,
    parsers: { ...stateParsers, ...filterParsers },
    urlKeys,
    parse(search: LoaderInput, options?: { id?: string }) {
      const { loadState, loadFilters } =
        options?.id === undefined
          ? loaders
          : getLoaders(getDataTableUrlKeys(filterableIds, options.id));
      const state = loadState(search);
      const filters = loadFilters(search) as Record<
        FilterableColumnId<TColumns>,
        ColumnFilterItem<FilterableColumnId<TColumns>>[]
      >;

      return {
        page: state.page,
        perPage: state.perPage,
        sorting: state.sort,
        filters: getColumnFilters(
          filterableIds,
          (columnId) => filters[columnId],
        ),
        joinOperator: state.joinOperator,
        globalFilter: enableGlobalFilter ? state.search : "",
      };
    },
  });
}

export function getColumnConfigOptions(config: DataTableColumnConfig = {}) {
  const { enableSorting, ...meta } = config;

  return {
    meta,
    enableColumnFilter: config.variant !== undefined,
    enableSorting: enableSorting !== false,
  };
}

export function getDataTableUrlKeys<TColumnId extends string>(
  filterableIds: readonly TColumnId[],
  id?: string,
) {
  if (id === "") {
    throw new Error("Data table id must not be empty.");
  }
  for (const columnId of filterableIds) {
    if (!getIsDataTableKey(columnId)) continue;
    throw new Error(
      `Data table column id "${columnId}" is reserved for the ${columnId} query key. Rename the column or turn off its filter.`,
    );
  }

  const prefix = id === undefined ? "" : `${id}.`;
  const keys: readonly (DataTableKey | TColumnId)[] = [
    ...DATA_TABLE_KEYS,
    ...filterableIds,
  ];

  return Object.fromEntries(
    keys.map((key) => [key, `${prefix}${key}`]),
  ) as Record<DataTableKey, string> & Record<TColumnId, string>;
}

interface DataTableStateParsersOptions<TSortColumnId extends string> {
  sortableIds: readonly TSortColumnId[] | Set<TSortColumnId>;
  defaultSorting?: ColumnSortItem<TSortColumnId>[];
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  defaultJoinOperator?: JoinOperator;
}

export function getDataTableStateParsers<TSortColumnId extends string>({
  sortableIds,
  defaultSorting = [],
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultJoinOperator = "and",
}: DataTableStateParsersOptions<TSortColumnId>) {
  const maxPageSize = Math.max(defaultPageSize, ...pageSizeOptions);

  return {
    page: getIntegerParser(1).withDefault(1),
    perPage: getIntegerParser(1, maxPageSize).withDefault(defaultPageSize),
    sort: getSortingStateParser(sortableIds).withDefault(defaultSorting),
    joinOperator: parseAsStringEnum([...JOIN_OPERATORS]).withDefault(
      defaultJoinOperator,
    ),
    search: parseAsString.withDefault(""),
  } satisfies Record<DataTableKey, unknown>;
}

export function getDataTableFilterParsers<TColumnId extends string>(
  filterableColumns: Record<TColumnId, FilterVariant>,
) {
  return Object.fromEntries(
    getKeys(filterableColumns).map((columnId) => [
      columnId,
      getColumnFilterParser(columnId, filterableColumns[columnId]),
    ]),
  ) as Record<TColumnId, ReturnType<typeof getColumnFilterParser<TColumnId>>>;
}

function getIntegerParser(min: number, max = Number.POSITIVE_INFINITY) {
  return createParser({
    parse: (value) => {
      const number = parseAsInteger.parse(value);
      return number !== null && number >= min && number <= max ? number : null;
    },
    serialize: String,
  });
}

function getIsDataTableKey(key: string): key is DataTableKey {
  return DATA_TABLE_KEYS.some((dataTableKey) => dataTableKey === key);
}
