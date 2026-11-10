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

export interface ColumnSelectOption {
  label: string;
  value: string;
  count?: number;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
}

export type PlainColumnVariant =
  | "text"
  | "long-text"
  | "url"
  | "boolean"
  | "file";

export interface ColumnVariantOptions {
  number: {
    filter?: "range";
    min?: number;
    max?: number;
    unit?: string;
  };
  date: {
    filter?: "range";
  };
  select: {
    options?: ColumnSelectOption[];
  };
  "multi-select": {
    options?: ColumnSelectOption[];
  };
}

export type ColumnVariant = PlainColumnVariant | keyof ColumnVariantOptions;

type VariantMeta<TVariant extends keyof ColumnVariantOptions> = {
  variant: TVariant;
} & ColumnVariantOptions[TVariant];

export type ColumnVariantMeta =
  | { variant?: PlainColumnVariant }
  | VariantMeta<"number">
  | VariantMeta<"date">
  | VariantMeta<"select">
  | VariantMeta<"multi-select">;

export interface DataTableColumnDisplayMeta {
  label?: string;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
  placeholder?: string;
}

export type DataTableColumnMeta = DataTableColumnDisplayMeta &
  ColumnVariantMeta;

export type DataTableColumnConfig = {
  enableSorting?: boolean;
} & (
  | { variant?: PlainColumnVariant | "select" | "multi-select" }
  | { variant: "number" | "date"; filter?: "range" }
);

export type DataTableColumnConfigs = Record<string, DataTableColumnConfig>;

type KeysWhere<TRecord, TValue> = {
  [K in keyof TRecord]: TRecord[K] extends TValue ? K : never;
}[keyof TRecord] &
  string;

export type FilterableColumnId<TColumns extends DataTableColumnConfigs> =
  KeysWhere<TColumns, { variant: ColumnVariant }>;

export type SortableColumnId<TColumns extends DataTableColumnConfigs> = Exclude<
  keyof TColumns & string,
  KeysWhere<TColumns, { enableSorting: false }>
>;

export type FilterVariant = (typeof FILTER_VARIANTS)[number];
export type FilterOperator = keyof typeof FILTER_OPERATORS;
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

export interface ColumnFilterItem<
  TColumnId extends string = string,
> extends ColumnFilter {
  id: TColumnId;
  value: string | string[];
  variant: FilterVariant;
  operator: FilterOperator;
  filterId: string;
}

declare module "@tanstack/react-table" {
  interface ColumnFilter extends Partial<
    Pick<ColumnFilterItem, "operator" | "variant" | "filterId">
  > {}
}

export interface DataTableQuery<
  TFilterColumnId extends string = string,
  TSortColumnId extends string = string,
> {
  page: number;
  perPage: number;
  sorting: ColumnSortItem<TSortColumnId>[];
  filters: ColumnFilterItem<TFilterColumnId>[];
  joinOperator: JoinOperator;
  globalFilter: string;
}

export interface DataTableRowAction<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
  variant: "update" | "delete";
}
