import type { ColumnSort, Row, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  filterOperators,
  filterVariants,
  joinOperators,
} from "@/lib/data-table-utils";

export interface DataTableMeta {
  queryKeys?: QueryKeys;
}

export interface DataTableColumnMeta {
  label?: string;
  placeholder?: string;
  variant?: FilterVariant;
  options?: Option[];
  range?: [number, number];
  unit?: string;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
}

export interface QueryKeys {
  page: string;
  perPage: string;
  sort: string;
  filters: string;
  joinOperator: string;
}

export interface Option {
  label: string;
  value: string;
  count?: number;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
}

export type FilterOperator = (typeof filterOperators)[number];
export type FilterVariant = (typeof filterVariants)[number];
export type JoinOperator = (typeof joinOperators)[number];

/**
 * How filters and sorting are written to the URL. Both formats are always
 * read, so links keep working when the format changes.
 *
 * - `"compact"`: toolbar filters get one query param per column, e.g.
 *   `?status=todo,done&title=fix`, and sorting is `?sort=createdAt.desc`.
 *   Filters the toolbar can't express (other operators, several per column)
 *   fall back to JSON in the `filters` param.
 * - `"json"`: filters and sorting are written as JSON.
 */
export type DataTableUrlFormat = "compact" | "json";

export interface FilterOperatorOption {
  label: string;
  value: FilterOperator;
}

export interface ColumnSortItem<
  TColumnId extends string = string,
> extends ColumnSort {
  id: TColumnId;
}

export interface ColumnFilterItem<TColumnId extends string = string> {
  id: TColumnId;
  value: string | string[];
  variant: FilterVariant;
  operator: FilterOperator;
  filterId: string;
}

export interface DataTableQuery<
  TFilterColumnId extends string = string,
  TSortColumnId extends string = TFilterColumnId,
> {
  page: number;
  perPage: number;
  sorting: ColumnSortItem<TSortColumnId>[];
  filters: ColumnFilterItem<TFilterColumnId>[];
  joinOperator: JoinOperator;
}

export interface DataTableRowAction<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
  variant: "update" | "delete";
}
