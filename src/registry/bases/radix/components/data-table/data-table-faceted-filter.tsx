"use client";

import type * as React from "react";

import { type Column, type RowData, Subscribe } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { Option } from "@/lib/data-table-types";

import { Badge } from "@/registry/bases/radix/ui/badge";
import { Button } from "@/registry/bases/radix/ui/button";
import {
  Faceted,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
} from "@/registry/bases/radix/ui/faceted";
import { Separator } from "@/registry/bases/radix/ui/separator";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataTableFacetedFilterProps<TData extends RowData, TValue> {
  column?: Column<DataTableFeatures, TData, TValue>;
  title?: string;
  options: Option[];
  multiple?: boolean;
}

export function DataTableFacetedFilter<TData extends RowData, TValue>({
  column,
  ...props
}: DataTableFacetedFilterProps<TData, TValue>) {
  if (!column) {
    return <DataTableFacetedFilterContent column={column} {...props} />;
  }

  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() => column.getFilterValue()}
    >
      {(filterValue) => (
        <DataTableFacetedFilterContent
          column={column}
          columnFilterValue={filterValue}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataTableFacetedFilterContentProps<
  TData extends RowData,
  TValue,
> extends DataTableFacetedFilterProps<TData, TValue> {
  columnFilterValue?: unknown;
}

function DataTableFacetedFilterContent<TData extends RowData, TValue>({
  column,
  title,
  options,
  multiple = false,
  columnFilterValue,
}: DataTableFacetedFilterContentProps<TData, TValue>) {
  const selectedValues = Array.isArray(columnFilterValue)
    ? columnFilterValue.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );
  const hasSelection = selectedValues.length > 0;

  function onValueChange(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    column?.setFilterValue(values.length > 0 ? values : undefined);
  }

  function onReset(event?: React.MouseEvent) {
    event?.stopPropagation();
    column?.setFilterValue(undefined);
  }

  return (
    <Faceted
      value={multiple ? selectedValues : selectedValues[0]}
      onValueChange={onValueChange}
      multiple={multiple}
    >
      <FacetedTrigger asChild>
        <Button variant="outline" className="border-dashed">
          {hasSelection ? (
            <div
              role="button"
              aria-label={`Clear ${title} filter`}
              tabIndex={0}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              onClick={onReset}
            >
              <IconPlaceholder
                lucide="XCircle"
                tabler="IconCircleX"
                hugeicons="Cancel01Icon"
                phosphor="XCircleIcon"
                remixicon="RiCloseCircleLine"
              />
            </div>
          ) : (
            <IconPlaceholder
              lucide="PlusCircle"
              tabler="IconCirclePlus"
              hugeicons="PlusSignCircleIcon"
              phosphor="PlusCircleIcon"
              remixicon="RiAddCircleLine"
            />
          )}
          {title}
          {hasSelection && (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-[orientation=vertical]:h-4"
              />
              <Badge variant="secondary" className="px-1 lg:hidden">
                {selectedValues.length}
              </Badge>
              <div className="hidden items-center gap-1 lg:flex">
                {selectedValues.length > 2 ? (
                  <Badge variant="secondary" className="px-1">
                    {selectedValues.length} selected
                  </Badge>
                ) : (
                  selectedOptions.map((option) => (
                    <Badge
                      key={option.value}
                      variant="secondary"
                      className="px-1"
                    >
                      {option.label}
                    </Badge>
                  ))
                )}
              </div>
            </>
          )}
        </Button>
      </FacetedTrigger>
      <FacetedContent className="w-50">
        <FacetedInput placeholder={title} />
        <FacetedList className="max-h-full">
          <FacetedEmpty>No results found.</FacetedEmpty>
          <FacetedGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
            {options.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                {option.icon && <option.icon />}
                <span className="flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="ml-auto font-mono text-xs">
                    {option.count}
                  </span>
                )}
              </FacetedItem>
            ))}
          </FacetedGroup>
          {hasSelection && (
            <>
              <FacetedSeparator />
              <FacetedGroup>
                <FacetedClear>Clear filters</FacetedClear>
              </FacetedGroup>
            </>
          )}
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}
