"use client";

import {
  fromDateToLocal,
  getLocalTimeZone,
  toCalendarDate,
} from "@internationalized/date";
import { type Column, type RowData, Subscribe } from "@tanstack/react-table";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";

import { formatDate } from "@/lib/format";
import { Button } from "@/registry/bases/aria/ui/button";
import { Calendar, RangeCalendar } from "@/registry/bases/aria/ui/calendar";
import { useDirection } from "@/registry/bases/aria/ui/direction";
import { Popover, PopoverTrigger } from "@/registry/bases/aria/ui/popover";
import { Separator } from "@/registry/bases/aria/ui/separator";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DateRange {
  from?: Date;
  to?: Date;
}
type DateSelection = Date[] | DateRange;

interface DataTableDateFilterProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData>;
  title?: string;
  multiple?: boolean;
}

export function DataTableDateFilter<TData extends RowData>({
  column,
  ...props
}: DataTableDateFilterProps<TData>) {
  return (
    <Subscribe
      source={column.table.atoms.columnFilters}
      selector={() => column.getFilterValue()}
    >
      {(filterValue) => (
        <DataTableDateFilterContent
          column={column}
          columnFilterValue={filterValue}
          {...props}
        />
      )}
    </Subscribe>
  );
}

function DataTableDateFilterContent<TData extends RowData>({
  column,
  title = column.columnDef.meta?.label ?? column.id,
  multiple,
  columnFilterValue,
}: DataTableDateFilterProps<TData> & {
  columnFilterValue: unknown;
}) {
  const dir = useDirection();
  const selectedDates = React.useMemo<DateSelection>(() => {
    if (!columnFilterValue) {
      return multiple ? { from: undefined, to: undefined } : [];
    }

    const timestamps = parseColumnFilterValue(columnFilterValue);
    if (multiple) {
      return {
        from: parseAsDate(timestamps[0]),
        to: parseAsDate(timestamps[1]),
      };
    }

    const date = parseAsDate(timestamps[0]);
    return date ? [date] : [];
  }, [columnFilterValue, multiple]);

  const onSelect = React.useCallback(
    (date: Date | DateRange | undefined) => {
      if (!date) {
        column.setFilterValue(undefined);
        return;
      }

      if (multiple && !("getTime" in date)) {
        const from = date.from?.getTime();
        const to = date.to?.getTime();
        column.setFilterValue(from || to ? [from, to] : undefined);
      } else if (!multiple && "getTime" in date) {
        column.setFilterValue(date.getTime());
      }
    },
    [column, multiple],
  );

  const onReset = React.useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      column.setFilterValue(undefined);
    },
    [column],
  );

  const hasValue = getIsDateRange(selectedDates)
    ? Boolean(selectedDates.from || selectedDates.to)
    : selectedDates.length > 0;
  const dateText = getIsDateRange(selectedDates)
    ? formatDateRange(selectedDates)
    : formatDate(selectedDates[0]);

  const label = (
    <span className="flex items-center gap-2">
      <span>{title}</span>
      {hasValue && (
        <>
          <Separator
            orientation="vertical"
            className="mx-0.5 data-vertical:h-4 data-vertical:self-center"
          />
          <span>{dateText}</span>
        </>
      )}
    </span>
  );

  return (
    <PopoverTrigger>
      <Button variant="outline">
        {hasValue ? (
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
            lucide="CalendarIcon"
            tabler="IconCalendar"
            hugeicons="CalendarIcon"
            phosphor="CalendarIcon"
            remixicon="RiCalendarLine"
          />
        )}
        {label}
      </Button>
      <Popover dir={dir} className="w-auto p-0" placement="bottom start">
        {multiple ? (
          <RangeCalendar
            autoFocus
            captionLayout="dropdown"
            value={
              getIsDateRange(selectedDates) &&
              selectedDates.from &&
              selectedDates.to
                ? {
                    start: toCalendarDate(fromDateToLocal(selectedDates.from)),
                    end: toCalendarDate(fromDateToLocal(selectedDates.to)),
                  }
                : null
            }
            onChange={(range) =>
              onSelect({
                from: range.start.toDate(getLocalTimeZone()),
                to: range.end.toDate(getLocalTimeZone()),
              })
            }
          />
        ) : (
          <Calendar
            captionLayout="dropdown"
            value={
              !getIsDateRange(selectedDates) && selectedDates[0]
                ? toCalendarDate(fromDateToLocal(selectedDates[0]))
                : null
            }
            onChange={(date) => onSelect(date.toDate(getLocalTimeZone()))}
          />
        )}
        {hasValue && (
          <div className="border-t p-3">
            <Button
              aria-label={`Clear ${title} filter`}
              variant="outline"
              className="w-full"
              onPress={() => onReset()}
            >
              Clear
            </Button>
          </div>
        )}
      </Popover>
    </PopoverTrigger>
  );
}

function parseColumnFilterValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "number" || typeof item === "string" ? item : undefined,
    );
  }
  if (typeof value === "string" || typeof value === "number") return [value];
  return [];
}

function parseAsDate(timestamp: number | string | undefined): Date | undefined {
  if (!timestamp) return undefined;
  const numericTimestamp =
    typeof timestamp === "string" ? Number(timestamp) : timestamp;
  const date = new Date(numericTimestamp);
  return !Number.isNaN(date.getTime()) ? date : undefined;
}

function getIsDateRange(value: DateSelection): value is DateRange {
  return !Array.isArray(value);
}

function formatDateRange(range: DateRange) {
  if (range.from && range.to) {
    return `${formatDate(range.from)} - ${formatDate(range.to)}`;
  }
  return formatDate(range.from ?? range.to);
}
