"use client";

import type * as React from "react";

import {
  type Column,
  type RowData,
  type SortDirection,
  type SortingState,
  Subscribe,
} from "@tanstack/react-table";
import { cn } from "cn";
import {
  Button as ButtonPrimitive,
  type Selection,
} from "react-aria-components";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { useDirection } from "@/registry/bases/aria/ui/direction";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/bases/aria/ui/dropdown-menu";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends Omit<React.ComponentProps<typeof ButtonPrimitive>, "className"> {
  column: Column<DataTableFeatures, TData, TValue>;
  label?: string;
  className?: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  label = column.columnDef.meta?.label ?? column.id,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return (
      <div title={label} className={cn("truncate", className)}>
        {label}
      </div>
    );
  }

  return (
    <Subscribe
      source={column.table.store}
      selector={(state) => ({
        sortDirection: getSortDirection(state.sorting, column.id),
      })}
    >
      {(headerState) => (
        <DataTableColumnHeaderMenu
          column={column}
          label={label}
          className={className}
          sortDirection={headerState.sortDirection}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataTableColumnHeaderMenuProps<
  TData extends RowData,
  TValue,
> extends DataTableColumnHeaderProps<TData, TValue> {
  label: string;
  sortDirection: SortDirection | "none";
}

function DataTableColumnHeaderMenu<TData extends RowData, TValue>({
  column,
  label,
  className,
  sortDirection,
  ...props
}: DataTableColumnHeaderMenuProps<TData, TValue>) {
  const dir = useDirection();

  function onSortDirectionChange(keys: Selection) {
    if (keys === "all") return;
    const [direction] = keys;
    if (direction === "asc" || direction === "desc") {
      column.toggleSorting(direction === "desc", true);
      return;
    }

    column.clearSorting();
  }

  return (
    <DropdownMenuTrigger>
      <ButtonPrimitive
        className={cn(
          "-ms-1.5 flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent focus:ring-1 focus:ring-ring focus:outline-none aria-expanded:bg-accent rtl:flex-row-reverse [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        <bdi className="truncate" title={label}>
          {label}
        </bdi>
        {column.getCanSort() &&
          (sortDirection === "desc" ? (
            <IconPlaceholder
              lucide="ChevronDown"
              tabler="IconChevronDown"
              hugeicons="ArrowDown01Icon"
              phosphor="CaretDownIcon"
              remixicon="RiArrowDownSLine"
            />
          ) : sortDirection === "asc" ? (
            <IconPlaceholder
              lucide="ChevronUp"
              tabler="IconChevronUp"
              hugeicons="ArrowUp01Icon"
              phosphor="CaretUpIcon"
              remixicon="RiArrowUpSLine"
            />
          ) : (
            <IconPlaceholder
              lucide="ChevronsUpDown"
              tabler="IconSelector"
              hugeicons="UnfoldMoreIcon"
              phosphor="CaretUpDownIcon"
              remixicon="RiArrowUpDownLine"
            />
          ))}
      </ButtonPrimitive>
      <DropdownMenu
        dir={dir}
        placement="bottom start"
        className="w-28 data-exiting:fill-mode-forwards"
      >
        {column.getCanSort() && (
          <DropdownMenuGroup
            selectionMode="single"
            selectedKeys={sortDirection === "none" ? [] : [sortDirection]}
            onSelectionChange={onSortDirectionChange}
          >
            <DropdownMenuItem
              id="asc"
              textValue="Asc"
              shouldCloseOnSelect={false}
              className="[&_svg]:text-muted-foreground"
            >
              <IconPlaceholder
                lucide="ChevronUp"
                tabler="IconChevronUp"
                hugeicons="ArrowUp01Icon"
                phosphor="CaretUpIcon"
                remixicon="RiArrowUpSLine"
              />
              Asc
            </DropdownMenuItem>
            <DropdownMenuItem
              id="desc"
              textValue="Desc"
              shouldCloseOnSelect={false}
              className="[&_svg]:text-muted-foreground"
            >
              <IconPlaceholder
                lucide="ChevronDown"
                tabler="IconChevronDown"
                hugeicons="ArrowDown01Icon"
                phosphor="CaretDownIcon"
                remixicon="RiArrowDownSLine"
              />
              Desc
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        {column.getCanHide() && (
          <DropdownMenuItem
            textValue="Hide"
            className="[&_svg]:text-muted-foreground"
            onAction={() => column.toggleVisibility(false)}
          >
            <IconPlaceholder
              lucide="EyeOff"
              tabler="IconEyeClosed"
              hugeicons="ViewOffIcon"
              phosphor="EyeSlashIcon"
              remixicon="RiEyeOffLine"
            />
            Hide
          </DropdownMenuItem>
        )}
      </DropdownMenu>
    </DropdownMenuTrigger>
  );
}

function getSortDirection(
  sorting: SortingState,
  columnId: string,
): SortDirection | "none" {
  const sort = sorting.find((sort) => sort.id === columnId);
  if (!sort) return "none";
  return sort.desc ? "desc" : "asc";
}
