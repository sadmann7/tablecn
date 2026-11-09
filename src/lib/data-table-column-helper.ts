import {
  type AccessorKeyColumnDef,
  createColumnHelper,
  type IdentifiedColumnDef,
  type RowData,
} from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { DataTableColumnConfigs } from "@/lib/data-table-types";

import {
  type ColumnDisplayMeta,
  type DataTableDefinition,
  getColumnConfigOptions,
} from "@/lib/data-table-definition";

type DefinedColumnDef<TData extends RowData, TValue, TConfig> = Omit<
  IdentifiedColumnDef<DataTableFeatures, TData, TValue>,
  "id" | "meta" | "enableColumnFilter" | "enableSorting"
> & {
  meta?: ColumnDisplayMeta<TConfig>;
};

export function createDataTableColumnHelper<TData extends RowData>() {
  return <TColumns extends DataTableColumnConfigs>(
    definition: Pick<DataTableDefinition<TColumns>, "columns">,
  ) => {
    const columnHelper = createColumnHelper<DataTableFeatures, TData>();

    return {
      ...columnHelper,
      accessor<TId extends keyof TColumns & keyof TData & string>(
        id: TId,
        column: DefinedColumnDef<TData, TData[TId], TColumns[TId]>,
      ): AccessorKeyColumnDef<DataTableFeatures, TData, TData[TId]> {
        const { meta, ...options } = getColumnConfigOptions(
          definition.columns[id],
        );

        return {
          ...column,
          ...options,
          id,
          accessorKey: id,
          meta: { ...column.meta, ...meta },
        };
      },
    };
  };
}
