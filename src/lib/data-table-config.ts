import {
  type AccessorKeyColumnDef,
  type ColumnDef,
  createColumnHelper,
  type IdentifiedColumnDef,
  type RowData,
} from "@tanstack/react-table";
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

type ConfigQuery<TColumns extends DataTableColumnConfigs> = DataTableQuery<
  FilterableColumnId<TColumns>,
  SortableColumnId<TColumns>
>;

type ColumnFilterParser<TColumnId extends string> = ReturnType<
  typeof getColumnFilterParser<TColumnId>
>;

type ConfigParsers<TColumns extends DataTableColumnConfigs> = ReturnType<
  typeof getStateParsers
> &
  (string extends keyof TColumns
    ? unknown
    : Record<
        FilterableColumnId<TColumns>,
        ColumnFilterParser<FilterableColumnId<TColumns>>
      >);

interface DataTableConfigOptions<TColumns extends DataTableColumnConfigs> {
  id?: string;
  columns: TColumns & ReservedColumnConfigs<TColumns>;
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
  readonly parsers: ConfigParsers<TColumns>;
  readonly urlKeys: Record<DataTableKey | FilterableColumnId<TColumns>, string>;
  parse(search: LoaderInput): ConfigQuery<TColumns>;
}

export type InferDataTableQuery<
  TConfig extends { parse: (search: never) => unknown },
> = ReturnType<TConfig["parse"]>;

type ColumnVariantDisplayOptions<TColumnConfig> = TColumnConfig extends {
  variant: infer TVariant extends keyof ColumnVariantOptions;
}
  ? Omit<ColumnVariantOptions[TVariant], "filter">
  : unknown;

type ConfiguredColumnDef<TData extends RowData, TValue, TColumnConfig> = Omit<
  IdentifiedColumnDef<DataTableFeatures, TData, TValue>,
  "id" | "meta" | "enableColumnFilter" | "enableSorting"
> & {
  meta?: DataTableColumnDisplayMeta &
    ColumnVariantDisplayOptions<TColumnConfig>;
};

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
  const filterVariants = getFilterVariants(columns);
  const filterableIds = Object.keys(filterVariants);

  if (id === "") {
    throw new Error("Data table id must not be empty.");
  }
  const reservedId = filterableIds.find(getIsDataTableKey);
  if (reservedId !== undefined) {
    throw new Error(
      `Data table column id "${reservedId}" is reserved for the ${reservedId} query key. Rename the column or turn off its filter.`,
    );
  }

  const stateParsers = getStateParsers({
    sortableIds: Object.keys(columns).filter(
      (columnId) => columns[columnId]?.enableSorting !== false,
    ),
    defaultSorting,
    defaultPageSize,
    pageSizeOptions,
    defaultJoinOperator,
  });
  const filterParsers = Object.fromEntries(
    Object.entries(filterVariants).map(([columnId, variant]) => [
      columnId,
      getColumnFilterParser(columnId, variant),
    ]),
  );

  const prefix = id === undefined ? "" : `${id}.`;
  const urlKeys = Object.fromEntries(
    [...DATA_TABLE_KEYS, ...filterableIds].map((key) => [
      key,
      `${prefix}${key}`,
    ]),
  );

  const parsers = { ...stateParsers, ...filterParsers };
  const load = createLoader(parsers, { urlKeys });

  return Object.freeze({
    id,
    columns,
    defaultSorting,
    defaultPageSize,
    pageSizeOptions,
    defaultJoinOperator,
    enableGlobalFilter,
    filterVariants,
    parsers,
    urlKeys,
    parse(search: LoaderInput) {
      const values = load(search);
      return {
        page: values.page,
        perPage: values.perPage,
        sorting: values.sort,
        filters: getColumnFilters(filterableIds, values),
        joinOperator: values.joinOperator,
        globalFilter: enableGlobalFilter ? values.search : "",
      };
    },
  }) as DataTableConfig<TColumns>;
}

export function createDataTableColumnHelper<
  TData extends RowData,
  TConfig extends Pick<DataTableConfig, "columns">,
>() {
  const columnHelper = createColumnHelper<DataTableFeatures, TData>();

  return {
    ...columnHelper,
    accessor<TId extends keyof TConfig["columns"] & keyof TData & string>(
      id: TId,
      column: ConfiguredColumnDef<TData, TData[TId], TConfig["columns"][TId]>,
    ): AccessorKeyColumnDef<DataTableFeatures, TData, TData[TId]> {
      return { ...column, id, accessorKey: id };
    },
  };
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

function getFilterVariants(columns: DataTableColumnConfigs) {
  return Object.fromEntries(
    Object.entries(columns).flatMap(([columnId, config]) =>
      config.variant ? [[columnId, getFilterVariant(config)] as const] : [],
    ),
  );
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
  return DATA_TABLE_KEYS.some((dataTableKey) => dataTableKey === key);
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
