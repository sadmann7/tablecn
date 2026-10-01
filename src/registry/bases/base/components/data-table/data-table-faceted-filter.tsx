"use client";

import type * as React from "react";

import { type Column, type RowData, Subscribe } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { Option } from "@/lib/data-table-types";

import { Button } from "@/registry/bases/base/ui/button";
import {
  Faceted,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
  FacetedValue,
} from "@/registry/bases/base/ui/faceted";
import { Separator } from "@/registry/bases/base/ui/separator";
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
      items={options}
      multiple={multiple}
    >
      <FacetedTrigger
        render={<Button variant="outline" className="border-dashed" />}
      >
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
              className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
            />
            <FacetedValue />
          </>
        )}
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
                <FacetedItemIndicator>{option.count}</FacetedItemIndicator>
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
