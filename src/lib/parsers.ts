import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { z } from "zod";

import type {
  DataTableQuery,
  ExtendedColumnFilter,
  ExtendedColumnSort,
  FilterVariant,
} from "@/lib/data-table-types";

import {
  dataTableConfig,
  getValidFilters,
  toColumnFilterItem,
} from "@/lib/data-table-utils";

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

export const getSortingStateParser = <TData>(
  columnIds?: string[] | Set<string>,
) => {
  const validKeys = columnIds
    ? columnIds instanceof Set
      ? columnIds
      : new Set(columnIds)
    : null;

  return createParser({
    parse: (value) => {
      try {
        const parsed = JSON.parse(value);
        const result = z.array(sortingItemSchema).safeParse(parsed);

        if (!result.success) return null;

        if (validKeys && result.data.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return result.data as ExtendedColumnSort<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every(
        (item, index) =>
          item.id === b[index]?.id && item.desc === b[index]?.desc,
      ),
  });
};

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(dataTableConfig.filterVariants),
  operator: z.enum(dataTableConfig.operators),
  filterId: z.string(),
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

const MULTI_VALUE_VARIANTS: FilterVariant[] = [
  "select",
  "multiSelect",
  "range",
  "dateRange",
];

interface DataTableSearchParamsOptions<TData> {
  /**
   * Filterable column ids mapped to their filter variant. Needed to read
   * per-column params (`?status=todo,done`) and to reject unknown ids.
   */
  filterableColumns: Record<string, FilterVariant>;
  defaultSorting?: ExtendedColumnSort<TData>[];
  defaultPerPage?: number;
}

/**
 * The nuqs parsers for every URL param a data table writes. Spread the
 * result into `createSearchParamsCache`, or use the individual parsers.
 */
export function getDataTableSearchParams<TData>({
  filterableColumns,
  defaultSorting = [],
  defaultPerPage = 10,
}: DataTableSearchParamsOptions<TData>) {
  const columnIds = Object.keys(filterableColumns);

  const columnParsers = Object.fromEntries(
    Object.entries(filterableColumns).map(([id, variant]) => [
      id,
      MULTI_VALUE_VARIANTS.includes(variant)
        ? parseAsArrayOf(parseAsString).withDefault([])
        : parseAsString.withDefault(""),
    ]),
  );

  return {
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(defaultPerPage),
    sort: getSortingStateParser<TData>().withDefault(defaultSorting),
    filters: getFiltersStateParser<TData>(columnIds).withDefault([]),
    joinOperator: parseAsStringEnum([
      ...dataTableConfig.joinOperators,
    ]).withDefault("and"),
    ...columnParsers,
  };
}

/**
 * Normalizes parsed search params into one `DataTableQuery`, regardless of
 * whether simple filters arrived as per-column params or inside `filters`.
 * Server adapters (Drizzle, Supabase, ...) only need to handle this shape.
 */
export function getDataTableQuery<TData>(
  search: Record<string, unknown>,
  filterableColumns: Record<string, FilterVariant>,
): DataTableQuery<TData> {
  const advancedFilters = Array.isArray(search.filters)
    ? (search.filters as ExtendedColumnFilter<TData>[])
    : [];

  const simpleFilters = Object.entries(filterableColumns).flatMap(
    ([id, variant]) => {
      const item = toColumnFilterItem(id, variant, search[id]);
      return item ? [item as ExtendedColumnFilter<TData>] : [];
    },
  );

  return {
    page: typeof search.page === "number" ? search.page : 1,
    perPage: typeof search.perPage === "number" ? search.perPage : 10,
    sorting: Array.isArray(search.sort)
      ? (search.sort as ExtendedColumnSort<TData>[])
      : [],
    filters: getValidFilters([...advancedFilters, ...simpleFilters]),
    joinOperator: search.joinOperator === "or" ? "or" : "and",
  };
}

export const getFiltersStateParser = <TData>(
  columnIds?: string[] | Set<string>,
) => {
  const validKeys = columnIds
    ? columnIds instanceof Set
      ? columnIds
      : new Set(columnIds)
    : null;

  return createParser({
    parse: (value) => {
      try {
        const parsed = JSON.parse(value);
        const result = z.array(filterItemSchema).safeParse(parsed);

        if (!result.success) return null;

        if (validKeys && result.data.some((item) => !validKeys.has(item.id))) {
          return null;
        }

        return result.data as ExtendedColumnFilter<TData>[];
      } catch {
        return null;
      }
    },
    serialize: (value) => JSON.stringify(value),
    eq: (a, b) =>
      a.length === b.length &&
      a.every(
        (filter, index) =>
          filter.id === b[index]?.id &&
          filter.value === b[index]?.value &&
          filter.variant === b[index]?.variant &&
          filter.operator === b[index]?.operator,
      ),
  });
};
