import type {
  ColumnFilter,
  ColumnSort,
  DeepKeys,
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

export interface ColumnNumberOptions {
  min?: number;
  max?: number;
  unit?: string;
}

export interface DataTableColumnMeta extends ColumnNumberOptions {
  label?: string;
  icon?: React.ComponentType<React.ComponentProps<"svg">>;
  placeholder?: string;
  variant?: FilterVariant;
  options?: ColumnSelectOption[];
  multiple?: boolean;
}

export interface DataTableColumnConfig {
  enableSorting?: boolean;
  variant?: FilterVariant;
}

export type DataTableColumnPathId<TPath extends string> =
  TPath extends `${infer THead}.${infer TTail}`
    ? `${THead}_${DataTableColumnPathId<TTail>}`
    : TPath;

export type DataTableColumnId<TData> = DataTableColumnPathId<
  DeepKeys<TData> & string
>;

export type DataTableColumnConfigs<
  TData = never,
  TComputedId extends string = never,
> = [TData] extends [never]
  ? Record<string, DataTableColumnConfig>
  : { [K in DataTableColumnId<TData> | TComputedId]?: DataTableColumnConfig };

type KeysWhere<TRecord, TValue> = {
  [K in keyof TRecord]: TRecord[K] extends TValue ? K : never;
}[keyof TRecord] &
  string;

export type FilterableColumnId<TColumns extends DataTableColumnConfigs> =
  string extends keyof TColumns
    ? string
    : KeysWhere<TColumns, { variant: FilterVariant }>;

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
