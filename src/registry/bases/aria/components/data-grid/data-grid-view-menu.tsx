"use client";

import type { RowData, Table } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { Button } from "@/registry/bases/aria/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/registry/bases/aria/ui/command";
import { useDirection } from "@/registry/bases/aria/ui/direction";
import { Popover, PopoverTrigger } from "@/registry/bases/aria/ui/popover";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataGridViewMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof Popover> {
  table: Table<DataGridFeatures, TData>;
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
    <PopoverTrigger>
      <Button
        aria-label="Toggle columns"
        dir={dir}
        variant="outline"
        className="ms-auto hidden h-8 font-normal lg:flex"
        isDisabled={disabled}
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
      <Popover dir={dir} className={cn("w-44 p-0", className)} {...props}>
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList
            shouldCloseOnSelect={false}
            renderEmptyState={() => (
              <CommandEmpty>No columns found.</CommandEmpty>
            )}
          >
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  data-checked={column.getIsVisible()}
                  textValue={column.columnDef.meta?.label ?? column.id}
                  onAction={() =>
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
      </Popover>
    </PopoverTrigger>
  );
}
