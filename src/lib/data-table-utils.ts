import type { Column, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  ColumnFilterItem,
  FilterOperator,
  FilterOperatorOption,
  FilterVariant,
} from "@/lib/data-table-types";

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

function toFilterString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value as string | number | boolean | bigint);
}

const MULTI_VALUE_VARIANTS: FilterVariant[] = [
  "select",
  "multiSelect",
  "range",
  "dateRange",
];

/** Whether a variant's toolbar filter holds a list, e.g. `?status=a,b`. */
export function getIsMultiValueVariant(variant: FilterVariant) {
  return MULTI_VALUE_VARIANTS.includes(variant);
}

/** The operator a toolbar filter of this variant applies. */
export function getSimpleFilterOperator(
  variant: FilterVariant,
): FilterOperator {
  if (variant === "select" || variant === "multiSelect") return "inArray";
  if (variant === "range" || variant === "dateRange") return "isBetween";
  return getDefaultFilterOperator(variant);
}

/**
 * Whether a filter is one the toolbar can show and edit: the variant's
 * default operator with a value of the matching shape.
 */
export function getIsSimpleFilter(filter: ColumnFilterItem) {
  return (
    filter.operator === getSimpleFilterOperator(filter.variant) &&
    Array.isArray(filter.value) === getIsMultiValueVariant(filter.variant)
  );
}

/** The toolbar filter of a column, if it has one. */
export function getSimpleFilter<TFilterItem extends ColumnFilterItem>(
  filters: TFilterItem[],
  columnId: string,
): TFilterItem | undefined {
  return filters.find(
    (filter) => filter.id === columnId && getIsSimpleFilter(filter),
  );
}

/**
 * Converts a toolbar value (e.g. `["todo", "done"]` or `[1, 5]`) to a
 * filter item. Returns `null` for empty values.
 */
export function toColumnFilterItem<TColumnId extends string>(
  id: TColumnId,
  variant: FilterVariant,
  value: unknown,
): ColumnFilterItem<TColumnId> | null {
  if (value === undefined || value === null || value === "") return null;

  const operator = getSimpleFilterOperator(variant);
  const filterId = `${id}-filter`;

  if (getIsMultiValueVariant(variant)) {
    const values = (Array.isArray(value) ? value : [value]).map(toFilterString);
    if (values.every((item) => item === "")) return null;
    return { id, variant, operator, value: values, filterId };
  }

  if (Array.isArray(value)) return null;

  return { id, variant, operator, value: toFilterString(value), filterId };
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
      filter.operator === "isEmpty" ||
      filter.operator === "isNotEmpty" ||
      (Array.isArray(filter.value)
        ? filter.value.length > 0
        : filter.value !== "" &&
          filter.value !== null &&
          filter.value !== undefined),
  );
}
