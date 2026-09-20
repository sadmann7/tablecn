"use client";

import type { RowData, Table } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/table-features";

import { Button } from "@/registry/bases/base/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/registry/bases/base/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataTableViewOptionsProps<
  TData extends RowData,
> extends React.ComponentProps<typeof PopoverContent> {
  table: Table<DataTableFeatures, TData>;
  disabled?: boolean;
}

export function DataTableViewOptions<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataTableViewOptionsProps<TData>) {
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
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label="Toggle columns"
            role="combobox"
            variant="outline"
            className="ml-auto hidden h-8 font-normal lg:flex"
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
      </PopoverTrigger>
      <PopoverContent className={cn("w-44 p-0", className)} {...props}>
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  data-checked={column.getIsVisible()}
                  onSelect={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <span className="truncate">
                    {column.columnDef.meta?.label ?? column.id}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
