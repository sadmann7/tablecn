/**
 * @see https://gist.github.com/rphlmr/0d1722a794ed5a16da0fdf6652902b15
 */

import { type AnyColumn, sql } from "drizzle-orm";
import { pgTableCreator } from "drizzle-orm/pg-core";

import { DATABASE_PREFIX } from "@/lib/constants";

export const pgTable = pgTableCreator((name) => `${DATABASE_PREFIX}_${name}`);

export function takeFirstOrNull<TItem>(items: TItem[]) {
  return items[0] ?? null;
}

export function takeFirstOrThrow<TItem>(items: TItem[], errorMessage?: string) {
  const first = takeFirstOrNull(items);

  if (!first) {
    throw new Error(errorMessage ?? "Item not found");
  }

  return first;
}

export function isEmpty<TColumn extends AnyColumn>(column: TColumn) {
  if (column.dataType === "string") {
    return sql<boolean>`
      case
        when ${column} is null then true
        when ${column} = '' then true
        else false
      end
    `;
  }

  if (column.dataType === "array" || column.dataType === "json") {
    return sql<boolean>`
      case
        when ${column} is null then true
        when ${column}::text = '[]' then true
        when ${column}::text = '{}' then true
        else false
      end
    `;
  }

  return sql<boolean>`${column} is null`;
}
