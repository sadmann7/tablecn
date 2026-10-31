"use client";

import type { Column, RowData } from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnFilterItem } from "@/lib/data-table-types";

import {
  getRangeFilterBounds,
  getValidRangeFilterBounds,
} from "@/lib/data-table-utils";
import { Input } from "@/registry/bases/base/ui/input";

interface DataTableRangeFilterProps<
  TData extends RowData,
> extends React.ComponentProps<"div"> {
  filter: ColumnFilterItem;
  column: Column<DataTableFeatures, TData>;
  inputId: string;
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ColumnFilterItem, "filterId">>,
  ) => void;
}

export function DataTableRangeFilter<TData extends RowData>({
  filter,
  column,
  inputId,
  onFilterUpdate,
  className,
  ...props
}: DataTableRangeFilterProps<TData>) {
  const meta = column.columnDef.meta;

  const [min, max] = React.useMemo(() => {
    const range = column.columnDef.meta?.range;
    if (range) return range;

    const values = column.getFacetedMinMaxValues();
    if (!values) return [0, 100];

    return [values[0], values[1]];
  }, [column]);

  const [startValue, endValue] = getRangeFilterValues(filter.value).map(
    getInputValue,
  );
  const [drafts, setDrafts] = React.useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [startInput, endInput] = getInputValues(drafts);

  function getInputValues(
    nextDrafts: [string | null, string | null],
  ): [string, string] {
    return [nextDrafts[0] ?? startValue ?? "", nextDrafts[1] ?? endValue ?? ""];
  }

  function onBoundsUpdate([start, end]: [
    number | undefined,
    number | undefined,
  ]) {
    onFilterUpdate(filter.filterId, {
      value: [start?.toString() ?? "", end?.toString() ?? ""],
    });
  }

  function onDraftChange(index: 0 | 1, value: string) {
    const nextDrafts: [string | null, string | null] =
      index === 0 ? [value, drafts[1]] : [drafts[0], value];
    setDrafts(nextDrafts);

    const nextBounds = getValidRangeFilterBounds(getInputValues(nextDrafts), [
      min,
      max,
    ]);
    if (nextBounds) onBoundsUpdate(nextBounds);
  }

  function onDraftCommit() {
    if (drafts[0] === null && drafts[1] === null) return;

    onBoundsUpdate(getRangeFilterBounds([startInput, endInput], [min, max]));
    setDrafts([null, null]);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") onDraftCommit();
  }

  return (
    <div
      data-slot="data-table-range-filter"
      className={cn("flex w-full items-center gap-2", className)}
      {...props}
    >
      <Input
        id={`${inputId}-min`}
        type="number"
        aria-label={`${meta?.label} minimum value`}
        aria-valuemin={min}
        aria-valuemax={max}
        data-slot="data-table-range-filter-min"
        inputMode="numeric"
        placeholder={min.toString()}
        min={min}
        max={max}
        className="w-full min-w-24"
        value={startInput}
        onChange={(event) => onDraftChange(0, event.target.value)}
        onBlur={onDraftCommit}
        onKeyDown={onInputKeyDown}
      />
      <span className="sr-only shrink-0 text-muted-foreground">to</span>
      <Input
        id={`${inputId}-max`}
        type="number"
        aria-label={`${meta?.label} maximum value`}
        aria-valuemin={min}
        aria-valuemax={max}
        data-slot="data-table-range-filter-max"
        inputMode="numeric"
        placeholder={max.toString()}
        min={min}
        max={max}
        className="w-full min-w-24"
        value={endInput}
        onChange={(event) => onDraftChange(1, event.target.value)}
        onBlur={onDraftCommit}
        onKeyDown={onInputKeyDown}
      />
    </div>
  );
}

function getRangeFilterValues(value: string | string[]): [string, string] {
  if (Array.isArray(value)) return [value[0] ?? "", value[1] ?? ""];
  return [value, ""];
}

function getInputValue(value: string) {
  return value === "" || Number.isNaN(Number(value)) ? "" : value;
}
