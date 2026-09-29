import type { Column, ColumnFilter, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  ColumnFilterItem,
  FilterOperator,
  FilterOperatorOption,
  FilterVariant,
} from "@/lib/data-table-types";

import { formatDate } from "@/lib/format";

export const filterVariants = [
  "text",
  "number",
  "range",
  "date",
  "dateRange",
  "boolean",
  "select",
  "multiSelect",
] as const;

export const filterOperators = [
  "iLike",
  "notILike",
  "eq",
  "ne",
  "inArray",
  "notInArray",
  "isEmpty",
  "isNotEmpty",
  "lt",
  "lte",
  "gt",
  "gte",
  "isBetween",
  "isRelativeToToday",
] as const;

export const joinOperators = ["and", "or"] as const;

export const sortOrders = [
  { label: "Asc", value: "asc" },
  { label: "Desc", value: "desc" },
] as const;

const textOperators = [
  { label: "Contains", value: "iLike" },
  { label: "Does not contain", value: "notILike" },
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const numericOperators = [
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
  { label: "Is less than", value: "lt" },
  { label: "Is less than or equal to", value: "lte" },
  { label: "Is greater than", value: "gt" },
  { label: "Is greater than or equal to", value: "gte" },
  { label: "Is between", value: "isBetween" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const dateOperators = [
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
  { label: "Is before", value: "lt" },
  { label: "Is after", value: "gt" },
  { label: "Is on or before", value: "lte" },
  { label: "Is on or after", value: "gte" },
  { label: "Is between", value: "isBetween" },
  { label: "Is relative to today", value: "isRelativeToToday" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const selectOperators = [
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const multiSelectOperators = [
  { label: "Has any of", value: "inArray" },
  { label: "Has none of", value: "notInArray" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const booleanOperators = [
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
] satisfies FilterOperatorOption[];

const MULTI_VALUE_FILTER_VARIANTS: FilterVariant[] = [
  "select",
  "multiSelect",
  "range",
  "dateRange",
];

const filterOperatorsByVariant: Record<FilterVariant, FilterOperatorOption[]> =
  {
    text: textOperators,
    number: numericOperators,
    range: numericOperators,
    date: dateOperators,
    dateRange: dateOperators,
    boolean: booleanOperators,
    select: selectOperators,
    multiSelect: multiSelectOperators,
  };

export function getColumnPinningStyle<TData extends RowData>({
  column,
  withBorder = false,
}: {
  column: Column<DataTableFeatures, TData>;
  withBorder?: boolean;
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "start" && column.getIsLastColumn("start");
  const isFirstRightPinnedColumn =
    isPinned === "end" && column.getIsFirstColumn("end");

  return {
    boxShadow: withBorder
      ? isLastLeftPinnedColumn
        ? "-4px 0 4px -4px var(--border) inset"
        : isFirstRightPinnedColumn
          ? "4px 0 4px -4px var(--border) inset"
          : undefined
      : undefined,
    left: isPinned === "start" ? `${column.getStart("start")}px` : undefined,
    right: isPinned === "end" ? `${column.getAfter("end")}px` : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    background: isPinned ? "var(--background)" : "var(--background)",
    width: column.getSize(),
    zIndex: isPinned ? 1 : undefined,
  };
}

export function getFilterOperators(filterVariant: FilterVariant) {
  return filterOperatorsByVariant[filterVariant];
}

export function getDefaultFilterOperator(filterVariant: FilterVariant) {
  const operators = getFilterOperators(filterVariant);

  return operators[0]?.value ?? (filterVariant === "text" ? "iLike" : "eq");
}

export function getIsValuelessOperator(operator: FilterOperator) {
  return operator === "isEmpty" || operator === "isNotEmpty";
}

export function getColumnFilterDefaults<TData extends RowData>(
  column: Column<DataTableFeatures, TData>,
) {
  const variant = column.columnDef.meta?.variant ?? "text";

  return {
    id: column.id,
    variant,
    operator: getDefaultFilterOperator(variant),
    value: "",
  };
}

export function getSelectFilterValue(filter: ColumnFilterItem) {
  if (filter.variant === "multiSelect") {
    return Array.isArray(filter.value) ? filter.value : [];
  }

  return typeof filter.value === "string" ? filter.value : undefined;
}

export function getFilterDates(value: ColumnFilterItem["value"]) {
  return (Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((timestamp) => new Date(Number(timestamp)));
}

export function toFilterTimestamp(date: Date | undefined) {
  return date?.getTime().toString() ?? "";
}

export function getDateFilterLabel(filter: ColumnFilterItem) {
  const [startDate, endDate] = getFilterDates(filter.value);
  if (!startDate) return undefined;

  const start = formatDate(startDate, { month: "short" });
  if (
    filter.operator !== "isBetween" ||
    !endDate ||
    startDate.toDateString() === endDate.toDateString()
  ) {
    return start;
  }

  return `${start} - ${formatDate(endDate, { month: "short" })}`;
}

function toFilterString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value as string | number | boolean | bigint);
}

export function getIsMultiValueVariant(variant: FilterVariant) {
  return MULTI_VALUE_FILTER_VARIANTS.includes(variant);
}

export function getValueFilterOperator(variant: FilterVariant): FilterOperator {
  if (variant === "select" || variant === "multiSelect") return "inArray";
  if (variant === "range" || variant === "dateRange") return "isBetween";
  return getDefaultFilterOperator(variant);
}

/**
 * Whether a filter is a value filter: the one `column.getFilterValue()` and
 * `column.setFilterValue()` read and write, with the variant's value operator
 * and a value of the matching shape.
 */
export function getIsValueFilter(filter: ColumnFilterItem) {
  return (
    filter.operator === getValueFilterOperator(filter.variant) &&
    Array.isArray(filter.value) === getIsMultiValueVariant(filter.variant)
  );
}

/**
 * Converts a filter value (e.g. `["todo", "done"]` or `[1, 5]`) to a
 * filter item. Returns `null` for empty values.
 */
export function toColumnFilterItem<TColumnId extends string>(
  id: TColumnId,
  variant: FilterVariant,
  value: unknown,
): ColumnFilterItem<TColumnId> | null {
  if (value === undefined || value === null || value === "") return null;

  const operator = getValueFilterOperator(variant);
  const filterId = `${id}-filter`;

  if (getIsMultiValueVariant(variant)) {
    const values = (Array.isArray(value) ? value : [value]).map(toFilterString);
    if (values.every((item) => item === "")) return null;
    return { id, variant, operator, value: values, filterId };
  }

  if (Array.isArray(value)) return null;

  return { id, variant, operator, value: toFilterString(value), filterId };
}

/**
 * Fills in a `columnFilters` item. Value filters (no `operator`) get the
 * variant's value operator, and their value becomes filter strings.
 */
export function resolveColumnFilter(
  filter: ColumnFilter,
  variant: FilterVariant,
): ColumnFilterItem {
  const filterId = filter.filterId ?? `${filter.id}-filter`;

  if (filter.operator) {
    return {
      id: filter.id,
      variant: filter.variant ?? variant,
      operator: filter.operator,
      value: Array.isArray(filter.value)
        ? filter.value.map(toFilterString)
        : toFilterString(filter.value),
      filterId,
    };
  }

  const item = toColumnFilterItem(filter.id, variant, filter.value);
  if (item) return { ...item, filterId };

  return {
    id: filter.id,
    variant,
    operator: getValueFilterOperator(variant),
    value: getIsMultiValueVariant(variant) ? [] : "",
    filterId,
  };
}

/**
 * Per-column keys hold at most one value filter per column, so only write
 * them when each filter round-trips. They're read back in column order,
 * which doesn't change what the filters match.
 */
export function getCanWriteAsKeys(
  filters: ColumnFilterItem[],
  columnIds: string[],
) {
  const seenIds = new Set<string>();

  return filters.every((filter) => {
    if (!columnIds.includes(filter.id) || seenIds.has(filter.id)) return false;
    if (!getIsValueFilter(filter)) return false;
    if (!toColumnFilterItem(filter.id, filter.variant, filter.value)) {
      return false;
    }
    seenIds.add(filter.id);
    return true;
  });
}

export function toColumnFilterValue(filter: ColumnFilterItem): unknown {
  const { variant, value } = filter;

  if (variant === "select" || variant === "multiSelect") {
    return Array.isArray(value) ? value : [value];
  }

  if (variant === "range" || variant === "dateRange") {
    return Array.isArray(value)
      ? value.map((item) => (item === "" ? undefined : Number(item)))
      : value;
  }

  if (variant === "date") {
    return Array.isArray(value)
      ? value.map((item) => (item === "" ? undefined : Number(item)))
      : Number(value);
  }

  return value;
}

export function getValidFilters<TFilterItem extends ColumnFilterItem>(
  filters: TFilterItem[],
): TFilterItem[] {
  return filters.filter(
    (filter) =>
      getIsValuelessOperator(filter.operator) ||
      (Array.isArray(filter.value)
        ? filter.value.some((value) => value !== "")
        : filter.value !== "" &&
          filter.value !== null &&
          filter.value !== undefined),
  );
}
