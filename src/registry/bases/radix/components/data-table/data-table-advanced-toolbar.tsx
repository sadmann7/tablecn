"use client";

import type { RowData, Table } from "@tanstack/react-table";
import type * as React from "react";

import { cn } from "cn";

import type { DataTableFeatures } from "@/lib/table-features";

import { DataTableViewOptions } from "@/registry/bases/radix/components/data-table/data-table-view-options";

interface DataTableAdvancedToolbarProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: Table<DataTableFeatures, TData>;
}

export function DataTableAdvancedToolbar<TData extends RowData>({
  table,
  children,
  className,
  ...props
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <div
      role="toolbar"
      aria-orientation="horizontal"
      className={cn(
        "flex w-full items-start justify-between gap-2 p-1",
        className,
      )}
      {...props}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} align="end" />
      </div>
    </div>
  );
}
