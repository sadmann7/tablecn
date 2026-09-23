import type { RowData, Table } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";

import {
  getCachedSelectedRow,
  syncSelectedRowCache,
} from "@/lib/data-table-utils";

export function exportTableToCSV<TData extends RowData>(
  table: Table<DataTableFeatures, TData>,
  opts: {
    filename?: string;
    excludeColumns?: (keyof TData | "select" | "actions")[];
    onlySelected?: boolean;
  } = {},
): void {
  const {
    filename = "table",
    excludeColumns = [],
    onlySelected = false,
  } = opts;

  const headers = table
    .getAllLeafColumns()
    .map((column) => column.id)
    .filter((id) => !excludeColumns.includes(id));

  const csvContent = [
    headers.join(","),
    ...getExportRows(table, onlySelected).map((row) =>
      headers
        .map((header) => {
          const cellValue = row.getValue(header);
          return typeof cellValue === "string"
            ? `"${cellValue.replace(/"/g, '""')}"`
            : cellValue;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getExportRows<TData extends RowData>(
  table: Table<DataTableFeatures, TData>,
  onlySelected: boolean,
) {
  if (!onlySelected) return table.getRowModel().rows;

  syncSelectedRowCache(table);

  const liveRows = new Map(
    table.getRowModel().rows.map((row) => [row.id, row]),
  );

  return table.getSelectedRowIds().flatMap((id) => {
    const liveRow = liveRows.get(id);
    if (liveRow) return [liveRow];

    const original = getCachedSelectedRow(table, id);
    if (original === undefined) return [];

    return [
      {
        getValue: (header: string) =>
          readOriginalValue(table, original, header),
      },
    ];
  });
}

function readOriginalValue<TData extends RowData>(
  table: Table<DataTableFeatures, TData>,
  original: TData,
  header: string,
) {
  const column = table.getColumn(header);
  if (column?.accessorFn) return column.accessorFn(original, 0);

  if (typeof original === "object" && original !== null && header in original) {
    return original[header as keyof TData];
  }
}
