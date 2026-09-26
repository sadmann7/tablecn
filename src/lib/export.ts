import type { RowData, Table } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";

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

  const columns = table
    .getAllLeafColumns()
    .filter((column) => !excludeColumns.includes(column.id));

  const rows = onlySelected
    ? table.getSelectedRows()
    : table.getRowModel().rows.map((row) => row.original);

  const csvContent = [
    columns.map((column) => column.id).join(","),
    ...rows.map((row, index) =>
      columns
        .map((column) => {
          const cellValue = column.accessorFn?.(row, index);
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
