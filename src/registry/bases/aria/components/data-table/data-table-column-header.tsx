"use client";

import type { Column, RowData } from "@tanstack/react-table";

import { cn } from "cn";
import { Button as ButtonPrimitive } from "react-aria-components";

import type { DataTableFeatures } from "@/lib/table-features";

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
  label: string;
  className?: string;
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

  const sorted = column.getIsSorted();

  return (
    <DropdownMenuTrigger>
      <ButtonPrimitive
        className={cn(
          "-ml-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent focus:ring-1 focus:ring-ring focus:outline-none aria-expanded:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {label}
        {column.getCanSort() &&
          (column.getIsSorted() === "desc" ? (
            <IconPlaceholder
              lucide="ChevronDown"
              tabler="IconChevronDown"
              hugeicons="ArrowDown01Icon"
              phosphor="CaretDownIcon"
              remixicon="RiArrowDownSLine"
            />
          ) : column.getIsSorted() === "asc" ? (
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
      <DropdownMenu placement="bottom start" className="w-28">
        {column.getCanSort() && (
          <DropdownMenuGroup
            selectionMode="single"
            selectedKeys={sorted ? [sorted] : []}
            onSelectionChange={(keys) => {
              if (keys === "all") return;
              const [key] = keys;
              if (key === "asc") column.toggleSorting(false);
              if (key === "desc") column.toggleSorting(true);
            }}
          >
            <DropdownMenuItem
              id="asc"
              className="relative pr-8 pl-2 [&_svg]:text-muted-foreground [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
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
              className="relative pr-8 pl-2 [&_svg]:text-muted-foreground [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
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
        {column.getCanSort() && sorted && (
          <DropdownMenuItem
            className="pl-2 [&_svg]:text-muted-foreground"
            onAction={() => column.clearSorting()}
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
        {column.getCanHide() && (
          <DropdownMenuItem
            className="relative pr-8 pl-2 [&_svg]:text-muted-foreground [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
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
