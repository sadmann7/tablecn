import { createParser, parseAsNativeArrayOf } from "nuqs/server";
import { z } from "zod";

import type {
  ColumnFilterItem,
  ColumnSortItem,
  FilterOperator,
  FilterVariant,
} from "@/lib/data-table-types";

import {
  FILTER_OPERATORS,
  getFilterOperators,
  getIsActiveFilter,
  getIsValidFilterValue,
  getIsValuelessOperator,
  getPlainFilterOperator,
  normalizeColumnFilter,
} from "@/lib/data-table-utils";

const OPERATORS_BY_NAME = new Map(
  getKeys(FILTER_OPERATORS).flatMap((operator): [string, FilterOperator][] => [
    [FILTER_OPERATORS[operator], operator],
    [operator.toLowerCase(), operator],
  ]),
);

const MAX_OPERATOR_PART_COUNT = 3;

const LIST_OPERATORS = new Set<FilterOperator>([
  "inArray",
  "notInArray",
  "isBetween",
]);

export function getSortingStateParser<TColumnId extends string = string>(
  columnIds?: readonly TColumnId[] | Set<TColumnId>,
) {
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

      // Ids with a comma, or a first id starting with `[`, don't round-trip
      return parsed && getIsSameSorting(parsed, value)
        ? compact
        : JSON.stringify(value);
    },
    eq: getIsSameSorting,
  });
}

export function getColumnFilterParser<TColumnId extends string>(
  id: TColumnId,
  variant: FilterVariant,
) {
  return parseAsNativeArrayOf(
    createParser<ColumnFilterItem<TColumnId>>({
      // nuqs drops items that parse to null, so `?title=` reads as no filter.
      parse: (param) => {
        const filter = parseColumnFilter(id, variant, param);
        return getIsActiveFilter(filter) && getIsValidFilterValue(filter)
          ? filter
          : null;
      },
      serialize: serializeColumnFilter,
      eq: (a, b) => serializeColumnFilter(a) === serializeColumnFilter(b),
    }),
  );
}

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

export function serializeColumnFilter(filter: ColumnFilterItem) {
  const name = FILTER_OPERATORS[filter.operator];
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

export function getColumnFilters(
  columnIds: readonly string[],
  values: Partial<Record<string, unknown>>,
): ColumnFilterItem[] {
  return columnIds.flatMap((id) => {
    const filters: unknown = values[id];
    if (!Array.isArray(filters)) return [];

    return filters.map((filter: ColumnFilterItem, index) => ({
      ...filter,
      filterId: `${id}-${index}`,
    }));
  });
}

export function getColumnFiltersKey(filters: ColumnFilterItem[]) {
  return filters
    .map((filter) => `${filter.id}=${serializeColumnFilter(filter)}`)
    .sort()
    .join("&");
}

const sortingItemSchema = z.object({
  id: z.string(),
  desc: z.boolean(),
});

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

function getIsSameSorting(a: ColumnSortItem[], b: ColumnSortItem[]) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) => item.id === b[index]?.id && item.desc === b[index]?.desc,
    )
  );
}

function splitFilterOperator(param: string, variant: FilterVariant) {
  const parts = param.split(".");

  for (
    let count = Math.min(MAX_OPERATOR_PART_COUNT, parts.length);
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

function getKeys<TKey extends string>(record: Record<TKey, unknown>) {
  return Object.keys(record).filter((key): key is TKey =>
    Object.hasOwn(record, key),
  );
}
