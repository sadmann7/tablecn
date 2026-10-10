"use client";

import {
  type ReactTable,
  type RowData,
  Subscribe,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { Button } from "@/registry/bases/radix/ui/button";
import { useDirection } from "@/registry/bases/radix/ui/direction";
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
} from "@/registry/bases/radix/ui/faceted";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataGridViewMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof FacetedContent> {
  table: ReactTable<DataGridFeatures, TData, unknown>;
  disabled?: boolean;
}

export function DataGridViewMenu<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataGridViewMenuProps<TData>) {
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
          <FacetedTrigger asChild>
            <Button
              aria-label="Toggle columns"
              role="combobox"
              dir={dir}
              variant="outline"
              className="ms-auto hidden lg:flex"
              disabled={disabled}
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
            </Button>
          </FacetedTrigger>
          <FacetedContent
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
                    keywords={[column.columnDef.meta?.label ?? column.id]}
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
