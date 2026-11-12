"use client";

import type * as React from "react";

import { type Column, type RowData, Subscribe } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnSelectOption } from "@/lib/data-table-types";

import { Button } from "@/registry/bases/radix/ui/button";
import { useDirection } from "@/registry/bases/radix/ui/direction";
import {
  Faceted,
  FacetedBadge,
  FacetedBadgeList,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedTrigger,
  FacetedValue,
} from "@/registry/bases/radix/ui/faceted";
import { Separator } from "@/registry/bases/radix/ui/separator";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataTableFacetedFilterProps<TData extends RowData, TValue> {
  column?: Column<DataTableFeatures, TData, TValue>;
  title?: string;
  options: ColumnSelectOption[];
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
  title = column?.columnDef.meta?.label ?? column?.id,
  options,
  multiple = false,
  columnFilterValue,
}: DataTableFacetedFilterContentProps<TData, TValue>) {
  const dir = useDirection();
  const selectedValues = Array.isArray(columnFilterValue)
    ? columnFilterValue.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const hasSelection = selectedValues.length > 0;

  function onValueChange(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    column?.setFilterValue(values.length > 0 ? values : undefined);
  }

  function onReset(event: React.MouseEvent) {
    event.stopPropagation();
    column?.setFilterValue(undefined);
  }

  return (
    <Faceted
      value={multiple ? selectedValues : selectedValues[0]}
      onValueChange={onValueChange}
      items={options}
      multiple={multiple}
    >
      <FacetedTrigger asChild>
        <Button variant="outline" className="max-w-full shrink">
          {hasSelection ? (
            <span
              aria-hidden="true"
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
              onClick={onReset}
            >
              <IconPlaceholder
                lucide="XCircle"
                tabler="IconCircleX"
                hugeicons="Cancel01Icon"
                phosphor="XCircleIcon"
                remixicon="RiCloseCircleLine"
              />
            </span>
          ) : (
            <IconPlaceholder
              lucide="PlusCircle"
              tabler="IconCirclePlus"
              hugeicons="PlusSignCircleIcon"
              phosphor="PlusCircleIcon"
              remixicon="RiAddCircleLine"
            />
          )}
          <span className="truncate">{title}</span>
          {hasSelection && (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
              />
              <FacetedValue>
                {(selected) => (
                  <FacetedBadgeList className="min-w-0 flex-nowrap">
                    {selected.length > 2 ? (
                      <FacetedBadge>
                        <bdi>{selected.length} selected</bdi>
                      </FacetedBadge>
                    ) : (
                      selected.map((item) => (
                        <FacetedBadge
                          key={item.value}
                          className="max-w-40"
                          title={item.label}
                        >
                          <span className="truncate">{item.label}</span>
                        </FacetedBadge>
                      ))
                    )}
                  </FacetedBadgeList>
                )}
              </FacetedValue>
            </>
          )}
        </Button>
      </FacetedTrigger>
      <FacetedContent
        aria-label={`${title} filter`}
        dir={dir}
        className="w-auto max-w-80 min-w-50"
      >
        <FacetedInput placeholder={title} />
        <FacetedList className="max-h-full">
          <FacetedEmpty>No results found.</FacetedEmpty>
          <FacetedGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
            {options.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                {option.icon && <option.icon />}
                <span className="flex-1 truncate" title={option.label}>
                  {option.label}
                </span>
                <FacetedItemIndicator>
                  {option.count?.toLocaleString()}
                </FacetedItemIndicator>
              </FacetedItem>
            ))}
          </FacetedGroup>
          <FacetedClear>Clear filters</FacetedClear>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}
