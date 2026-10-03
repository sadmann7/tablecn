import type {
  ColumnFilter,
  ColumnSort,
  Row,
  RowData,
} from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  FILTER_OPERATORS,
  FILTER_VARIANTS,
  JOIN_OPERATORS,
} from "@/lib/data-table-utils";

export interface DataTableColumnMeta {
  label?: string;
  placeholder?: string;
  variant?: FilterVariant;
  options?: FilterOption[];
  range?: [number, number];
  unit?: string;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
}

export interface DataTableQueryKeys {
  page: string;
  perPage: string;
  sort: string;
  joinOperator: string;
}

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
}

export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export type FilterVariant = (typeof FILTER_VARIANTS)[number];
export type JoinOperator = (typeof JOIN_OPERATORS)[number];

export interface FilterOperatorOption {
  label: string;
  value: FilterOperator;
}

export interface ColumnSortItem<
  TColumnId extends string = string,
> extends ColumnSort {
  id: TColumnId;
}

declare module "@tanstack/react-table" {
  interface ColumnFilter {
    /**
     * Set by the filter list and menu. Plain filters, set with
     * `column.setFilterValue()`, leave it unset and apply their variant's
     * plain operator.
     */
    operator?: FilterOperator;
    variant?: FilterVariant;
    filterId?: string;
  }
}

/** A `columnFilters` item with every field resolved. */
export interface ColumnFilterItem<
  TColumnId extends string = string,
> extends ColumnFilter {
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
