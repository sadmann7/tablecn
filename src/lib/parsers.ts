import {
  createParser,
  parseAsInteger,
  parseAsNativeArrayOf,
  parseAsStringEnum,
} from "nuqs/server";
import { z } from "zod";

import type {
  ColumnFilterItem,
  ColumnSortItem,
  DataTableQuery,
  FilterOperator,
  FilterVariant,
  JoinOperator,
} from "@/lib/data-table-types";

import {
  FILTER_OPERATORS,
  getActiveFilters,
  getFilterOperators,
  getIsValuelessOperator,
  getPlainFilterOperator,
  JOIN_OPERATORS,
  normalizeColumnFilter,
} from "@/lib/data-table-utils";

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

/**
 * Parses the `sort` param, either `createdAt.desc,title.asc` or JSON, and
 * writes the compact form. Pass `columnIds` to reject unknown columns and to
 * narrow the parsed ids to them.
 */
export const getSortingStateParser = <TColumnId extends string = string>(
  columnIds?: readonly TColumnId[] | Set<TColumnId>,
) => {
  const validIds = getIdSet(columnIds);

  return createParser<ColumnSortItem<TColumnId>[]>({
    parse: (value) => {
      const sorting = parseSorting(value);
      return sorting && getHasKnownIds(sorting, validIds) ? sorting : null;
    },
    serialize: (value) => {
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

/** How each operator is written in a filter param, after PostgREST. */
const URL_OPERATORS = {
  iLike: "ilike",
  notILike: "not.ilike",
  eq: "eq",
  ne: "neq",
  inArray: "in",
  notInArray: "not.in",
  isEmpty: "is.empty",
  isNotEmpty: "not.is.empty",
  lt: "lt",
  lte: "lte",
  gt: "gt",
  gte: "gte",
  isBetween: "between",
  isRelativeToToday: "rel",
} satisfies Record<FilterOperator, string>;

/** URL names and internal names, lowercased, so both read back. */
const OPERATORS_BY_NAME = new Map(
  FILTER_OPERATORS.flatMap((operator): [string, FilterOperator][] => [
    [URL_OPERATORS[operator], operator],
    [operator.toLowerCase(), operator],
  ]),
);

const MAX_OPERATOR_PARTS = 3;

const LIST_OPERATORS = new Set<FilterOperator>([
  "inArray",
  "notInArray",
  "isBetween",
]);

/**
 * Reads one filter param of a column, e.g. `todo,done` with the variant's
 * default operator, or `not.in.todo,done`, `gte.2`, `between.2,8`, and
 * `is.empty`. Operators are case-insensitive and also accept their internal
 * names (`notInArray`). A param without an operator the variant supports is
 * read as a value for the default operator.
 */
export function parseColumnFilter<TColumnId extends string>(
  id: TColumnId,
  variant: FilterVariant,
  param: string,
): ColumnFilterItem<TColumnId> {
  const { operator, rawValue } = splitFilterOperator(param, variant);

  const filter = normalizeColumnFilter(
    {
      id,
      variant,
      operator,
      value: getIsValuelessOperator(operator)
        ? ""
        : LIST_OPERATORS.has(operator)
          ? parseListValue(rawValue, operator)
          : rawValue,
    },
    variant,
  );

  return { ...filter, id };
}

/**
 * Writes one filter as a param, leaving out the operator when it's the
 * variant's default and the value still reads back the same.
 */
export function serializeColumnFilter(filter: ColumnFilterItem) {
  const name = URL_OPERATORS[filter.operator];
  if (getIsValuelessOperator(filter.operator)) return name;

  const rawValue = Array.isArray(filter.value)
    ? joinListValue(filter.value)
    : filter.value;

  if (filter.operator === getPlainFilterOperator(filter.variant)) {
    const implicit = parseColumnFilter(filter.id, filter.variant, rawValue);
    if (getIsSameFilter(implicit, filter)) return rawValue;
  }

  return `${name}.${rawValue}`;
}

/**
 * The parser for one column's filters. Each filter is its own param, so
 * `?hours=gte.2&hours=lte.8` holds two.
 */
export function getColumnFilterParser<TColumnId extends string>(
  id: TColumnId,
  variant: FilterVariant,
) {
  return parseAsNativeArrayOf(
    createParser<ColumnFilterItem<TColumnId>>({
      parse: (param) => parseColumnFilter(id, variant, param),
      serialize: serializeColumnFilter,
      eq: (a, b) => serializeColumnFilter(a) === serializeColumnFilter(b),
    }),
  );
}

/**
 * Joins per-column filters in column order, giving each a `filterId` that's
 * stable for the same URL.
 */
export function getColumnFilters<TColumnId extends string>(
  columnIds: readonly TColumnId[],
  getFilters: (id: TColumnId) => ColumnFilterItem<TColumnId>[],
) {
  return columnIds.flatMap((id) =>
    getFilters(id).map((filter, index) => ({
      ...filter,
      filterId: `${id}-${index}`,
    })),
  );
}

/**
 * Orders filters by where their column's param first appears in `search`,
 * keeping the order within a column. Columns missing from `search` go last.
 */
export function sortColumnFiltersBySearch<TFilter extends ColumnFilterItem>(
  filters: TFilter[],
  search: string | URLSearchParams,
) {
  const positions = new Map<string, number>();
  for (const key of new URLSearchParams(search).keys()) {
    if (!positions.has(key)) positions.set(key, positions.size);
  }

  return [...filters].sort(
    (a, b) =>
      (positions.get(a.id) ?? Number.POSITIVE_INFINITY) -
      (positions.get(b.id) ?? Number.POSITIVE_INFINITY),
  );
}

/**
 * A key that changes only when the URL a set of filters writes changes, so
 * reordering filters across columns keeps it.
 */
export function getColumnFiltersKey(filters: ColumnFilterItem[]) {
  return filters
    .map((filter) => `${filter.id}=${serializeColumnFilter(filter)}`)
    .sort()
    .join("&");
}

interface DataTableSearchParamsOptions<
  TFilterColumnId extends string,
  TSortColumnId extends string,
> {
  /** Filterable column ids mapped to their filter variant. */
  filterableColumns: Record<TFilterColumnId, FilterVariant>;
  /** Sortable column ids. Without it, sorts on any id are accepted. */
  sortableColumns?: readonly TSortColumnId[];
  defaultSorting?: ColumnSortItem<NoInfer<TSortColumnId>>[];
  defaultPerPage?: number;
}

/**
 * The nuqs parsers for every URL param a data table writes, including one per
 * filterable column. Spread the result into `createSearchParamsCache`, or use
 * the individual parsers.
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
  return {
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(defaultPerPage),
    sort: getSortingStateParser(sortableColumns).withDefault(defaultSorting),
    joinOperator: parseAsStringEnum([...JOIN_OPERATORS]).withDefault("and"),
    ...Object.fromEntries(
      getColumnIds(filterableColumns).map((id) => [
        id,
        getColumnFilterParser(id, filterableColumns[id]),
      ]),
    ),
  };
}

interface DataTableSearch<TSortColumnId extends string> {
  page: number;
  perPage: number;
  sort: ColumnSortItem<TSortColumnId>[];
  joinOperator: JoinOperator;
}

/**
 * Normalizes parsed search params into one `DataTableQuery`, joining the
 * per-column filter params and dropping filters without a value the same way
 * `useDataTable` does, so server and client agree. Server adapters (Drizzle,
 * Supabase, ...) only need to handle this shape.
 */
export function getDataTableQuery<
  TFilterColumnId extends string,
  TSortColumnId extends string,
>(
  search: DataTableSearch<TSortColumnId> &
    Partial<Record<NoInfer<TFilterColumnId>, unknown>>,
  filterableColumns: Record<TFilterColumnId, FilterVariant>,
): DataTableQuery<TFilterColumnId, TSortColumnId> {
  const filters = getColumnFilters(getColumnIds(filterableColumns), (id) => {
    const value = search[id];
    if (!Array.isArray(value)) return [];
    return value.filter(getIsColumnFilterItem).map((item) => ({ ...item, id }));
  });

  return {
    page: search.page,
    perPage: search.perPage,
    sorting: search.sort,
    filters: getActiveFilters(filters),
    joinOperator: search.joinOperator,
  };
}

/**
 * Splits a leading operator off a param, trying the longest name first since
 * some contain dots (`not.is.empty`). A word only counts as an operator when
 * the variant supports it and a value follows, unless it takes none, so
 * `title=in` and `title=in.progress` search for that text.
 */
function splitFilterOperator(param: string, variant: FilterVariant) {
  const parts = param.split(".");

  for (
    let count = Math.min(MAX_OPERATOR_PARTS, parts.length);
    count > 0;
    count--
  ) {
    const operator = OPERATORS_BY_NAME.get(
      parts.slice(0, count).join(".").toLowerCase(),
    );
    if (!operator || !getIsVariantOperator(variant, operator)) continue;
    if (count === parts.length && !getIsValuelessOperator(operator)) continue;

    return { operator, rawValue: parts.slice(count).join(".") };
  }

  return { operator: getPlainFilterOperator(variant), rawValue: param };
}

function getIsVariantOperator(
  variant: FilterVariant,
  operator: FilterOperator,
) {
  return (
    operator === getPlainFilterOperator(variant) ||
    getFilterOperators(variant).some((option) => option.value === operator)
  );
}

/**
 * Reads a comma separated list. Items are trimmed, and items holding a comma
 * are quoted (`"a,b"`), with `""` for a quote inside.
 */
function parseListValue(rawValue: string, operator: FilterOperator) {
  const items: string[] = [];
  let item = "";
  let isQuoted = false;
  let wasQuoted = false;

  for (let index = 0; index < rawValue.length; index++) {
    const char = rawValue[index];

    if (char === '"') {
      if (isQuoted && rawValue[index + 1] === '"') {
        item += char;
        index++;
      } else {
        isQuoted = !isQuoted;
        wasQuoted = true;
      }
    } else if (char === "," && !isQuoted) {
      items.push(wasQuoted ? item : item.trim());
      item = "";
      wasQuoted = false;
    } else {
      item += char;
    }
  }
  if (rawValue !== "") items.push(wasQuoted ? item : item.trim());

  if (operator === "isBetween") return [items[0] ?? "", items[1] ?? ""];
  return items.filter((value) => value !== "");
}

function joinListValue(values: string[]) {
  return values
    .map((value) =>
      /[,"]/.test(value) || value !== value.trim()
        ? `"${value.replaceAll('"', '""')}"`
        : value,
    )
    .join(",");
}

function getIsSameFilter(a: ColumnFilterItem, b: ColumnFilterItem) {
  if (a.operator !== b.operator) return false;
  if (!Array.isArray(a.value) || !Array.isArray(b.value)) {
    return a.value === b.value;
  }
  const otherValue = b.value;
  return (
    a.value.length === otherValue.length &&
    a.value.every((item, index) => item === otherValue[index])
  );
}

function getIsColumnFilterItem(value: unknown): value is ColumnFilterItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "operator" in value &&
    "variant" in value &&
    "value" in value
  );
}

function getColumnIds<TColumnId extends string>(
  columns: Record<TColumnId, FilterVariant>,
) {
  return Object.keys(columns).filter((id): id is TColumnId =>
    Object.hasOwn(columns, id),
  );
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
