import type {
  Column,
  ColumnFilter,
  RowData,
  Table,
} from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  ColumnFilterItem,
  FilterOperator,
  FilterOperatorOption,
  FilterVariant,
} from "@/lib/data-table-types";

import { formatDate } from "@/lib/format";

export const FILTER_VARIANTS = [
  "text",
  "number",
  "range",
  "date",
  "dateRange",
  "boolean",
  "select",
  "multiSelect",
] as const;

export const FILTER_OPERATORS = [
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

export const JOIN_OPERATORS = ["and", "or"] as const;

export const SORT_ORDERS = [
  { label: "Asc", value: "asc" },
  { label: "Desc", value: "desc" },
] as const;

const TEXT_OPERATORS = [
  { label: "Contains", value: "iLike" },
  { label: "Does not contain", value: "notILike" },
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const NUMERIC_OPERATORS = [
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

const DATE_OPERATORS = [
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

const SELECT_OPERATORS = [
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const MULTI_SELECT_OPERATORS = [
  { label: "Has any of", value: "inArray" },
  { label: "Has none of", value: "notInArray" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
] satisfies FilterOperatorOption[];

const BOOLEAN_OPERATORS = [
  { label: "Is", value: "eq" },
  { label: "Is not", value: "ne" },
] satisfies FilterOperatorOption[];

const MULTI_VALUE_FILTER_VARIANTS = [
  "select",
  "multiSelect",
  "range",
  "dateRange",
] satisfies FilterVariant[];

const FILTER_OPERATORS_BY_VARIANT: Record<
  FilterVariant,
  FilterOperatorOption[]
> = {
  text: TEXT_OPERATORS,
  number: NUMERIC_OPERATORS,
  range: NUMERIC_OPERATORS,
  date: DATE_OPERATORS,
  dateRange: DATE_OPERATORS,
  boolean: BOOLEAN_OPERATORS,
  select: SELECT_OPERATORS,
  multiSelect: MULTI_SELECT_OPERATORS,
};

function getColumnVar(columnId: string, property: "size" | "offset") {
  const name = columnId.replace(
    /[^a-zA-Z0-9-]/g,
    (char) => `_${char.codePointAt(0)?.toString(16)}_`,
  );
  return `--column-${name}-${property}`;
}

export function getColumnPinningStyle<TData extends RowData>(
  column: Column<DataTableFeatures, TData>,
): React.CSSProperties {
  const isPinned = column.getIsPinned();

  return {
    insetInlineStart:
      isPinned === "start"
        ? `var(${getColumnVar(column.id, "offset")})`
        : undefined,
    insetInlineEnd:
      isPinned === "end"
        ? `var(${getColumnVar(column.id, "offset")})`
        : undefined,
    opacity: isPinned ? 0.97 : 1,
    position: isPinned ? "sticky" : "relative",
    width: `var(${getColumnVar(column.id, "size")})`,
    zIndex: isPinned ? 1 : undefined,
  };
}

export function getColumnSizingStyle<TData extends RowData>(
  table: Table<DataTableFeatures, TData>,
): React.CSSProperties {
  const style: Record<string, string> = {
    minWidth: `${table.getTotalSize()}px`,
  };

  for (const header of table.getFlatHeaders()) {
    style[getColumnVar(header.column.id, "size")] = `${header.getSize()}px`;
  }

  for (const { column } of table.getLeafHeaders()) {
    const isPinned = column.getIsPinned();
    if (!isPinned) continue;

    const offset =
      isPinned === "start" ? column.getStart("start") : column.getAfter("end");
    style[getColumnVar(column.id, "offset")] = `${offset}px`;
  }

  return style;
}

export function getFilterOperators(filterVariant: FilterVariant) {
  return FILTER_OPERATORS_BY_VARIANT[filterVariant] ?? [];
}

/** The operator a new filter starts with in the filter list and menu. */
export function getDefaultFilterOperator(filterVariant: FilterVariant) {
  const operators = getFilterOperators(filterVariant);

  return operators[0]?.value ?? (filterVariant === "text" ? "iLike" : "eq");
}

export function getIsEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function getIsValuelessOperator(operator: FilterOperator) {
  return operator === "isEmpty" || operator === "isNotEmpty";
}

export function coerceFilterValue(
  operator: FilterOperator,
  value: string | string[],
) {
  if (getIsValuelessOperator(operator)) return "";

  if (operator === "inArray" || operator === "notInArray") {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  }

  if (operator === "isBetween") {
    return Array.isArray(value) ? value : [value, ""];
  }

  if (Array.isArray(value)) return value.find((item) => item !== "") ?? "";

  return value;
}

export function getDefaultFilter<TData extends RowData>(
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

export function getFilterTimestamp(date: Date | undefined) {
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

export function stringifyFilterValue(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value as string | number | boolean | bigint);
}

export function getIsMultiValueVariant(variant: FilterVariant) {
  return MULTI_VALUE_FILTER_VARIANTS.includes(variant);
}

/**
 * The operator `column.setFilterValue()` applies. Selects match any of the
 * values and ranges match between both bounds.
 */
export function getPlainFilterOperator(variant: FilterVariant): FilterOperator {
  if (variant === "select" || variant === "multiSelect") return "inArray";
  if (variant === "range" || variant === "dateRange") return "isBetween";
  return getDefaultFilterOperator(variant);
}

/**
 * Whether a filter is a plain filter: the one `column.getFilterValue()` and
 * `column.setFilterValue()` read and write, with the variant's plain operator
 * and a value of the matching shape.
 */
export function getIsPlainFilter(filter: ColumnFilterItem) {
  return (
    filter.operator === getPlainFilterOperator(filter.variant) &&
    Array.isArray(filter.value) === getIsMultiValueVariant(filter.variant)
  );
}

export function getPlainFilterId(columnId: string) {
  return `${columnId}-filter`;
}

/**
 * Creates a plain filter from a column filter value (e.g. `["todo", "done"]`
 * or `[1, 5]`). Returns `null` for empty values.
 */
export function createPlainFilter<TColumnId extends string>(
  id: TColumnId,
  variant: FilterVariant,
  value: unknown,
): ColumnFilterItem<TColumnId> | null {
  if (value === undefined || value === null || value === "") return null;

  const operator = getPlainFilterOperator(variant);
  const filterId = getPlainFilterId(id);

  if (getIsMultiValueVariant(variant)) {
    const values = (Array.isArray(value) ? value : [value]).map(
      stringifyFilterValue,
    );
    if (values.every((item) => item === "")) return null;
    return { id, variant, operator, value: values, filterId };
  }

  if (Array.isArray(value)) return null;

  return {
    id,
    variant,
    operator,
    value: stringifyFilterValue(value),
    filterId,
  };
}

/**
 * Fills in a `columnFilters` item. Plain filters (no `operator`) get the
 * variant's plain operator, and their value becomes filter strings.
 */
export function normalizeColumnFilter(
  filter: ColumnFilter,
  variant: FilterVariant,
): ColumnFilterItem {
  const filterId = filter.filterId ?? getPlainFilterId(filter.id);

  if (filter.operator) {
    return {
      id: filter.id,
      variant: filter.variant ?? variant,
      operator: filter.operator,
      value: Array.isArray(filter.value)
        ? filter.value.map(stringifyFilterValue)
        : stringifyFilterValue(filter.value),
      filterId,
    };
  }

  const item = createPlainFilter(filter.id, variant, filter.value);
  if (item) return { ...item, filterId };

  return {
    id: filter.id,
    variant,
    operator: getPlainFilterOperator(variant),
    value: getIsMultiValueVariant(variant) ? [] : "",
    filterId,
  };
}

export function getPlainFilterValue(filter: ColumnFilterItem): unknown {
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

export function getActiveFilters<TFilterItem extends ColumnFilterItem>(
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
