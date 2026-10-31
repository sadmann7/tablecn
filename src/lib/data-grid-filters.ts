import type { FilterFn, Row, RowData } from "@tanstack/react-table";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type {
  BooleanFilterOperator,
  ColumnValueReader,
  DateFilterOperator,
  FilterOperator,
  FilterValue,
  NumberFilterOperator,
  SelectFilterOperator,
  TextFilterOperator,
} from "@/lib/data-grid-types";

import { getColumnValueReader, stringifyUnknown } from "@/lib/data-grid-utils";

export const TEXT_FILTER_OPERATORS: readonly {
  label: string;
  value: TextFilterOperator;
}[] = [
  { label: "Contains", value: "contains" },
  { label: "Does not contain", value: "notContains" },
  { label: "Is", value: "equals" },
  { label: "Is not", value: "notEquals" },
  { label: "Starts with", value: "startsWith" },
  { label: "Ends with", value: "endsWith" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const NUMBER_FILTER_OPERATORS: readonly {
  label: string;
  value: NumberFilterOperator;
}[] = [
  { label: "Is", value: "equals" },
  { label: "Is not", value: "notEquals" },
  { label: "Is less than", value: "lessThan" },
  { label: "Is less than or equal to", value: "lessThanOrEqual" },
  { label: "Is greater than", value: "greaterThan" },
  { label: "Is greater than or equal to", value: "greaterThanOrEqual" },
  { label: "Is between", value: "isBetween" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const DATE_FILTER_OPERATORS: readonly {
  label: string;
  value: DateFilterOperator;
}[] = [
  { label: "Is", value: "equals" },
  { label: "Is not", value: "notEquals" },
  { label: "Is before", value: "before" },
  { label: "Is after", value: "after" },
  { label: "Is on or before", value: "onOrBefore" },
  { label: "Is on or after", value: "onOrAfter" },
  { label: "Is between", value: "isBetween" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const SELECT_FILTER_OPERATORS: readonly {
  label: string;
  value: SelectFilterOperator;
}[] = [
  { label: "Is", value: "is" },
  { label: "Is not", value: "isNot" },
  { label: "Has any of", value: "isAnyOf" },
  { label: "Has none of", value: "isNoneOf" },
  { label: "Is empty", value: "isEmpty" },
  { label: "Is not empty", value: "isNotEmpty" },
];

export const BOOLEAN_FILTER_OPERATORS: readonly {
  label: string;
  value: BooleanFilterOperator;
}[] = [
  { label: "Is", value: "isTrue" },
  { label: "Is not", value: "isFalse" },
];

const DATE_OPERATORS = new Set<FilterOperator>([
  "before",
  "after",
  "onOrBefore",
  "onOrAfter",
  "isBetween",
]);

export function getFilterValueForOperator(
  value: FilterValue["value"],
  operator: FilterOperator,
): FilterValue["value"] {
  if (operator === "isAnyOf" || operator === "isNoneOf") {
    if (Array.isArray(value)) return value;
    return typeof value === "string" && value !== "" ? [value] : undefined;
  }

  if ((operator === "is" || operator === "isNot") && Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getDefaultOperator(variant: string): FilterOperator {
  switch (variant) {
    case "number":
      return "equals";
    case "date":
      return "equals";
    case "select":
    case "multi-select":
      return "is";
    case "boolean":
      return "isTrue";
    default:
      return "contains";
  }
}

export function getOperatorsForVariant(variant: string): readonly {
  label: string;
  value: FilterOperator;
}[] {
  switch (variant) {
    case "number":
      return NUMBER_FILTER_OPERATORS;
    case "date":
      return DATE_FILTER_OPERATORS;
    case "select":
    case "multi-select":
      return SELECT_FILTER_OPERATORS;
    case "boolean":
      return BOOLEAN_FILTER_OPERATORS;
    default:
      return TEXT_FILTER_OPERATORS;
  }
}

interface PreparedFilter<TData extends RowData> {
  operator: FilterOperator;
  value: FilterValue["value"];
  endValue: FilterValue["endValue"];
  valueText: string;
  lowerValueText: string;
  valueDate: Date | null;
  endDate: Date | null;
  valueDateText: string | null;
  anyOf: Set<unknown> | null;
  readValue: ColumnValueReader<TData> | null;
}

export function getFilterFn<TData extends RowData>(): FilterFn<
  DataGridFeatures,
  TData
> {
  const preparedFilters = new WeakMap<object, PreparedFilter<TData>>();

  return (
    row: Row<DataGridFeatures, TData>,
    columnId: string,
    filterValue: unknown,
  ): boolean => {
    if (!filterValue || typeof filterValue !== "object") {
      return true;
    }

    const filter = getPreparedFilter(
      preparedFilters,
      filterValue as FilterValue,
    );
    const { operator, value, endValue } = filter;

    filter.readValue ??= getColumnValueReader(row.table.getColumn(columnId));
    const cellValue = filter.readValue(row);

    if (operator === "isEmpty") return getIsEmptyValue(cellValue);
    if (operator === "isNotEmpty") return !getIsEmptyValue(cellValue);
    if (operator === "isTrue") return cellValue === true;
    if (operator === "isFalse") return !cellValue;

    if (value === undefined || value === null || value === "") {
      return true;
    }

    if (operator === "contains" || operator === "notContains") {
      const isMatch = stringifyUnknown(cellValue)
        .toLowerCase()
        .includes(filter.lowerValueText);
      return operator === "contains" ? isMatch : !isMatch;
    }

    if (operator === "equals" || operator === "notEquals") {
      let isEqual: boolean;
      if (typeof cellValue === "number" && typeof value === "number") {
        isEqual = cellValue === value;
      } else if (cellValue instanceof Date && typeof value === "string") {
        isEqual = cellValue.toDateString() === filter.valueDateText;
      } else {
        isEqual =
          stringifyUnknown(cellValue).toLowerCase() === filter.lowerValueText;
      }
      return operator === "equals" ? isEqual : !isEqual;
    }

    if (operator === "startsWith") {
      return stringifyUnknown(cellValue)
        .toLowerCase()
        .startsWith(filter.lowerValueText);
    }

    if (operator === "endsWith") {
      return stringifyUnknown(cellValue)
        .toLowerCase()
        .endsWith(filter.lowerValueText);
    }

    if (typeof cellValue === "number" && typeof value === "number") {
      if (operator === "greaterThan") return cellValue > value;
      if (operator === "greaterThanOrEqual") return cellValue >= value;
      if (operator === "lessThan") return cellValue < value;
      if (operator === "lessThanOrEqual") return cellValue <= value;
      if (operator === "isBetween" && typeof endValue === "number") {
        return cellValue >= value && cellValue <= endValue;
      }
    }

    if (
      DATE_OPERATORS.has(operator) &&
      filter.valueDate &&
      (cellValue instanceof Date || typeof cellValue === "string")
    ) {
      const cellDate = new Date(cellValue);
      if (!Number.isNaN(cellDate.getTime())) {
        const filterDate = filter.valueDate;
        if (operator === "before") return cellDate < filterDate;
        if (operator === "after") return cellDate > filterDate;
        if (operator === "onOrBefore") return cellDate <= filterDate;
        if (operator === "onOrAfter") return cellDate >= filterDate;
        if (operator === "isBetween" && filter.endDate) {
          return cellDate >= filterDate && cellDate <= filter.endDate;
        }
      }
    }

    if (operator === "is" || operator === "isNot") {
      const isMatch = Array.isArray(cellValue)
        ? cellValue.some((item) => stringifyUnknown(item) === filter.valueText)
        : stringifyUnknown(cellValue) === filter.valueText;
      return operator === "is" ? isMatch : !isMatch;
    }

    if ((operator === "isAnyOf" || operator === "isNoneOf") && filter.anyOf) {
      const { anyOf } = filter;
      const isMatch = Array.isArray(cellValue)
        ? cellValue.some((item) => anyOf.has(stringifyUnknown(item)))
        : anyOf.has(stringifyUnknown(cellValue));
      return operator === "isAnyOf" ? isMatch : !isMatch;
    }

    return true;
  };
}

function getPreparedFilter<TData extends RowData>(
  preparedFilters: WeakMap<object, PreparedFilter<TData>>,
  filter: FilterValue,
) {
  let prepared = preparedFilters.get(filter);
  if (prepared) return prepared;

  const { operator, value, endValue } = filter;
  const valueText = stringifyUnknown(value);
  const valueDate = typeof value === "string" ? new Date(value) : null;
  prepared = {
    operator,
    value,
    endValue,
    valueText,
    lowerValueText: valueText.toLowerCase(),
    valueDate,
    endDate: typeof endValue === "string" ? new Date(endValue) : null,
    valueDateText: valueDate?.toDateString() ?? null,
    anyOf: Array.isArray(value) ? new Set<unknown>(value) : null,
    readValue: null,
  };
  preparedFilters.set(filter, prepared);
  return prepared;
}

function getIsEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
