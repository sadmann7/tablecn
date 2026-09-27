import {
  type Row,
  type RowData,
  type RowModel,
  type Table,
  type TableFeatures,
  tableMemo,
} from "@tanstack/react-table";

import type { ColumnFilterItem, JoinOperator } from "@/lib/data-table-types";

import { getValidFilters } from "@/lib/data-table-utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Evaluates one filter condition against a cell value in the browser. This is
 * the client-side twin of the server adapters (e.g. the Drizzle adapter), so
 * every `FilterOperator` must be handled here as well.
 */
export function matchesFilter(
  cellValue: unknown,
  filter: Pick<ColumnFilterItem, "operator" | "variant" | "value">,
): boolean {
  const { operator, variant, value } = filter;
  const isDate = variant === "date" || variant === "dateRange";
  const isNumeric = variant === "number" || variant === "range";

  switch (operator) {
    case "iLike":
      return typeof value === "string"
        ? toText(cellValue).includes(value.toLowerCase())
        : true;

    case "notILike":
      return typeof value === "string"
        ? !toText(cellValue).includes(value.toLowerCase())
        : true;

    case "eq":
      if (variant === "boolean") return toBoolean(cellValue) === value;
      if (isDate) return isSameDay(cellValue, value);
      if (isNumeric) return toNumber(cellValue) === toNumber(value);
      return stringify(cellValue) === String(value);

    case "ne":
      if (variant === "boolean") return toBoolean(cellValue) !== value;
      if (isDate) return !isSameDay(cellValue, value);
      if (isNumeric) return toNumber(cellValue) !== toNumber(value);
      return stringify(cellValue) !== String(value);

    case "inArray":
      return Array.isArray(value) ? value.includes(stringify(cellValue)) : true;

    case "notInArray":
      return Array.isArray(value)
        ? !value.includes(stringify(cellValue))
        : true;

    case "lt":
    case "lte":
    case "gt":
    case "gte":
      return compare(cellValue, value, operator, isDate);

    case "isBetween":
      return isBetween(cellValue, value, isDate);

    case "isRelativeToToday":
      return isRelativeToToday(cellValue, value);

    case "isEmpty":
      return isEmptyValue(cellValue);

    case "isNotEmpty":
      return !isEmptyValue(cellValue);

    default:
      return true;
  }
}

export function matchesFilters(
  getValue: (columnId: string) => unknown,
  filters: ColumnFilterItem[],
  joinOperator: JoinOperator,
): boolean {
  if (filters.length === 0) return true;

  const test = (filter: ColumnFilterItem) =>
    matchesFilter(getValue(filter.id), filter);

  return joinOperator === "or" ? filters.some(test) : filters.every(test);
}

/**
 * Filtered row model that evaluates the `filters` slice with its
 * `joinOperator`. Register it in the `filteredRowModel` slot. TanStack skips
 * it when `manualFiltering` is set, i.e. the server already filtered.
 */
export function createDataTableFilteredRowModel<
  TFeatures extends TableFeatures,
  TData extends RowData,
>() {
  return (table: Table<TFeatures, TData>) => {
    const instance = table as unknown as FilteringInstance;

    return tableMemo({
      feature: "dataTableFilteringFeature",
      table,
      fnName: "table.getFilteredRowModel",
      memoDeps: () => [
        table.getPreFilteredRowModel(),
        instance.atoms.filters?.get(),
        instance.atoms.joinOperator?.get(),
      ],
      fn: () =>
        filterRows(
          table.getPreFilteredRowModel(),
          getValidFilters(instance.atoms.filters?.get() ?? []),
          instance.atoms.joinOperator?.get() ?? "and",
        ),
    });
  };
}

interface FilteringInstance {
  atoms: {
    filters?: { get: () => ColumnFilterItem[] };
    joinOperator?: { get: () => JoinOperator };
  };
}

function filterRows<TFeatures extends TableFeatures, TData extends RowData>(
  rowModel: RowModel<TFeatures, TData>,
  filters: ColumnFilterItem[],
  joinOperator: JoinOperator,
): RowModel<TFeatures, TData> {
  if (filters.length === 0) return rowModel;

  const rows: Row<TFeatures, TData>[] = [];
  const rowsById: Record<string, Row<TFeatures, TData>> = {};

  for (const row of rowModel.rows) {
    if (!matchesFilters((id) => row.getValue(id), filters, joinOperator)) {
      continue;
    }
    rows.push(row);
    rowsById[row.id] = row;
  }

  return { rows, flatRows: rows, rowsById };
}

function stringify(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value as string | number | boolean | bigint);
}

function toText(value: unknown) {
  return stringify(value).toLowerCase();
}

function toBoolean(value: unknown) {
  return value === true || value === "true" ? "true" : "false";
}

function toNumber(value: unknown) {
  if (value === "" || value == null) return Number.NaN;
  return typeof value === "number" ? value : Number(value);
}

function toTime(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? new Date(value).getTime() : numeric;
  }
  return Number.NaN;
}

function startOfDay(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function endOfDay(time: number) {
  const date = new Date(time);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function isSameDay(cellValue: unknown, value: unknown) {
  const cell = toTime(cellValue);
  const target = toTime(value);
  if (Number.isNaN(cell) || Number.isNaN(target)) return false;
  return cell >= startOfDay(target) && cell <= endOfDay(target);
}

function compare(
  cellValue: unknown,
  value: unknown,
  operator: "lt" | "lte" | "gt" | "gte",
  isDate: boolean,
) {
  if (Array.isArray(value)) return true;

  let cell: number;
  let target: number;

  if (isDate) {
    cell = toTime(cellValue);
    const time = toTime(value);
    target =
      operator === "lt" || operator === "lte"
        ? endOfDay(time)
        : startOfDay(time);
  } else {
    cell = toNumber(cellValue);
    target = toNumber(value);
  }

  if (Number.isNaN(cell) || Number.isNaN(target)) return false;

  switch (operator) {
    case "lt":
      return cell < target;
    case "lte":
      return cell <= target;
    case "gt":
      return cell > target;
    default:
      return cell >= target;
  }
}

function isBetween(cellValue: unknown, value: unknown, isDate: boolean) {
  if (!Array.isArray(value) || value.length !== 2) return true;

  const [rawStart, rawEnd] = value;
  const hasStart = stringify(rawStart).trim() !== "";
  const hasEnd = stringify(rawEnd).trim() !== "";

  if (!hasStart && !hasEnd) return true;

  const cell = isDate ? toTime(cellValue) : toNumber(cellValue);
  if (Number.isNaN(cell)) return false;

  if (isDate) {
    const start = hasStart ? startOfDay(toTime(rawStart)) : null;
    const end = hasEnd ? endOfDay(toTime(rawEnd)) : null;
    return (start === null || cell >= start) && (end === null || cell <= end);
  }

  const start = hasStart ? toNumber(rawStart) : null;
  const end = hasEnd ? toNumber(rawEnd) : null;

  // Mirrors the server adapter: a single bound behaves like `eq`.
  if (start !== null && end === null) return cell === start;
  if (start === null && end !== null) return cell === end;

  return (start === null || cell >= start) && (end === null || cell <= end);
}

function isRelativeToToday(cellValue: unknown, value: unknown) {
  if (typeof value !== "string") return true;

  const [amountRaw, unit] = value.split(" ");
  const amount = Number.parseInt(amountRaw ?? "", 10);
  if (Number.isNaN(amount) || !unit) return true;

  const today = Date.now();
  let start: number;
  let end: number;

  switch (unit) {
    case "days":
      start = startOfDay(today + amount * DAY_MS);
      end = endOfDay(start);
      break;
    case "weeks":
      start = startOfDay(today + amount * 7 * DAY_MS);
      end = endOfDay(start + 6 * DAY_MS);
      break;
    case "months":
      start = startOfDay(today + amount * 30 * DAY_MS);
      end = endOfDay(start + 29 * DAY_MS);
      break;
    default:
      return true;
  }

  const cell = toTime(cellValue);
  if (Number.isNaN(cell)) return false;
  return cell >= start && cell <= end;
}

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}
