import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { z } from "zod";

import type {
  ColumnFilterItem,
  ColumnSortItem,
  DataTableQuery,
  DataTableUrlFormat,
  FilterVariant,
  JoinOperator,
} from "@/lib/data-table-types";

import {
  FILTER_OPERATORS,
  FILTER_VARIANTS,
  getIsMultiValueVariant,
  getValidFilters,
  JOIN_OPERATORS,
  toColumnFilterItem,
} from "@/lib/data-table-utils";

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

/**
 * Parses the `sort` param, either `createdAt.desc,title.asc` or JSON. Pass
 * `columnIds` to reject unknown columns and to narrow the parsed ids to them.
 * `urlFormat` only picks how sorting is written.
 */
export const getSortingStateParser = <TColumnId extends string = string>(
  columnIds?: readonly TColumnId[] | Set<TColumnId>,
  urlFormat: DataTableUrlFormat = "compact",
) => {
  const validIds = toIdSet(columnIds);

  return createParser<ColumnSortItem<TColumnId>[]>({
    parse: (value) => {
      const sorting = parseSorting(value);
      return sorting && getHasKnownIds(sorting, validIds) ? sorting : null;
    },
    serialize: (value) => {
      if (urlFormat === "json") return JSON.stringify(value);

      const compact = value
        .map((item) => `${item.id}.${item.desc ? "desc" : "asc"}`)
        .join(",");
      const parsed = parseSorting(compact);

      // Ids with a comma, or a first id starting with `[`, don't round-trip.
      return parsed && getIsSameSorting(parsed, value)
        ? compact
        : JSON.stringify(value);
    },
    eq: getIsSameSorting,
  });
};

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(FILTER_VARIANTS),
  operator: z.enum(FILTER_OPERATORS),
  filterId: z.string(),
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

/**
 * Parses the `filters` param. Pass `columnIds` to reject unknown columns and
 * to narrow the parsed ids to them.
 */
export const getFiltersStateParser = <TColumnId extends string = string>(
  columnIds?: readonly TColumnId[] | Set<TColumnId>,
) => {
  const validIds = toIdSet(columnIds);

  return createParser<ColumnFilterItem<TColumnId>[]>({
    parse: (value) => {
      try {
        const result = z.array(filterItemSchema).safeParse(JSON.parse(value));

        if (!result.success || !getHasKnownIds(result.data, validIds)) {
          return null;
        }

        return result.data;
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

interface DataTableSearchParamsOptions<
  TFilterColumnId extends string,
  TSortColumnId extends string,
> {
  /**
   * Filterable column ids mapped to their filter variant. Needed to read
   * per-column params (`?status=todo,done`) and to reject unknown ids.
   */
  filterableColumns: Record<TFilterColumnId, FilterVariant>;
  /** Sortable column ids. Without it, sorts on any id are accepted. */
  sortableColumns?: readonly TSortColumnId[];
  defaultSorting?: ColumnSortItem<NoInfer<TSortColumnId>>[];
  defaultPerPage?: number;
}

/**
 * The nuqs parsers for every URL param a data table writes. Spread the
 * result into `createSearchParamsCache`, or use the individual parsers.
 */
export function getDataTableSearchParams<
  TFilterColumnId extends string,
  TSortColumnId extends string = string,
>({
  filterableColumns,
  sortableColumns,
  defaultSorting = [],
  defaultPerPage = 10,
}: DataTableSearchParamsOptions<TFilterColumnId, TSortColumnId>) {
  const filterIds = Object.keys(filterableColumns) as TFilterColumnId[];

  const columnParsers = Object.fromEntries(
    filterIds.map((id) => [
      id,
      getIsMultiValueVariant(filterableColumns[id])
        ? parseAsArrayOf(parseAsString).withDefault([])
        : parseAsString.withDefault(""),
    ]),
  );

  return {
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(defaultPerPage),
    sort: getSortingStateParser(sortableColumns).withDefault(defaultSorting),
    filters: getFiltersStateParser(filterIds).withDefault([]),
    joinOperator: parseAsStringEnum([...JOIN_OPERATORS]).withDefault("and"),
    ...columnParsers,
  };
}

interface DataTableSearch<
  TFilterColumnId extends string,
  TSortColumnId extends string,
> {
  page: number;
  perPage: number;
  sort: ColumnSortItem<TSortColumnId>[];
  filters: ColumnFilterItem<TFilterColumnId>[];
  joinOperator: JoinOperator;
}

/**
 * Normalizes parsed search params into one `DataTableQuery`, regardless of
 * whether filters arrived as per-column params or inside `filters`. This
 * mirrors how `useDataTable` reads the URL, so server and client agree.
 * Server adapters (Drizzle, Supabase, ...) only need to handle this shape.
 */
export function getDataTableQuery<
  TFilterColumnId extends string,
  TSortColumnId extends string,
>(
  search: DataTableSearch<TFilterColumnId, TSortColumnId> &
    Partial<Record<NoInfer<TFilterColumnId>, unknown>>,
  filterableColumns: Record<TFilterColumnId, FilterVariant>,
): DataTableQuery<TFilterColumnId, TSortColumnId> {
  const filterIds = Object.keys(filterableColumns) as TFilterColumnId[];

  const keyFilters = filterIds.flatMap((id) => {
    const item = toColumnFilterItem(id, filterableColumns[id], search[id]);
    return item ? [item] : [];
  });

  return {
    page: search.page,
    perPage: search.perPage,
    sorting: search.sort,
    filters: getValidFilters([...search.filters, ...keyFilters]),
    joinOperator: search.joinOperator,
  };
}

function parseSorting(value: string): ColumnSortItem[] | null {
  if (value.startsWith("[")) {
    try {
      const result = z.array(sortingItemSchema).safeParse(JSON.parse(value));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }

  const sorting: ColumnSortItem[] = [];

  for (const part of value.split(",")) {
    const index = part.lastIndexOf(".");
    const order = part.slice(index + 1);

    if (index <= 0 || (order !== "asc" && order !== "desc")) return null;

    sorting.push({ id: part.slice(0, index), desc: order === "desc" });
  }

  return sorting;
}

function getIsSameSorting(a: ColumnSortItem[], b: ColumnSortItem[]) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) => item.id === b[index]?.id && item.desc === b[index]?.desc,
    )
  );
}

function toIdSet<TColumnId extends string>(
  ids?: readonly TColumnId[] | Set<TColumnId>,
) {
  if (!ids) return null;
  return ids instanceof Set ? ids : new Set(ids);
}

function getHasKnownIds<
  TColumnItem extends { id: string },
  TColumnId extends string,
>(
  items: TColumnItem[],
  ids: ReadonlySet<TColumnId> | null,
): items is (TColumnItem & { id: TColumnId })[] {
  const knownIds: ReadonlySet<string> | null = ids;
  return knownIds === null || items.every((item) => knownIds.has(item.id));
}
