"use client";

import { type Column, type RowData, Subscribe } from "@tanstack/react-table";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import {
  getRangeFilterBounds,
  getValidRangeFilterBounds,
} from "@/lib/data-table-utils";
import { Button } from "@/registry/bases/radix/ui/button";
import { useDirection } from "@/registry/bases/radix/ui/direction";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/registry/bases/radix/ui/input-group";
import { Label } from "@/registry/bases/radix/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/radix/ui/popover";
import { Separator } from "@/registry/bases/radix/ui/separator";
import { Slider } from "@/registry/bases/radix/ui/slider";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const INVALID_RING_DELAY_MS = 500;

type RangeValue = [number, number];

interface DataTableSliderFilterProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData>;
  title?: string;
}

export function DataTableSliderFilter<TData extends RowData>({
  column,
  ...props
}: DataTableSliderFilterProps<TData>) {
  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() => column.getFilterValue()}
    >
      {(filterValue) => (
        <DataTableSliderFilterContent
          column={column}
          columnFilterValue={filterValue}
          {...props}
        />
      )}
    </Subscribe>
  );
}

function DataTableSliderFilterContent<TData extends RowData>({
  column,
  title = column.columnDef.meta?.label ?? column.id,
  columnFilterValue: columnFilterValueProp,
}: DataTableSliderFilterProps<TData> & {
  columnFilterValue: unknown;
}) {
  const dir = useDirection();
  const id = React.useId();

  const meta = column.columnDef.meta;
  const numberMeta = meta?.variant === "number" ? meta : undefined;
  const declaredMin = numberMeta?.min;
  const declaredMax = numberMeta?.max;
  const unit = numberMeta?.unit;

  const [facetedRange, setFacetedRange] = React.useState(() =>
    getFacetedRange(column),
  );
  const min = declaredMin ?? facetedRange[0];
  const max = declaredMax ?? facetedRange[1];
  const step = getRangeStep(min, max);

  function onOpenChange(open: boolean) {
    if (open) setFacetedRange(getFacetedRange(column));
  }

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!column.table.options.manualFiltering) return;
    if (declaredMin !== undefined && declaredMax !== undefined) return;
    console.warn(
      `DataTableSliderFilter: column "${column.id}" is missing \`meta.min\` or \`meta.max\`, so in server mode its bounds only cover the rows on the current page. Set both to the full range of the data.`,
    );
  }, [column, declaredMin, declaredMax]);

  const bounds = parseRangeBounds(columnFilterValueProp);
  const columnFilterValue: RangeValue | undefined = bounds
    ? [bounds[0] ?? min, bounds[1] ?? max]
    : undefined;
  const range: RangeValue = columnFilterValue ?? [min, max];
  const [drafts, setDrafts] = React.useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [showInvalid, setShowInvalid] = React.useState(false);
  const invalidTimeoutRef = React.useRef<number | undefined>(undefined);

  React.useEffect(
    () => () => window.clearTimeout(invalidTimeoutRef.current),
    [],
  );

  function onInvalidChange(isInvalid: boolean) {
    window.clearTimeout(invalidTimeoutRef.current);
    if (!isInvalid) {
      setShowInvalid(false);
      return;
    }
    if (showInvalid) return;
    invalidTimeoutRef.current = window.setTimeout(
      () => setShowInvalid(true),
      INVALID_RING_DELAY_MS,
    );
  }

  const formatValue = React.useCallback((value: number) => {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }, []);

  const setRangeFilter = React.useCallback(
    ([start = min, end = max]: [number | undefined, number | undefined]) => {
      column.setFilterValue(
        start <= min && end >= max ? undefined : [start, end],
      );
    },
    [column, min, max],
  );

  function getInputValues(
    nextDrafts: [string | null, string | null],
  ): [string, string] {
    return [
      nextDrafts[0] ?? range[0].toString(),
      nextDrafts[1] ?? range[1].toString(),
    ];
  }

  function onDraftChange(index: 0 | 1, value: string) {
    const nextDrafts: [string | null, string | null] =
      index === 0 ? [value, drafts[1]] : [drafts[0], value];
    setDrafts(nextDrafts);

    const nextBounds = getValidRangeFilterBounds(getInputValues(nextDrafts), [
      min,
      max,
    ]);
    if (nextBounds) setRangeFilter(nextBounds);
    onInvalidChange(!nextBounds);
  }

  function onDraftCommit() {
    if (drafts[0] === null && drafts[1] === null) return;

    setRangeFilter(getRangeFilterBounds(getInputValues(drafts), [min, max]));
    setDrafts([null, null]);
    onInvalidChange(false);
  }

  function onInputsBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    onDraftCommit();
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") onDraftCommit();
  }

  function onSliderValueChange(value: RangeValue) {
    if (Array.isArray(value) && value.length === 2) {
      setDrafts([null, null]);
      onInvalidChange(false);
      setRangeFilter([value[0], value[1]]);
    }
  }

  function onReset(event: React.MouseEvent) {
    event.stopPropagation();
    setDrafts([null, null]);
    onInvalidChange(false);
    column.setFilterValue(undefined);
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          {columnFilterValue ? (
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
          <span>{title}</span>
          {columnFilterValue ? (
            <>
              <Separator
                orientation="vertical"
                className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
              />
              {formatValue(columnFilterValue[0])} -{" "}
              {formatValue(columnFilterValue[1])}
              {unit ? ` ${unit}` : ""}
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`${title} filter`}
        dir={dir}
        align="start"
        className="flex w-auto flex-col gap-4"
      >
        <div className="flex flex-col gap-3">
          <p className="leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {title}
          </p>
          <div className="flex items-center gap-4" onBlur={onInputsBlur}>
            <Label htmlFor={`${id}-from`} className="sr-only">
              From
            </Label>
            <InputGroup className="w-24">
              <InputGroupInput
                id={`${id}-from`}
                type="number"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-invalid={(showInvalid && drafts[0] !== null) || undefined}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={min.toString()}
                min={min}
                max={max}
                value={drafts[0] ?? range[0].toString()}
                onChange={(event) => onDraftChange(0, event.target.value)}
                onKeyDown={onInputKeyDown}
              />
              {unit && (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{unit}</InputGroupText>
                </InputGroupAddon>
              )}
            </InputGroup>
            <Label htmlFor={`${id}-to`} className="sr-only">
              to
            </Label>
            <InputGroup className="w-24">
              <InputGroupInput
                id={`${id}-to`}
                type="number"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-invalid={(showInvalid && drafts[1] !== null) || undefined}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={max.toString()}
                min={min}
                max={max}
                value={drafts[1] ?? range[1].toString()}
                onChange={(event) => onDraftChange(1, event.target.value)}
                onKeyDown={onInputKeyDown}
              />
              {unit && (
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{unit}</InputGroupText>
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>
          <Label htmlFor={`${id}-slider`} className="sr-only">
            {title} slider
          </Label>
          <Slider
            id={`${id}-slider`}
            min={min}
            max={max}
            step={step}
            value={range}
            onValueChange={onSliderValueChange}
          />
        </div>
        <Button
          aria-label={`Clear ${title} filter`}
          variant="outline"
          onClick={onReset}
        >
          Clear
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function getFacetedRange<TData extends RowData>(
  column: Column<DataTableFeatures, TData>,
): RangeValue {
  const values = column.getFacetedMinMaxValues();
  if (Array.isArray(values) && values.length === 2) {
    const [min, max] = values;
    if (typeof min === "number" && typeof max === "number") return [min, max];
  }
  return [0, 100];
}

function getRangeStep(min: number, max: number) {
  const rangeSize = max - min;
  if (rangeSize <= 20) return 1;
  if (rangeSize <= 100) return Math.ceil(rangeSize / 20);
  return Math.ceil(rangeSize / 50);
}

function parseRangeBounds(
  value: unknown,
): [number | undefined, number | undefined] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;

  const [start, end] = value.map(parseRangeBound);
  if (start === null || end === null) return undefined;
  if (start === undefined && end === undefined) return undefined;

  return [start, end];
}

function parseRangeBound(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "number" && typeof value !== "string") return null;

  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}
