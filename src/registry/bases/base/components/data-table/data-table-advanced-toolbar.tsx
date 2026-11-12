"use client";

import type * as React from "react";

import {
  type ReactTable,
  type RowData,
  Subscribe,
} from "@tanstack/react-table";
import { cn } from "cn";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { DataTableViewOptions } from "@/registry/bases/base/components/data-table/data-table-view-options";
import { Input } from "@/registry/bases/base/ui/input";

interface DataTableAdvancedToolbarProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  globalFilterPlaceholder?: string;
}

export function DataTableAdvancedToolbar<TData extends RowData>({
  table,
  globalFilterPlaceholder,
  children,
  className,
  ...props
}: DataTableAdvancedToolbarProps<TData>) {
  return (
    <div
      data-slot="data-table-advanced-toolbar"
      className={cn(
        "flex w-full flex-wrap items-start justify-between gap-2 p-1",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-[min(100%,24rem)] flex-1 flex-wrap items-center gap-2">
        {globalFilterPlaceholder &&
        table.options.enableGlobalFilter !== false ? (
          <Subscribe
            source={table.atoms.globalFilter}
            selector={(globalFilter) =>
              typeof globalFilter === "string" ||
              typeof globalFilter === "number"
                ? String(globalFilter)
                : ""
            }
          >
            {(globalFilter) => (
              <Input
                aria-label={globalFilterPlaceholder}
                placeholder={globalFilterPlaceholder}
                value={globalFilter}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
                className="w-40 text-ellipsis lg:w-56"
              />
            )}
          </Subscribe>
        ) : null}
        {children}
      </div>
      <div className="ms-auto flex items-center gap-2">
        <DataTableViewOptions table={table} align="end" />
      </div>
    </div>
  );
}
