"use client";

import type {
  ColumnSort,
  Header,
  SortDirection,
  SortingState,
  Table,
} from "@tanstack/react-table";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  EyeOff,
  Hash,
  List,
  Type,
  X,
} from "lucide-react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Cell } from "@/types/data-grid";

function getColumnVariant(variant: Cell["variant"]) {
  switch (variant) {
    case "short-text":
      return { icon: Type, label: "Short Text" };
    case "long-text":
      return { icon: Type, label: "Long Text" };
    case "number":
      return { icon: Hash, label: "Number" };
    case "select":
      return { icon: List, label: "Select" };
    case "checkbox":
      return { icon: CheckSquare, label: "Checkbox" };
    case "date":
      return { icon: Calendar, label: "Date" };
    default:
      return null;
  }
}

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
  const title = column.columnDef.meta?.label
    ? column.columnDef.meta.label
    : typeof column.columnDef.header === "string"
      ? column.columnDef.header
      : column.id;

  const cellVariant = column.columnDef.meta?.cell;
  const columnVariant = getColumnVariant(cellVariant?.variant ?? "short-text");

  const onSortingChange = React.useCallback(
    (direction: SortDirection) => {
      table.setSorting((prev: SortingState) => {
        const existingSortIndex = prev.findIndex(
          (sort) => sort.id === column.id,
        );
        const newSort: ColumnSort = {
          id: column.id,
          desc: direction === "desc",
        };

        if (existingSortIndex >= 0) {
          const updated = [...prev];
          updated[existingSortIndex] = newSort;
          return updated;
        } else {
          return [...prev, newSort];
        }
      });
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
      <div
        className={cn(
          "flex size-full items-center gap-1.5 truncate p-2 text-sm",
          className,
        )}
      >
        {columnVariant && (
          <Tooltip>
            <TooltipTrigger asChild>
              <columnVariant.icon className="size-3.5 shrink-0 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{columnVariant.label}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <span className="truncate">{title}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-full items-center justify-between gap-2 truncate p-2 text-sm hover:bg-accent/40 data-[state=open]:bg-accent/40 [&_svg]:size-4",
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {columnVariant && (
            <Tooltip>
              <TooltipTrigger
                asChild
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <columnVariant.icon className="size-3.5 shrink-0 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{columnVariant.label}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <span className="truncate">{title}</span>
        </div>
        <ChevronDown className="shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} className="w-60">
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
              checked={column.getIsSorted() === "asc"}
              onClick={() => onSortingChange("asc")}
            >
              <ChevronUp />
              Sort asc
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="relative pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto [&_svg]:text-muted-foreground"
              checked={column.getIsSorted() === "desc"}
              onClick={() => onSortingChange("desc")}
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
