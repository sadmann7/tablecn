"use client";

import type { Column, RowData, Table } from "@tanstack/react-table";
import type { KeyboardEvent as KeyboardEventPrimitive } from "react-aria-components";

import {
  fromDateToLocal,
  getLocalTimeZone,
  toCalendarDate,
  today,
} from "@internationalized/date";
import { cn } from "cn";
import { parseAsStringEnum, useQueryState } from "nuqs";
import * as React from "react";

import type {
  DataTableColumnMeta,
  ExtendedColumnFilter,
  FilterOperator,
  JoinOperator,
} from "@/lib/data-table-types";
import type { DataTableFeatures } from "@/lib/table-features";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  dataTableConfig,
  getDefaultFilterOperator,
  getFilterOperators,
} from "@/lib/data-table-utils";
import { formatDate } from "@/lib/format";
import { generateId } from "@/lib/id";
import { getFiltersStateParser } from "@/lib/parsers";
import { DataTableRangeFilter } from "@/registry/bases/aria/components/data-table/data-table-range-filter";
import { Badge } from "@/registry/bases/aria/ui/badge";
import { Button } from "@/registry/bases/aria/ui/button";
import { Calendar, RangeCalendar } from "@/registry/bases/aria/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/registry/bases/aria/ui/command";
import {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedTrigger,
} from "@/registry/bases/aria/ui/faceted";
import { Input } from "@/registry/bases/aria/ui/input";
import { Popover, PopoverTrigger } from "@/registry/bases/aria/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/aria/ui/select";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
} from "@/registry/bases/aria/ui/sortable";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;
const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];

interface DataTableFilterListProps<
  TData extends RowData,
> extends React.ComponentProps<typeof Popover> {
  table: Table<DataTableFeatures, TData>;
  debounceMs?: number;
  throttleMs?: number;
  shallow?: boolean;
  disabled?: boolean;
}

export function DataTableFilterList<TData extends RowData>({
  table,
  debounceMs = DEBOUNCE_MS,
  throttleMs = THROTTLE_MS,
  shallow = true,
  disabled,
  ...props
}: DataTableFilterListProps<TData>) {
  const id = React.useId();
  const labelId = React.useId();
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  const columns = React.useMemo(() => {
    return table
      .getAllColumns()
      .filter((column) => column.columnDef.enableColumnFilter);
  }, [table]);

  const [filters, setFilters] = useQueryState(
    table.options.meta?.queryKeys?.filters ?? "filters",
    getFiltersStateParser<TData>(columns.map((field) => field.id))
      .withDefault([])
      .withOptions({
        clearOnDefault: true,
        shallow,
        throttleMs,
      }),
  );
  const debouncedSetFilters = useDebouncedCallback(setFilters, debounceMs);

  const [joinOperator, setJoinOperator] = useQueryState(
    table.options.meta?.queryKeys?.joinOperator ?? "",
    parseAsStringEnum(["and", "or"]).withDefault("and").withOptions({
      clearOnDefault: true,
      shallow,
    }),
  );

  const onFilterAdd = React.useCallback(() => {
    const column = columns[0];

    if (!column) return;

    debouncedSetFilters([
      ...filters,
      {
        id: column.id as Extract<keyof TData, string>,
        value: "",
        variant: column.columnDef.meta?.variant ?? "text",
        operator: getDefaultFilterOperator(
          column.columnDef.meta?.variant ?? "text",
        ),
        filterId: generateId({ length: 8 }),
      },
    ]);
  }, [columns, filters, debouncedSetFilters]);

  const onFilterUpdate = React.useCallback(
    (
      filterId: string,
      updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
    ) => {
      debouncedSetFilters((prevFilters) => {
        const updatedFilters = prevFilters.map((filter) => {
          if (filter.filterId === filterId) {
            return { ...filter, ...updates } as ExtendedColumnFilter<TData>;
          }
          return filter;
        });
        return updatedFilters;
      });
    },
    [debouncedSetFilters],
  );

  const onFilterRemove = React.useCallback(
    (filterId: string) => {
      const updatedFilters = filters.filter(
        (filter) => filter.filterId !== filterId,
      );
      void setFilters(updatedFilters);
      requestAnimationFrame(() => {
        addButtonRef.current?.focus();
      });
    },
    [filters, setFilters],
  );

  const onFiltersReset = React.useCallback(() => {
    void setFilters(null);
    void setJoinOperator("and");
  }, [setFilters, setJoinOperator]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement &&
          event.target.contentEditable === "true")
      ) {
        return;
      }

      if (
        event.key.toLowerCase() === FILTER_SHORTCUT_KEY &&
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey
      ) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onItemKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // GridListItem takes no onKeyDown, so find the row from the target
      const filterId = (event.target as HTMLElement)
        .closest('[data-slot="sortable-item"]')
        ?.getAttribute("data-value");
      if (!filterId) return;

      if (REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase())) {
        event.preventDefault();
        onFilterRemove(filterId);
      }
    },
    [onFilterRemove],
  );

  const onTriggerKeyDown = React.useCallback(
    (event: KeyboardEventPrimitive) => {
      event.continuePropagation();

      if (
        REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase()) &&
        filters.length > 0
      ) {
        event.preventDefault();
        onFilterRemove(filters[filters.length - 1]?.filterId ?? "");
      }
    },
    [filters, onFilterRemove],
  );

  return (
    <Sortable
      value={filters}
      onValueChange={setFilters}
      getItemValue={(item) => item.filterId}
    >
      <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
        <Button
          variant="outline"
          className="font-normal"
          onKeyDown={onTriggerKeyDown}
          isDisabled={disabled}
        >
          <IconPlaceholder
            lucide="ListFilter"
            tabler="IconListDetails"
            hugeicons="LeftToRightListBulletIcon"
            phosphor="ListIcon"
            remixicon="RiListUnordered"
            className="text-muted-foreground"
          />
          Filter
          {filters.length > 0 && (
            <Badge
              variant="secondary"
              className="h-[18.24px] rounded-md px-[5.12px] font-mono text-[10.4px] font-normal"
            >
              {filters.length}
            </Badge>
          )}
        </Button>
        <Popover
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          className="flex w-auto max-w-[calc(100vw-1.5rem)] flex-col gap-3.5 p-4 sm:min-w-95"
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="leading-none font-medium">
              {filters.length > 0 ? "Filters" : "No filters applied"}
            </h4>
            <p
              id={descriptionId}
              className={cn(
                "text-sm text-muted-foreground",
                filters.length > 0 && "sr-only",
              )}
            >
              {filters.length > 0
                ? "Modify filters to refine your rows."
                : "Add filters to refine your rows."}
            </p>
          </div>
          {filters.length > 0 ? (
            <div onKeyDown={onItemKeyDown}>
              <SortableContent
                aria-labelledby={labelId}
                className="flex max-h-75 flex-col gap-2 overflow-y-auto p-1"
              >
                {filters.map((filter, index) => (
                  <DataTableFilterItem<TData>
                    key={filter.filterId}
                    filter={filter}
                    index={index}
                    filterItemId={`${id}-filter-${filter.filterId}`}
                    joinOperator={joinOperator}
                    setJoinOperator={setJoinOperator}
                    columns={columns}
                    onFilterUpdate={onFilterUpdate}
                    onFilterRemove={onFilterRemove}
                  />
                ))}
              </SortableContent>
            </div>
          ) : null}
          <div className="flex w-full items-center gap-2">
            <Button
              className="rounded"
              ref={addButtonRef}
              onPress={onFilterAdd}
            >
              Add filter
            </Button>
            {filters.length > 0 ? (
              <Button
                variant="outline"
                className="rounded"
                onPress={onFiltersReset}
              >
                Reset filters
              </Button>
            ) : null}
          </div>
        </Popover>
      </PopoverTrigger>
    </Sortable>
  );
}

interface DataTableFilterItemProps<TData extends RowData> {
  filter: ExtendedColumnFilter<TData>;
  index: number;
  filterItemId: string;
  joinOperator: JoinOperator;
  setJoinOperator: (value: JoinOperator) => void;
  columns: Column<DataTableFeatures, TData>[];
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void;
  onFilterRemove: (filterId: string) => void;
}

function DataTableFilterItem<TData extends RowData>({
  filter,
  index,
  filterItemId,
  joinOperator,
  setJoinOperator,
  columns,
  onFilterUpdate,
  onFilterRemove,
}: DataTableFilterItemProps<TData>) {
  const [showFieldSelector, setShowFieldSelector] = React.useState(false);
  const [showOperatorSelector, setShowOperatorSelector] = React.useState(false);
  const [showValueSelector, setShowValueSelector] = React.useState(false);

  const column = columns.find((column) => column.id === filter.id);

  const inputId = `${filterItemId}-input`;

  const columnMeta = column?.columnDef.meta;
  const filterOperators = getFilterOperators(filter.variant);

  if (!column) return null;

  return (
    <SortableItem
      value={filter.filterId}
      textValue={columnMeta?.label ?? filter.id}
      className="flex items-center gap-2"
    >
      <div className="min-w-18 text-center">
        {index === 0 ? (
          <span className="text-sm text-muted-foreground">Where</span>
        ) : index === 1 ? (
          <Select
            aria-label="Select join operator"
            placeholder={joinOperator}
            value={joinOperator}
            onChange={(value) => {
              if (value == null) return;
              setJoinOperator(value as JoinOperator);
            }}
          >
            <SelectTrigger className="rounded lowercase">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="lowercase">
              <SelectGroup>
                {dataTableConfig.joinOperators.map((joinOperator) => (
                  <SelectItem key={joinOperator} id={joinOperator}>
                    {joinOperator}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">{joinOperator}</span>
        )}
      </div>
      <PopoverTrigger
        isOpen={showFieldSelector}
        onOpenChange={setShowFieldSelector}
      >
        <Button
          variant="outline"
          className="w-32 justify-between rounded font-normal"
        >
          <span className="truncate">
            {columns.find((column) => column.id === filter.id)?.columnDef.meta
              ?.label ?? "Select field"}
          </span>
          <IconPlaceholder
            lucide="ChevronsUpDown"
            tabler="IconSelector"
            hugeicons="UnfoldMoreIcon"
            phosphor="CaretUpDownIcon"
            remixicon="RiArrowUpDownLine"
            className="opacity-50"
          />
        </Button>
        <Popover placement="bottom start" className="w-40 p-0">
          <Command>
            <CommandInput placeholder="Search fields..." />
            <CommandList
              renderEmptyState={() => (
                <CommandEmpty>No fields found.</CommandEmpty>
              )}
            >
              <CommandGroup>
                {columns.map((column) => (
                  <CommandItem
                    key={column.id}
                    id={column.id}
                    textValue={column.columnDef.meta?.label ?? column.id}
                    onAction={() => {
                      onFilterUpdate(filter.filterId, {
                        id: column.id as Extract<keyof TData, string>,
                        variant: column.columnDef.meta?.variant ?? "text",
                        operator: getDefaultFilterOperator(
                          column.columnDef.meta?.variant ?? "text",
                        ),
                        value: "",
                      });

                      setShowFieldSelector(false);
                    }}
                  >
                    <span className="truncate">
                      {column.columnDef.meta?.label}
                    </span>
                    <IconPlaceholder
                      lucide="Check"
                      tabler="IconCheck"
                      hugeicons="Tick02Icon"
                      phosphor="CheckIcon"
                      remixicon="RiCheckLine"
                      className={cn(
                        "ml-auto",
                        column.id === filter.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover>
      </PopoverTrigger>
      <Select
        aria-label={`${columnMeta?.label} filter operator`}
        placeholder={filter.operator}
        isOpen={showOperatorSelector}
        onOpenChange={setShowOperatorSelector}
        value={filter.operator}
        onChange={(value) => {
          if (value == null) return;
          onFilterUpdate(filter.filterId, {
            operator: value as FilterOperator,
            value:
              value === "isEmpty" || value === "isNotEmpty" ? "" : filter.value,
          });
        }}
      >
        <SelectTrigger className="w-32 rounded lowercase">
          <div className="truncate">
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {filterOperators.map((operator) => (
              <SelectItem
                key={operator.value}
                id={operator.value}
                className="lowercase"
              >
                {operator.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="max-w-60 min-w-36 flex-1">
        {onFilterInputRender({
          filter,
          inputId,
          column,
          columnMeta,
          onFilterUpdate,
          showValueSelector,
          setShowValueSelector,
        })}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-8 rounded"
        onPress={() => onFilterRemove(filter.filterId)}
      >
        <IconPlaceholder
          lucide="Trash2"
          tabler="IconTrash"
          hugeicons="Delete02Icon"
          phosphor="TrashIcon"
          remixicon="RiDeleteBinLine"
        />
      </Button>
      <SortableItemHandle
        variant="outline"
        size="icon"
        className="size-8 rounded"
      >
        <IconPlaceholder
          lucide="GripVertical"
          tabler="IconGripVertical"
          hugeicons="DragDropVerticalIcon"
          phosphor="DotsSixVerticalIcon"
          remixicon="RiDraggable"
        />
      </SortableItemHandle>
    </SortableItem>
  );
}

function onFilterInputRender<TData extends RowData>({
  filter,
  inputId,
  column,
  columnMeta,
  onFilterUpdate,
  showValueSelector,
  setShowValueSelector,
}: {
  filter: ExtendedColumnFilter<TData>;
  inputId: string;
  column: Column<DataTableFeatures, TData>;
  columnMeta?: DataTableColumnMeta;
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void;
  showValueSelector: boolean;
  setShowValueSelector: (value: boolean) => void;
}) {
  if (filter.operator === "isEmpty" || filter.operator === "isNotEmpty") {
    return (
      <div
        id={inputId}
        role="status"
        aria-label={`${columnMeta?.label} filter is ${
          filter.operator === "isEmpty" ? "empty" : "not empty"
        }`}
        aria-live="polite"
        className="h-8 w-full rounded border bg-transparent dark:bg-input/30"
      />
    );
  }

  switch (filter.variant) {
    case "text":
    case "number":
    case "range": {
      if (
        (filter.variant === "range" && filter.operator === "isBetween") ||
        filter.operator === "isBetween"
      ) {
        return (
          <DataTableRangeFilter
            filter={filter}
            column={column}
            inputId={inputId}
            onFilterUpdate={onFilterUpdate}
          />
        );
      }

      const isNumber =
        filter.variant === "number" || filter.variant === "range";

      return (
        <Input
          id={inputId}
          type={isNumber ? "number" : filter.variant}
          aria-label={`${columnMeta?.label} filter value`}
          aria-describedby={`${inputId}-description`}
          inputMode={isNumber ? "numeric" : undefined}
          placeholder={columnMeta?.placeholder ?? "Enter a value..."}
          className="h-8 w-full rounded"
          defaultValue={
            typeof filter.value === "string" ? filter.value : undefined
          }
          onChange={(event) =>
            onFilterUpdate(filter.filterId, {
              value: event.target.value,
            })
          }
        />
      );
    }

    case "boolean": {
      if (Array.isArray(filter.value)) return null;

      return (
        <Select
          aria-label={`${columnMeta?.label} boolean filter`}
          placeholder={filter.value ? "True" : "False"}
          isOpen={showValueSelector}
          onOpenChange={setShowValueSelector}
          value={filter.value}
          onChange={(value) => {
            if (value == null) return;
            onFilterUpdate(filter.filterId, {
              value: String(value),
            });
          }}
        >
          <SelectTrigger id={inputId} className="w-full rounded">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem id="true">True</SelectItem>
              <SelectItem id="false">False</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      );
    }

    case "select":
    case "multiSelect": {
      const multiple = filter.variant === "multiSelect";
      const selectedValues = multiple
        ? Array.isArray(filter.value)
          ? filter.value
          : []
        : typeof filter.value === "string"
          ? filter.value
          : undefined;

      return (
        <Faceted
          open={showValueSelector}
          onOpenChange={setShowValueSelector}
          value={selectedValues}
          onValueChange={(value) => {
            onFilterUpdate(filter.filterId, {
              value,
            });
          }}
          multiple={multiple}
        >
          <FacetedTrigger
            id={inputId}
            aria-label={`${columnMeta?.label} filter value${multiple ? "s" : ""}`}
            variant="outline"
            className="w-full rounded font-normal"
          >
            <FacetedBadgeList
              options={columnMeta?.options}
              placeholder={
                columnMeta?.placeholder ??
                `Select option${multiple ? "s" : ""}...`
              }
            />
          </FacetedTrigger>
          <FacetedContent className="w-50">
            <FacetedInput
              aria-label={`Search ${columnMeta?.label} options`}
              placeholder={columnMeta?.placeholder ?? "Search options..."}
            />
            <FacetedList
              renderEmptyState={() => (
                <FacetedEmpty>No options found.</FacetedEmpty>
              )}
            >
              <FacetedGroup>
                {columnMeta?.options?.map((option) => (
                  <FacetedItem
                    key={option.value}
                    value={option.value}
                    textValue={option.label}
                  >
                    {option.icon && <option.icon />}
                    <span>{option.label}</span>
                    {option.count && (
                      <span className="ml-auto font-mono text-xs">
                        {option.count}
                      </span>
                    )}
                  </FacetedItem>
                ))}
              </FacetedGroup>
            </FacetedList>
          </FacetedContent>
        </Faceted>
      );
    }

    case "date":
    case "dateRange": {
      const dateValue = Array.isArray(filter.value)
        ? filter.value.filter(Boolean)
        : [filter.value, filter.value].filter(Boolean);

      const startDate = dateValue[0]
        ? new Date(Number(dateValue[0]))
        : undefined;
      const endDate = dateValue[1] ? new Date(Number(dateValue[1])) : undefined;

      const isSameDate =
        startDate &&
        endDate &&
        startDate.toDateString() === endDate.toDateString();

      const displayValue =
        filter.operator === "isBetween" && dateValue.length === 2 && !isSameDate
          ? `${formatDate(startDate, { month: "short" })} - ${formatDate(endDate, { month: "short" })}`
          : startDate
            ? formatDate(startDate, { month: "short" })
            : "Pick a date";

      return (
        <PopoverTrigger
          isOpen={showValueSelector}
          onOpenChange={setShowValueSelector}
        >
          <Button
            id={inputId}
            aria-label={`${columnMeta?.label} date filter`}
            variant="outline"
            className={cn(
              "w-full justify-start rounded text-left font-normal",
              !filter.value && "text-muted-foreground",
            )}
          >
            <IconPlaceholder
              lucide="CalendarIcon"
              tabler="IconCalendar"
              hugeicons="CalendarIcon"
              phosphor="CalendarIcon"
              remixicon="RiCalendarLine"
            />
            <span className="truncate">{displayValue}</span>
          </Button>
          <Popover placement="bottom start" className="w-auto p-0">
            {filter.operator === "isBetween" ? (
              <RangeCalendar
                aria-label={`Select ${columnMeta?.label} date range`}
                autoFocus
                captionLayout="dropdown"
                value={
                  dateValue.length === 2
                    ? {
                        start: toCalendarDate(
                          fromDateToLocal(new Date(Number(dateValue[0]))),
                        ),
                        end: toCalendarDate(
                          fromDateToLocal(new Date(Number(dateValue[1]))),
                        ),
                      }
                    : {
                        start: today(getLocalTimeZone()),
                        end: today(getLocalTimeZone()),
                      }
                }
                onChange={(range) => {
                  onFilterUpdate(filter.filterId, {
                    value: [
                      range.start
                        .toDate(getLocalTimeZone())
                        .getTime()
                        .toString(),
                      range.end.toDate(getLocalTimeZone()).getTime().toString(),
                    ],
                  });
                }}
              />
            ) : (
              <Calendar
                aria-label={`Select ${columnMeta?.label} date`}
                autoFocus
                captionLayout="dropdown"
                value={
                  dateValue[0]
                    ? toCalendarDate(
                        fromDateToLocal(new Date(Number(dateValue[0]))),
                      )
                    : null
                }
                onChange={(date) => {
                  onFilterUpdate(filter.filterId, {
                    value: date.toDate(getLocalTimeZone()).getTime().toString(),
                  });
                  setShowValueSelector(false);
                }}
              />
            )}
          </Popover>
        </PopoverTrigger>
      );
    }

    default:
      return null;
  }
}
