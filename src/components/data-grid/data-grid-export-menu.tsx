"use client";

import type { Table } from "@tanstack/react-table";
import { Download } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportTableToCSV } from "@/lib/export";

interface DataGridExportMenuProps<TData>
  extends React.ComponentProps<typeof DropdownMenuContent> {
  table: Table<TData>;
  filename?: string;
  excludeColumns?: (keyof TData | "select" | "actions")[];
  disabled?: boolean;
}

export function DataGridExportMenu<TData>({
  table,
  filename = "table",
  excludeColumns = ["select" as keyof TData | "select" | "actions"],
  disabled,
  className,
  ...props
}: DataGridExportMenuProps<TData>) {
  const selectedRowCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Export table"
          variant="outline"
          size="sm"
          className="hidden h-8 font-normal lg:flex"
          disabled={disabled}
        >
          <Download className="text-muted-foreground" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={className} {...props}>
        <DropdownMenuItem
          onSelect={() =>
            exportTableToCSV(table, {
              filename,
              excludeColumns,
              onlySelected: false,
            })
          }
        >
          Export all rows to CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            exportTableToCSV(table, {
              filename,
              excludeColumns,
              onlySelected: true,
            })
          }
          disabled={selectedRowCount === 0}
        >
          Export selected rows to CSV ({selectedRowCount})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
