import {
  type AccessorKeyColumnDef,
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

type ReservedColumnConfigs = Partial<
  Record<DataTableKey, { variant?: undefined }>
>;

type ConfigQuery<TColumns extends DataTableColumnConfigs> = DataTableQuery<
  FilterableColumnId<TColumns>,
  SortableColumnId<TColumns>
>;

interface DataTableConfigOptions<TColumns extends DataTableColumnConfigs> {
  id?: string;
  columns: TColumns & ReservedColumnConfigs;
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
  readonly filterVariants: Record<string, FilterVariant>;
  readonly parsers: ReturnType<typeof getStateParsers>;
  readonly filterParsers: Record<
    string,
    ReturnType<typeof getColumnFilterParser>
  >;
  readonly urlKeys: Record<string, string>;
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
  columns: columnsProp,
  defaultSorting = [],
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultJoinOperator = "and",
  enableGlobalFilter = true,
}: DataTableConfigOptions<TColumns>): DataTableConfig<TColumns> {
  const columns: TColumns = columnsProp;
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

  const parsers = getStateParsers({
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

  const loadState = createLoader(parsers, { urlKeys });
  const loadFilters = createLoader(filterParsers, { urlKeys });

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
    filterParsers,
    urlKeys,
    parse(search: LoaderInput) {
      const state = loadState(search);
      const filters = loadFilters(search);
      const query: DataTableQuery = {
        page: state.page,
        perPage: state.perPage,
        sorting: state.sort,
        filters: getColumnFilters(
          filterableIds,
          (columnId) => filters[columnId] ?? [],
        ),
        joinOperator: state.joinOperator,
        globalFilter: enableGlobalFilter ? state.search : "",
      };

      return query as ConfigQuery<TColumns>;
    },
  });
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
