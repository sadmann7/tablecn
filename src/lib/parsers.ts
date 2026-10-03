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
  FilterOperator,
  FilterVariant,
  JoinOperator,
} from "@/lib/data-table-types";

import {
  FILTER_OPERATORS,
  FILTER_VARIANTS,
  getFilterOperators,
  getIsMultiValueVariant,
  getActiveFilters,
  getPlainFilterOperator,
  JOIN_OPERATORS,
  createPlainFilter,
} from "@/lib/data-table-utils";

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

interface UrlFormatOptions {
  /** How the param is written. Both formats are always read. */
  urlFormat?: DataTableUrlFormat;
}

/**
 * Parses the `sort` param, either `createdAt.desc,title.asc` or JSON, and
 * writes it in `urlFormat`. Pass `columnIds` to reject unknown columns and to
 * narrow the parsed ids to them.
 */
export const getSortingStateParser = <TColumnId extends string = string>(
  columnIds?: readonly TColumnId[] | Set<TColumnId>,
  { urlFormat = "compact" }: UrlFormatOptions = {},
) => {
  const validIds = getIdSet(columnIds);

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

const filterOperatorSchema = z.enum(FILTER_OPERATORS);

const filterItemSchema = z.object({
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  variant: z.enum(FILTER_VARIANTS).optional(),
  operator: filterOperatorSchema,
  filterId: z.string().optional(),
});

export type FilterItemSchema = z.infer<typeof filterItemSchema>;

const ARRAY_VALUE_OPERATORS = new Set<FilterOperator>([
  "inArray",
  "notInArray",
  "isBetween",
]);

/**
 * Parses the `filters` param, either `status.inArray.todo|done,title.iLike.fix`
 * or JSON, and writes it in `urlFormat`. Pass `filterableColumns` to read
 * compact filters, which leave the variant to the column, and to reject
 * unknown columns and operators the variant doesn't support.
 */
export const getFiltersStateParser = <TColumnId extends string = string>(
  filterableColumns?: Record<TColumnId, FilterVariant>,
  { urlFormat = "compact" }: UrlFormatOptions = {},
) =>
  createParser<ColumnFilterItem<TColumnId>[]>({
    parse: (value) => {
      const items = value.startsWith("[")
        ? parseJsonFilters(value)
        : parseCompactFilters(value);
      return items ? resolveFilters(items, filterableColumns) : null;
    },
    serialize: (value) => {
      const json = JSON.stringify(
        value.map(({ id, variant, operator, value }) => ({
          id,
          variant,
          operator,
          value,
        })),
      );
      if (urlFormat === "json") return json;

      const compact = value.map(serializeCompactFilter).join(",");
      const parsed = parseCompactFilters(compact);

      // Ids with `.` or `,`, values with `,` or `|`, array values on single
      // value operators, or a first id starting with `[` don't round-trip.
      return parsed && getIsSameFilters(parsed, value) ? compact : json;
    },
    eq: getIsSameFilters,
  });

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
  /** How `sort` and `filters` are written, e.g. by `createSerializer`. */
  urlFormat?: DataTableUrlFormat;
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
  urlFormat,
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
    sort: getSortingStateParser(sortableColumns, { urlFormat }).withDefault(
      defaultSorting,
    ),
    filters: getFiltersStateParser(filterableColumns, {
      urlFormat,
    }).withDefault([]),
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

  const plainFilters = filterIds.flatMap((id) => {
    const item = createPlainFilter(id, filterableColumns[id], search[id]);
    return item ? [item] : [];
  });

  return {
    page: search.page,
    perPage: search.perPage,
    sorting: search.sort,
    filters: getActiveFilters([...search.filters, ...plainFilters]),
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

function parseJsonFilters(value: string): FilterItemSchema[] | null {
  try {
    const result = z.array(filterItemSchema).safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Reads `id.operator.value`, splitting on the first two dots only. */
function parseCompactFilters(value: string): FilterItemSchema[] | null {
  const items: FilterItemSchema[] = [];

  for (const part of value.split(",")) {
    const idEnd = part.indexOf(".");
    if (idEnd <= 0) return null;

    const operatorEnd = part.indexOf(".", idEnd + 1);
    const operator = filterOperatorSchema.safeParse(
      part.slice(idEnd + 1, operatorEnd === -1 ? undefined : operatorEnd),
    );
    if (!operator.success) return null;

    const rawValue = operatorEnd === -1 ? "" : part.slice(operatorEnd + 1);

    items.push({
      id: part.slice(0, idEnd),
      operator: operator.data,
      value: !ARRAY_VALUE_OPERATORS.has(operator.data)
        ? rawValue
        : rawValue === ""
          ? []
          : rawValue.split("|"),
    });
  }

  return items;
}

function serializeCompactFilter({ id, operator, value }: ColumnFilterItem) {
  const rawValue = Array.isArray(value) ? value.join("|") : value;
  return rawValue === ""
    ? `${id}.${operator}`
    : `${id}.${operator}.${rawValue}`;
}

/**
 * Takes each variant from its column, falling back to the one in legacy JSON,
 * and gives each filter a stable id for the filter list.
 */
function resolveFilters<TColumnId extends string>(
  items: FilterItemSchema[],
  filterableColumns?: Record<TColumnId, FilterVariant>,
): ColumnFilterItem<TColumnId>[] | null {
  const variants: Partial<Record<string, FilterVariant>> | undefined =
    filterableColumns;
  const filters: ColumnFilterItem[] = [];

  for (const [
    index,
    { id, operator, value, variant, filterId },
  ] of items.entries()) {
    const columnVariant = variants
      ? Object.hasOwn(variants, id)
        ? variants[id]
        : undefined
      : variant;

    if (
      !columnVariant ||
      (operator !== getPlainFilterOperator(columnVariant) &&
        !getFilterOperators(columnVariant).some(
          (option) => option.value === operator,
        ))
    ) {
      return null;
    }

    filters.push({
      id,
      variant: columnVariant,
      operator,
      value,
      filterId: filterId ?? `${id}-${index}`,
    });
  }

  return getHasKnownFilterIds(filters, filterableColumns) ? filters : null;
}

function getIsSameFilters(
  a: Pick<ColumnFilterItem, "id" | "operator" | "value">[],
  b: Pick<ColumnFilterItem, "id" | "operator" | "value">[],
) {
  return (
    a.length === b.length &&
    a.every((filter, index) => {
      const other = b[index];
      if (filter.id !== other?.id || filter.operator !== other.operator) {
        return false;
      }
      const otherValue = other.value;
      if (!Array.isArray(filter.value) || !Array.isArray(otherValue)) {
        return filter.value === otherValue;
      }
      return (
        filter.value.length === otherValue.length &&
        filter.value.every((item, itemIndex) => item === otherValue[itemIndex])
      );
    })
  );
}

function getHasKnownFilterIds<TColumnId extends string>(
  filters: ColumnFilterItem[],
  filterableColumns?: Record<TColumnId, FilterVariant>,
): filters is ColumnFilterItem<TColumnId>[] {
  return (
    !filterableColumns ||
    filters.every((filter) => Object.hasOwn(filterableColumns, filter.id))
  );
}

function getIsSameSorting(a: ColumnSortItem[], b: ColumnSortItem[]) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) => item.id === b[index]?.id && item.desc === b[index]?.desc,
    )
  );
}

function getIdSet<TColumnId extends string>(
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
