import { type ColumnDef, type RowData } from "@tanstack/react-table";
import {
  createLoader,
  createParser,
  type LoaderInput,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  ColumnSortItem,
  DataTableColumnConfig,
  DataTableColumnConfigs,
  DataTableQuery,
  FilterableColumnId,
  FilterVariant,
  JoinOperator,
  SortableColumnId,
} from "@/lib/data-table-types";

import {
  getColumnFilterParser,
  getColumnFilters,
  getSortingStateParser,
} from "@/lib/data-table-parsers";
import {
  DEFAULT_PAGE_SIZE_OPTIONS,
  getColumnId,
  getFilterVariant,
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

type ReservedColumnConfigs<TColumns> = {
  [K in keyof TColumns as K extends DataTableKey ? K : never]: {
    variant?: undefined;
  };
};

type KnownColumnConfigs<TColumns> = {
  [K in keyof TColumns]: Record<
    Exclude<keyof TColumns[K], keyof DataTableColumnConfig>,
    never
  >;
};

type ConfigQuery<TColumns extends DataTableColumnConfigs> = DataTableQuery<
  FilterableColumnId<TColumns>,
  SortableColumnId<TColumns>
>;

type ColumnFilterParser<TColumnId extends string> = ReturnType<
  typeof getColumnFilterParser<TColumnId>
>;

interface DataTableConfigOptions<TColumns extends DataTableColumnConfigs> {
  id?: string;
  columns: TColumns &
    ReservedColumnConfigs<TColumns> &
    KnownColumnConfigs<TColumns>;
  defaultSorting?: ColumnSortItem<NoInfer<SortableColumnId<TColumns>>>[];
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  defaultJoinOperator?: JoinOperator;
  enableGlobalFilter?: boolean;
}

export interface DataTableConfig<
  TColumns extends DataTableColumnConfigs = DataTableColumnConfigs,
> {
  readonly id: string | undefined;
  readonly columns: TColumns;
  readonly defaultSorting: ColumnSortItem<SortableColumnId<TColumns>>[];
  readonly defaultPageSize: number;
  readonly pageSizeOptions: readonly number[];
  readonly defaultJoinOperator: JoinOperator;
  readonly enableGlobalFilter: boolean;
  readonly filterVariants: Record<FilterableColumnId<TColumns>, FilterVariant>;
  readonly stateParsers: ReturnType<typeof getStateParsers>;
  readonly filterParsers: Record<string, ColumnFilterParser<string>>;
  readonly urlKeys: Record<DataTableKey | FilterableColumnId<TColumns>, string>;
  parse(search: LoaderInput): ConfigQuery<TColumns>;
}

export type InferDataTableQuery<
  TConfig extends { parse: (search: never) => unknown },
> = ReturnType<TConfig["parse"]>;

export function createDataTableConfig<
  const TColumns extends DataTableColumnConfigs,
>({
  id,
  columns,
  defaultSorting = [],
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultJoinOperator = "and",
  enableGlobalFilter = true,
}: DataTableConfigOptions<TColumns>): DataTableConfig<TColumns> {
  if (id === "") {
    throw new Error("Data table id must not be empty.");
  }

  const filterVariants = getFilterVariants<TColumns>(columns);
  const filterableIds = getKeys(filterVariants);
  const reservedId = filterableIds.find(getIsDataTableKey);
  if (reservedId !== undefined) {
    throw new Error(
      `Data table column id "${reservedId}" is reserved for the ${reservedId} query key. Rename the column or turn off its filter.`,
    );
  }

  const sortableIds = getSortableIds<TColumns>(columns);
  const stateParsers = getStateParsers({
    sortableIds,
    defaultSorting,
    defaultPageSize,
    pageSizeOptions,
    defaultJoinOperator,
  });
  const filterParsers: Record<string, ColumnFilterParser<string>> = fromKeys(
    filterableIds,
    (columnId) =>
      getColumnFilterParser<string>(columnId, filterVariants[columnId]),
  );

  const prefix = id === undefined ? "" : `${id}.`;
  const urlKeys = fromKeys(
    [...DATA_TABLE_KEYS, ...filterableIds],
    (key) => `${prefix}${key}`,
  );

  const load = createLoader({ ...stateParsers, ...filterParsers }, { urlKeys });

  return Object.freeze({
    id,
    columns,
    defaultSorting,
    defaultPageSize,
    pageSizeOptions,
    defaultJoinOperator,
    enableGlobalFilter,
    filterVariants,
    stateParsers,
    filterParsers,
    urlKeys,
    parse(search: LoaderInput) {
      const values = load(search);
      return {
        page: values.page,
        perPage: values.perPage,
        sorting: values.sort.flatMap(({ id, desc }) =>
          getIsOneOf(sortableIds, id) ? [{ id, desc }] : [],
        ),
        filters: getColumnFilters(filterableIds, values),
        joinOperator: values.joinOperator,
        globalFilter: enableGlobalFilter ? values.search : "",
      };
    },
  });
}

export function applyColumnConfig<TData extends RowData>(
  column: ColumnDef<DataTableFeatures, TData>,
  configs: DataTableColumnConfigs,
): ColumnDef<DataTableFeatures, TData> {
  if (getIsGroupColumn(column)) {
    return {
      ...column,
      columns: column.columns.map((child) => applyColumnConfig(child, configs)),
    };
  }

  const columnId = getColumnId(column);
  const config =
    columnId !== undefined && Object.hasOwn(configs, columnId)
      ? configs[columnId]
      : undefined;
  if (!config) {
    return { ...column, enableColumnFilter: false, enableSorting: false };
  }
  const { enableSorting, ...meta } = config;

  return {
    ...column,
    enableColumnFilter: config.variant !== undefined,
    enableSorting: enableSorting !== false,
    meta: { ...column.meta, ...meta },
  };
}

export function getColumnConfigs<TData extends RowData>(
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

export function getColumnConfigsKey<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
) {
  return JSON.stringify(getColumnConfigs(columns));
}

export function parseColumnConfigsKey(key: string): DataTableColumnConfigs {
  return JSON.parse(key);
}

export function getUnmatchedConfigIds<TData extends RowData>(
  configs: DataTableColumnConfigs,
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
) {
  const columnIds = new Set(
    getLeafColumns(columns).map((column) => getColumnId(column)),
  );
  return Object.keys(configs).filter((columnId) => !columnIds.has(columnId));
}

function getFilterVariants<TColumns extends DataTableColumnConfigs>(
  columns: TColumns,
) {
  const variants: Record<string, FilterVariant> = {};

  for (const [columnId, config] of Object.entries(columns)) {
    if (config.variant) variants[columnId] = config.variant;
  }

  return variants as Record<FilterableColumnId<TColumns>, FilterVariant>;
}

function getSortableIds<TColumns extends DataTableColumnConfigs>(
  columns: TColumns,
) {
  return Object.keys(columns).filter(
    (columnId) => columns[columnId]?.enableSorting !== false,
  ) as SortableColumnId<TColumns>[];
}

function getKeys<TKey extends string>(record: Record<TKey, unknown>) {
  return Object.keys(record) as TKey[];
}

function fromKeys<TKey extends string, TValue>(
  keys: readonly TKey[],
  getValue: (key: TKey) => TValue,
) {
  return Object.fromEntries(keys.map((key) => [key, getValue(key)])) as Record<
    TKey,
    TValue
  >;
}

interface StateParsersOptions {
  sortableIds: string[];
  defaultSorting: ColumnSortItem[];
  defaultPageSize: number;
  pageSizeOptions: readonly number[];
  defaultJoinOperator: JoinOperator;
}

function getStateParsers({
  sortableIds,
  defaultSorting,
  defaultPageSize,
  pageSizeOptions,
  defaultJoinOperator,
}: StateParsersOptions) {
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
  return getIsOneOf(DATA_TABLE_KEYS, key);
}

function getIsOneOf<TValue extends string>(
  values: readonly TValue[],
  value: string,
): value is TValue {
  return values.some((item) => item === value);
}

function getLeafColumns<TData extends RowData>(
  columns: readonly ColumnDef<DataTableFeatures, TData>[],
): ColumnDef<DataTableFeatures, TData>[] {
  return columns.flatMap((column) =>
    getIsGroupColumn(column) ? getLeafColumns(column.columns) : [column],
  );
}

function getColumnConfig<TData extends RowData>(
  column: ColumnDef<DataTableFeatures, TData>,
): DataTableColumnConfig {
  const hasAccessor = "accessorKey" in column || "accessorFn" in column;
  const enableSorting = hasAccessor && column.enableSorting !== false;
  if (!column.enableColumnFilter) return { enableSorting };

  return { enableSorting, variant: getFilterVariant(column.meta) };
}

function getIsGroupColumn<TData extends RowData>(
  column: ColumnDef<DataTableFeatures, TData>,
): column is ColumnDef<DataTableFeatures, TData> & {
  columns: ColumnDef<DataTableFeatures, TData>[];
} {
  return "columns" in column && Array.isArray(column.columns);
}
