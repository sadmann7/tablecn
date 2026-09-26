import type { ColumnSort, Row, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataTableConfig } from "@/lib/data-table-utils";

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

export type FilterOperator = DataTableConfig["operators"][number];
export type FilterVariant = DataTableConfig["filterVariants"][number];
export type JoinOperator = DataTableConfig["joinOperators"][number];

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, "id"> {
  id: Extract<keyof TData, string>;
}

/**
 * A single filter condition. This is the wire format shared by the URL, the
 * table's `advancedFilters` state slice, and server adapters.
 */
export interface ColumnFilterItem {
  id: string;
  value: string | string[];
  variant: FilterVariant;
  operator: FilterOperator;
  filterId: string;
}

export interface ExtendedColumnFilter<TData> extends Omit<
  ColumnFilterItem,
  "id"
> {
  id: Extract<keyof TData, string>;
}

/**
 * Everything a server needs to answer a data table request, independent of
 * the database or ORM used to answer it.
 */
export interface DataTableQuery<TData = unknown> {
  page: number;
  perPage: number;
  sorting: ExtendedColumnSort<TData>[];
  filters: ExtendedColumnFilter<TData>[];
  joinOperator: JoinOperator;
}

export interface DataTableRowAction<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
  variant: "update" | "delete";
}
