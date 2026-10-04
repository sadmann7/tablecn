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

import type { DataTableFeatures } from "@/lib/data-table-features";

import { useDirection } from "@/registry/bases/base/ui/direction";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.ComponentProps<typeof DropdownMenuTrigger> {
  column: Column<DataTableFeatures, TData, TValue>;
  label: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  label,
  className,
  ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <div className={cn(className)}>{label}</div>;
  }

  return (
    <Subscribe
      source={column.table.store}
      selector={(state) => ({
        isVisible: state.columnVisibility[column.id] !== false,
        sortDirection: getSortDirection(state.sorting, column.id),
      })}
    >
      {(headerState) => (
        <DataTableColumnHeaderMenu
          column={column}
          label={label}
          className={className}
          isVisible={headerState.isVisible}
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
  isVisible: boolean;
  sortDirection: SortDirection | "none";
}

function DataTableColumnHeaderMenu<TData extends RowData, TValue>({
  column,
  label,
  className,
  isVisible,
  sortDirection,
  ...props
}: DataTableColumnHeaderMenuProps<TData, TValue>) {
  const dir = useDirection();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "-ms-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent focus:ring-1 focus:ring-ring focus:outline-none data-[state=open]:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {label}
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
      </DropdownMenuTrigger>
      <DropdownMenuContent dir={dir} align="start" className="w-28">
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
              checked={sortDirection === "asc"}
              onClick={() => column.toggleSorting(false, true)}
            >
              <IconPlaceholder
                lucide="ChevronUp"
                tabler="IconChevronUp"
                hugeicons="ArrowUp01Icon"
                phosphor="CaretUpIcon"
                remixicon="RiArrowUpSLine"
              />
              Asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
              checked={sortDirection === "desc"}
              onClick={() => column.toggleSorting(true, true)}
            >
              <IconPlaceholder
                lucide="ChevronDown"
                tabler="IconChevronDown"
                hugeicons="ArrowDown01Icon"
                phosphor="CaretDownIcon"
                remixicon="RiArrowDownSLine"
              />
              Desc
            </DropdownMenuCheckboxItem>
            {sortDirection !== "none" && (
              <DropdownMenuItem
                className="ltr:pl-2 rtl:pr-2 [&_svg]:text-muted-foreground"
                onClick={() => column.clearSorting()}
              >
                <IconPlaceholder
                  lucide="X"
                  tabler="IconX"
                  hugeicons="Cancel01Icon"
                  phosphor="XIcon"
                  remixicon="RiCloseLine"
                />
                Reset
              </DropdownMenuItem>
            )}
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuCheckboxItem
            className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
            checked={!isVisible}
            onClick={() => column.toggleVisibility(false)}
          >
            <IconPlaceholder
              lucide="EyeOff"
              tabler="IconEyeClosed"
              hugeicons="ViewOffIcon"
              phosphor="EyeSlashIcon"
              remixicon="RiEyeOffLine"
            />
            Hide
          </DropdownMenuCheckboxItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
