import type { ColumnSort, Row, RowData } from "@tanstack/react-table";
import type { DataTableConfig } from "@/lib/data-table-utils";
import type { FilterItemSchema } from "@/lib/parsers";
import type { DataTableFeatures } from "@/lib/table-features";

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

export interface ExtendedColumnFilter<TData> extends FilterItemSchema {
  id: Extract<keyof TData, string>;
}

export interface DataTableRowAction<TData extends RowData> {
  row: Row<DataTableFeatures, TData>;
  variant: "update" | "delete";
}
