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

export interface FilterOperatorOption {
  label: string;
  value: FilterOperator;
}

/**
 * A single sort. `TColumnId` narrows the column id once a parser has checked it
 * against a known list of columns.
 */
export interface ColumnSortItem<
  TColumnId extends string = string,
> extends ColumnSort {
  id: TColumnId;
}

/**
 * A single filter condition. This is the wire format shared by the URL, the
 * table's `filters` state slice, and server adapters. `TColumnId` narrows the
 * column id once a parser has checked it against a known list of columns.
 */
export interface ColumnFilterItem<TColumnId extends string = string> {
  id: TColumnId;
  value: string | string[];
  variant: FilterVariant;
  operator: FilterOperator;
  filterId: string;
}

/**
 * Everything a server needs to answer a data table request, independent of
 * the database or ORM used to answer it.
 */
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
