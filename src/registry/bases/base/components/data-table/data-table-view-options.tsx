"use client";

import { type RowData, Subscribe, type Table } from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { Button } from "@/registry/bases/base/ui/button";
import { useDirection } from "@/registry/bases/base/ui/direction";
import {
  Faceted,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedTrigger,
} from "@/registry/bases/base/ui/faceted";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataTableViewOptionsProps<
  TData extends RowData,
> extends React.ComponentProps<typeof FacetedContent> {
  table: Table<DataTableFeatures, TData>;
  disabled?: boolean;
}

export function DataTableViewOptions<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataTableViewOptionsProps<TData>) {
  const dir = useDirection();
  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== "undefined" && column.getCanHide(),
        ),
    [table],
  );

  return (
    <Subscribe source={table.atoms.columnVisibility}>
      {(columnVisibility) => (
        <Faceted
          multiple
          value={columns
            .filter((column) => columnVisibility[column.id] !== false)
            .map((column) => column.id)}
        >
          <FacetedTrigger
            render={
              <Button
                aria-label="View columns"
                variant="outline"
                className="ms-auto hidden lg:flex"
                disabled={disabled}
              />
            }
          >
            <IconPlaceholder
              lucide="Settings2"
              tabler="IconSettings"
              hugeicons="Settings05Icon"
              phosphor="GearIcon"
              remixicon="RiSettingsLine"
              className="text-muted-foreground"
            />
            View
          </FacetedTrigger>
          <FacetedContent
            aria-label="Columns"
            dir={dir}
            align="center"
            className={cn("w-44", className)}
            {...props}
          >
            <FacetedInput placeholder="Search columns..." />
            <FacetedList>
              <FacetedEmpty>No columns found.</FacetedEmpty>
              <FacetedGroup>
                {columns.map((column) => (
                  <FacetedItem
                    key={column.id}
                    value={column.id}
                    onSelect={() => column.toggleVisibility()}
                  >
                    <span className="truncate">
                      {column.columnDef.meta?.label ?? column.id}
                    </span>
                    <FacetedItemIndicator />
                  </FacetedItem>
                ))}
              </FacetedGroup>
            </FacetedList>
          </FacetedContent>
        </Faceted>
      )}
    </Subscribe>
  );
}
