"use client";

import type { Header, SortingState, Table } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, EyeOff, X } from "lucide-react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DataGridColumnHeaderProps<TData, TValue>
  extends React.ComponentProps<typeof DropdownMenuTrigger> {
  header: Header<TData, TValue>;
  table: Table<TData>;
}

export function DataGridColumnHeader<TData, TValue>({
  header,
  table,
  className,
  ...props
}: DataGridColumnHeaderProps<TData, TValue>) {
  const column = header.column;
  const title = header.column.columnDef.meta?.label
    ? header.column.columnDef.meta.label
    : typeof header.column.columnDef.header === "string"
      ? header.column.columnDef.header
      : header.column.id;

  const onSortChange = React.useCallback(
    (desc: boolean) => {
      table.setSorting((prev: SortingState) => [
        ...prev,
        { id: column.id, desc },
      ]);
    },
    [column.id, table],
  );

  const onSortRemove = React.useCallback(() => {
    table.setSorting((prev: SortingState) =>
      prev.filter((sort) => sort.id !== column.id),
    );
  }, [column.id, table]);

  if (!column.getCanSort() && !column.getCanHide()) {
    return (
      <div className={cn("size-full truncate p-2 text-sm", className)}>
        {title}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-full items-center justify-between gap-2 truncate p-2 text-sm [&_svg]:size-4",
          className,
        )}
        {...props}
      >
        {title}
        <ChevronDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} className="w-60">
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
              checked={column.getIsSorted() === "asc"}
              onClick={() => onSortChange(false)}
            >
              <ChevronUp />
              Sort asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
              checked={column.getIsSorted() === "desc"}
              onClick={() => onSortChange(true)}
            >
              <ChevronDown />
              Sort desc
            </DropdownMenuCheckboxItem>
            {column.getIsSorted() && (
              <DropdownMenuItem
                className="pl-2 [&_svg]:text-muted-foreground"
                onClick={onSortRemove}
              >
                <X />
                Remove sort
              </DropdownMenuItem>
            )}
          </>
        )}
        {column.getCanHide() && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
              checked={!column.getIsVisible()}
              onClick={() => column.toggleVisibility(false)}
            >
              <EyeOff />
              Hide column
            </DropdownMenuCheckboxItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
