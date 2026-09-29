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

export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export type FilterVariant = (typeof FILTER_VARIANTS)[number];
export type JoinOperator = (typeof JOIN_OPERATORS)[number];

/**
 * How filters and sorting are written to the URL. Both formats are always
 * read, so links keep working when the format changes.
 *
 * - `"compact"`: value filters get one query param per column, e.g.
 *   `?status=todo,done&title=fix`, and sorting is `?sort=createdAt.desc`.
 *   Other filters (other operators, several per column) fall back to JSON
 *   in the `filters` param.
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

declare module "@tanstack/react-table" {
  interface ColumnFilter {
    /**
     * Set by the filter list and menu. Value filters, set with
     * `column.setFilterValue()`, leave it unset and apply their variant's
     * value operator.
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
