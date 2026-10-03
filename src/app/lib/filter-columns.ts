import { addDays, endOfDay, startOfDay } from "date-fns";
import {
  type AnyColumn,
  and,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  not,
  notIlike,
  notInArray,
  or,
  type SQL,
  type Table,
} from "drizzle-orm";

import type { ColumnFilterItem, JoinOperator } from "@/lib/data-table-types";

import { isEmpty } from "@/db/utils";
import { parseFilterDate } from "@/lib/data-table-utils";

export function filterColumns<T extends Table>({
  table,
  filters,
  joinOperator,
}: {
  table: T;
  filters: ColumnFilterItem<Extract<keyof T["$inferSelect"], string>>[];
  joinOperator: JoinOperator;
}): SQL | undefined {
  const joinFn = joinOperator === "and" ? and : or;

  const conditions = filters.map((filter) => {
    const column = getColumn(table, filter.id);

    switch (filter.operator) {
      case "iLike":
        return filter.variant === "text" && typeof filter.value === "string"
          ? ilike(column, `%${filter.value}%`)
          : undefined;

      case "notILike":
        return filter.variant === "text" && typeof filter.value === "string"
          ? notIlike(column, `%${filter.value}%`)
          : undefined;

      case "eq":
        if (column.dataType === "boolean" && typeof filter.value === "string") {
          return eq(column, filter.value === "true");
        }
        if (filter.variant === "date" || filter.variant === "dateRange") {
          const start = getStartOfDay(filter.value);
          const end = getEndOfDay(filter.value);
          return start && end
            ? and(gte(column, start), lte(column, end))
            : undefined;
        }
        return eq(column, filter.value);

      case "ne":
        if (column.dataType === "boolean" && typeof filter.value === "string") {
          return ne(column, filter.value === "true");
        }
        if (filter.variant === "date" || filter.variant === "dateRange") {
          const start = getStartOfDay(filter.value);
          const end = getEndOfDay(filter.value);
          return start && end
            ? or(lt(column, start), gt(column, end))
            : undefined;
        }
        return ne(column, filter.value);

      case "inArray":
        if (Array.isArray(filter.value)) {
          return inArray(column, filter.value);
        }
        return undefined;

      case "notInArray":
        if (Array.isArray(filter.value)) {
          return notInArray(column, filter.value);
        }
        return undefined;

      case "lt":
      case "lte":
      case "gt":
      case "gte": {
        const compare = { lt, lte, gt, gte }[filter.operator];
        if (filter.variant === "number" || filter.variant === "range") {
          return compare(column, filter.value);
        }
        if (filter.variant !== "date" || typeof filter.value !== "string") {
          return undefined;
        }
        // `lt` and `lte` include the whole day, `gt` and `gte` start from it.
        const date =
          filter.operator === "lt" || filter.operator === "lte"
            ? getEndOfDay(filter.value)
            : getStartOfDay(filter.value);
        return date ? compare(column, date) : undefined;
      }

      case "isBetween":
        if (
          (filter.variant === "date" || filter.variant === "dateRange") &&
          Array.isArray(filter.value) &&
          filter.value.length === 2
        ) {
          const start = getStartOfDay(filter.value[0]);
          const end = getEndOfDay(filter.value[1]);
          return and(
            start ? gte(column, start) : undefined,
            end ? lte(column, end) : undefined,
          );
        }

        if (
          (filter.variant === "number" || filter.variant === "range") &&
          Array.isArray(filter.value) &&
          filter.value.length === 2
        ) {
          const firstValue =
            filter.value[0] && filter.value[0].trim() !== ""
              ? Number(filter.value[0])
              : null;
          const secondValue =
            filter.value[1] && filter.value[1].trim() !== ""
              ? Number(filter.value[1])
              : null;

          if (firstValue === null && secondValue === null) {
            return undefined;
          }

          return and(
            firstValue !== null ? gte(column, firstValue) : undefined,
            secondValue !== null ? lte(column, secondValue) : undefined,
          );
        }
        return undefined;

      case "isRelativeToToday":
        if (
          (filter.variant === "date" || filter.variant === "dateRange") &&
          typeof filter.value === "string"
        ) {
          const today = new Date();
          const [amount, unit] = filter.value.split(" ") ?? [];
          let startDate: Date;
          let endDate: Date;

          if (!amount || !unit) return undefined;

          switch (unit) {
            case "days":
              startDate = startOfDay(
                addDays(today, Number.parseInt(amount, 10)),
              );
              endDate = endOfDay(startDate);
              break;
            case "weeks":
              startDate = startOfDay(
                addDays(today, Number.parseInt(amount, 10) * 7),
              );
              endDate = endOfDay(addDays(startDate, 6));
              break;
            case "months":
              startDate = startOfDay(
                addDays(today, Number.parseInt(amount, 10) * 30),
              );
              endDate = endOfDay(addDays(startDate, 29));
              break;
            default:
              return undefined;
          }

          return and(gte(column, startDate), lte(column, endDate));
        }
        return undefined;

      case "isEmpty":
        return isEmpty(column);

      case "isNotEmpty":
        return not(isEmpty(column));

      default:
        throw new Error("Unsupported operator");
    }
  });

  const validConditions = conditions.filter(
    (condition) => condition !== undefined,
  );

  return validConditions.length > 0 ? joinFn(...validConditions) : undefined;
}

function getStartOfDay(value: unknown) {
  const date = parseFilterDate(value);
  return date ? startOfDay(date) : undefined;
}

function getEndOfDay(value: unknown) {
  const date = parseFilterDate(value);
  return date ? endOfDay(date) : undefined;
}

export function getColumn<T extends Table>(
  table: T,
  columnKey: keyof T,
): AnyColumn {
  return table[columnKey] as AnyColumn;
}
