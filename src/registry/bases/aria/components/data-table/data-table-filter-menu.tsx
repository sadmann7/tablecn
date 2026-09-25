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
import { useQueryState } from "nuqs";
import * as React from "react";

import type {
  ExtendedColumnFilter,
  FilterOperator,
} from "@/lib/data-table-types";
import type { DataTableFeatures } from "@/lib/table-features";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  getDefaultFilterOperator,
  getFilterOperators,
} from "@/lib/data-table-utils";
import { formatDate } from "@/lib/format";
import { generateId } from "@/lib/id";
import { getFiltersStateParser } from "@/lib/parsers";
import { DataTableRangeFilter } from "@/registry/bases/aria/components/data-table/data-table-range-filter";
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
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;
const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];

interface DataTableFilterMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof Popover> {
  table: Table<DataTableFeatures, TData>;
  debounceMs?: number;
  throttleMs?: number;
  shallow?: boolean;
  disabled?: boolean;
}

export function DataTableFilterMenu<TData extends RowData>({
  table,
  debounceMs = DEBOUNCE_MS,
  throttleMs = THROTTLE_MS,
  shallow = true,
  disabled,
  className,
  ...props
}: DataTableFilterMenuProps<TData>) {
  const id = React.useId();

  const columns = React.useMemo(() => {
    return table
      .getAllColumns()
      .filter((column) => column.columnDef.enableColumnFilter);
  }, [table]);

  const [open, setOpen] = React.useState(false);
  const [selectedColumn, setSelectedColumn] = React.useState<Column<
    DataTableFeatures,
    TData
  > | null>(null);
  const [inputValue, setInputValue] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const isDateVariant =
    selectedColumn?.columnDef.meta?.variant === "date" ||
    selectedColumn?.columnDef.meta?.variant === "dateRange";

  const onOpenChange = React.useCallback((open: boolean) => {
    setOpen(open);

    if (!open) {
      setTimeout(() => {
        setSelectedColumn(null);
        setInputValue("");
      }, 100);
    }
  }, []);

  const onInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase()) &&
        !inputValue &&
        selectedColumn
      ) {
        event.preventDefault();
        setSelectedColumn(null);
      }
    },
    [inputValue, selectedColumn],
  );

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

  const onFilterAdd = React.useCallback(
    (column: Column<DataTableFeatures, TData>, value: string) => {
      if (!value.trim() && column.columnDef.meta?.variant !== "boolean") {
        return;
      }

      const filterValue =
        column.columnDef.meta?.variant === "multiSelect" ? [value] : value;

      const newFilter: ExtendedColumnFilter<TData> = {
        id: column.id as Extract<keyof TData, string>,
        value: filterValue,
        variant: column.columnDef.meta?.variant ?? "text",
        operator: getDefaultFilterOperator(
          column.columnDef.meta?.variant ?? "text",
        ),
        filterId: generateId({ length: 8 }),
      };

      debouncedSetFilters([...filters, newFilter]);
      setOpen(false);

      setTimeout(() => {
        setSelectedColumn(null);
        setInputValue("");
      }, 100);
    },
    [filters, debouncedSetFilters],
  );

  const onFilterRemove = React.useCallback(
    (filterId: string) => {
      const updatedFilters = filters.filter(
        (filter) => filter.filterId !== filterId,
      );
      debouncedSetFilters(updatedFilters);
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    },
    [filters, debouncedSetFilters],
  );

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

  const onFiltersReset = React.useCallback(() => {
    debouncedSetFilters([]);
  }, [debouncedSetFilters]);

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
    <div role="list" className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <DataTableFilterItem
          key={filter.filterId}
          filter={filter}
          filterItemId={`${id}-filter-${filter.filterId}`}
          columns={columns}
          onFilterUpdate={onFilterUpdate}
          onFilterRemove={onFilterRemove}
        />
      ))}
      {filters.length > 0 && (
        <Button
          aria-label="Reset all filters"
          variant="outline"
          size="icon"
          className="size-8"
          onPress={onFiltersReset}
        >
          <IconPlaceholder
            lucide="X"
            tabler="IconX"
            hugeicons="Cancel01Icon"
            phosphor="XIcon"
            remixicon="RiCloseLine"
          />
        </Button>
      )}
      <PopoverTrigger isOpen={open} onOpenChange={onOpenChange}>
        <Button
          aria-label="Open filter command menu"
          variant="outline"
          size={filters.length > 0 ? "icon" : "sm"}
          className={cn(filters.length > 0 && "size-8", "h-8 font-normal")}
          ref={triggerRef}
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
          {filters.length > 0 ? null : "Filter"}
        </Button>
        <Popover
          className={cn("w-auto max-w-[calc(100vw-1.5rem)] p-0", className)}
          {...props}
        >
          <Command
            inputValue={inputValue}
            onInputChange={setInputValue}
            className="[&_[data-slot=command-input-wrapper]_svg]:hidden"
          >
            <CommandInput
              placeholder={
                selectedColumn
                  ? (selectedColumn.columnDef.meta?.label ?? selectedColumn.id)
                  : "Search fields..."
              }
              onKeyDown={onInputKeyDown}
            />
            <CommandList
              shouldFocusWrap
              shouldCloseOnSelect={false}
              renderEmptyState={() =>
                selectedColumn ? (
                  selectedColumn.columnDef.meta?.options ? (
                    <CommandEmpty>No options found.</CommandEmpty>
                  ) : null
                ) : (
                  <CommandEmpty>No fields found.</CommandEmpty>
                )
              }
            >
              {selectedColumn ? (
                isDateVariant ? null : (
                  <FilterValueSelector
                    column={selectedColumn}
                    value={inputValue}
                    onSelect={(value) => onFilterAdd(selectedColumn, value)}
                  />
                )
              ) : (
                <CommandGroup>
                  {columns.map((column) => (
                    <CommandItem
                      key={column.id}
                      id={column.id}
                      textValue={column.columnDef.meta?.label ?? column.id}
                      onAction={() => {
                        setSelectedColumn(column);
                        setInputValue("");
                      }}
                    >
                      {column.columnDef.meta?.icon && (
                        <column.columnDef.meta.icon />
                      )}
                      <span className="truncate">
                        {column.columnDef.meta?.label ?? column.id}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            {selectedColumn && isDateVariant ? (
              <FilterValueSelector
                column={selectedColumn}
                value={inputValue}
                onSelect={(value) => onFilterAdd(selectedColumn, value)}
              />
            ) : null}
          </Command>
        </Popover>
      </PopoverTrigger>
    </div>
  );
}

interface DataTableFilterItemProps<TData extends RowData> {
  filter: ExtendedColumnFilter<TData>;
  filterItemId: string;
  columns: Column<DataTableFeatures, TData>[];
  onFilterUpdate: (
    filterId: string,
    updates: Partial<Omit<ExtendedColumnFilter<TData>, "filterId">>,
  ) => void;
  onFilterRemove: (filterId: string) => void;
}

function DataTableFilterItem<TData extends RowData>({
  filter,
  filterItemId,
  columns,
  onFilterUpdate,
  onFilterRemove,
}: DataTableFilterItemProps<TData>) {
  {
    const [showFieldSelector, setShowFieldSelector] = React.useState(false);
    const [showOperatorSelector, setShowOperatorSelector] =
      React.useState(false);
    const [showValueSelector, setShowValueSelector] = React.useState(false);

    const column = columns.find((column) => column.id === filter.id);

    const inputId = `${filterItemId}-input`;

    const columnMeta = column?.columnDef.meta;
    const filterOperators = getFilterOperators(filter.variant);

    const onItemKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        ) {
          return;
        }

        if (showFieldSelector || showOperatorSelector || showValueSelector) {
          return;
        }

        if (REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase())) {
          event.preventDefault();
          onFilterRemove(filter.filterId);
        }
      },
      [
        filter.filterId,
        showFieldSelector,
        showOperatorSelector,
        showValueSelector,
        onFilterRemove,
      ],
    );

    if (!column) return null;

    return (
      <div
        key={filter.filterId}
        role="listitem"
        id={filterItemId}
        className="flex h-8 items-center rounded-md bg-background"
        onKeyDown={onItemKeyDown}
      >
        <PopoverTrigger
          isOpen={showFieldSelector}
          onOpenChange={setShowFieldSelector}
        >
          <Button
            variant="ghost"
            className="rounded-none rounded-l-md border border-r-0 border-input font-normal dark:bg-input/30"
          >
            {columnMeta?.icon && (
              <columnMeta.icon className="text-muted-foreground" />
            )}
            {columnMeta?.label ?? column.id}
          </Button>
          <Popover placement="bottom start" className="w-48 p-0">
            <Command>
              <CommandInput placeholder="Search fields..." />
              <CommandList
                shouldFocusWrap
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
                      data-checked={column.id === filter.id}
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
                      {column.columnDef.meta?.icon && (
                        <column.columnDef.meta.icon />
                      )}
                      <span className="truncate">
                        {column.columnDef.meta?.label ?? column.id}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </Popover>
        </PopoverTrigger>
        <Select
          aria-label={`${columnMeta?.label ?? column.id} filter operator`}
          placeholder={filter.operator}
          isOpen={showOperatorSelector}
          onOpenChange={setShowOperatorSelector}
          value={filter.operator}
          onChange={(value) => {
            if (value == null) return;
            onFilterUpdate(filter.filterId, {
              operator: value as FilterOperator,
              value:
                value === "isEmpty" || value === "isNotEmpty"
                  ? ""
                  : filter.value,
            });
          }}
        >
          <SelectTrigger className="h-8 rounded-none border-r-0 px-2.5 lowercase data-size:h-8 [&_svg]:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {filterOperators.map((operator) => (
                <SelectItem
                  key={operator.value}
                  className="lowercase"
                  id={operator.value}
                >
                  {operator.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {onFilterInputRender({
          filter,
          column,
          inputId,
          onFilterUpdate,
          showValueSelector,
          setShowValueSelector,
        })}
        <Button
          aria-controls={filterItemId}
          variant="ghost"
          className="h-full rounded-none rounded-r-md border border-l-0 border-input px-1.5 font-normal dark:bg-input/30"
          onPress={() => onFilterRemove(filter.filterId)}
        >
          <IconPlaceholder
            lucide="X"
            tabler="IconX"
            hugeicons="Cancel01Icon"
            phosphor="XIcon"
            remixicon="RiCloseLine"
            className="size-3.5"
          />
        </Button>
      </div>
    );
  }
}

interface FilterValueSelectorProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData>;
  value: string;
  onSelect: (value: string) => void;
}

function FilterValueSelector<TData extends RowData>({
  column,
  value,
  onSelect,
}: FilterValueSelectorProps<TData>) {
  const variant = column.columnDef.meta?.variant ?? "text";

  switch (variant) {
    case "boolean":
      return (
        <CommandGroup>
          <CommandItem id="true" onAction={() => onSelect("true")}>
            True
          </CommandItem>
          <CommandItem id="false" onAction={() => onSelect("false")}>
            False
          </CommandItem>
        </CommandGroup>
      );

    case "select":
    case "multiSelect":
      return (
        <CommandGroup>
          {column.columnDef.meta?.options?.map((option) => (
            <CommandItem
              key={option.value}
              id={option.value}
              textValue={option.label}
              className="[&>svg:last-child]:hidden"
              onAction={() => onSelect(option.value)}
            >
              {option.icon && <option.icon />}
              <span className="truncate">{option.label}</span>
              {option.count && (
                <span className="ml-auto font-mono text-xs">
                  {option.count}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      );

    case "date":
    case "dateRange":
      return (
        <Calendar
          autoFocus
          captionLayout="dropdown"
          value={
            value ? toCalendarDate(fromDateToLocal(new Date(value))) : null
          }
          onChange={(date) =>
            onSelect(date.toDate(getLocalTimeZone()).getTime().toString())
          }
        />
      );

    default: {
      const isEmpty = !value.trim();

      return (
        <CommandGroup>
          <CommandItem
            textValue={value}
            onAction={() => onSelect(value)}
            isDisabled={isEmpty}
          >
            {isEmpty ? (
              <>
                <IconPlaceholder
                  lucide="Text"
                  tabler="IconTextCaption"
                  hugeicons="TextCheckIcon"
                  phosphor="TextTIcon"
                  remixicon="RiTextWrap"
                />
                <span>Type to add filter...</span>
              </>
            ) : (
              <>
                <IconPlaceholder
                  lucide="BadgeCheck"
                  tabler="IconRosetteDiscountCheck"
                  hugeicons="CheckmarkBadgeIcon"
                  phosphor="CheckCircleIcon"
                  remixicon="RiCheckboxCircleLine"
                />
                <span className="truncate">Filter by &quot;{value}&quot;</span>
              </>
            )}
          </CommandItem>
        </CommandGroup>
      );
    }
  }
}

function onFilterInputRender<TData extends RowData>({
  filter,
  column,
  inputId,
  onFilterUpdate,
  showValueSelector,
  setShowValueSelector,
}: {
  filter: ExtendedColumnFilter<TData>;
  column: Column<DataTableFeatures, TData>;
  inputId: string;
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
        aria-label={`${column.columnDef.meta?.label} filter is ${
          filter.operator === "isEmpty" ? "empty" : "not empty"
        }`}
        aria-live="polite"
        className="h-full w-16 rounded-none border border-input bg-transparent px-1.5 py-0.5 text-muted-foreground dark:bg-input/30"
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
            className="size-full max-w-28 gap-0 **:data-[slot='range-min']:border-r-0 [&_input]:rounded-none [&_input]:px-1.5"
          />
        );
      }

      const isNumber =
        filter.variant === "number" || filter.variant === "range";

      return (
        <Input
          id={inputId}
          type={isNumber ? "number" : "text"}
          inputMode={isNumber ? "numeric" : undefined}
          placeholder={column.columnDef.meta?.placeholder ?? "Enter value..."}
          className="h-full w-24 rounded-none px-1.5"
          defaultValue={typeof filter.value === "string" ? filter.value : ""}
          onChange={(event) =>
            onFilterUpdate(filter.filterId, { value: event.target.value })
          }
        />
      );
    }

    case "boolean": {
      return (
        <Select
          aria-label={`${column.columnDef.meta?.label} boolean filter`}
          placeholder={filter.value ? "True" : "False"}
          isOpen={showValueSelector}
          onOpenChange={setShowValueSelector}
          value={typeof filter.value === "string" ? filter.value : "true"}
          onChange={(value) => {
            if (value == null) return;
            onFilterUpdate(filter.filterId, { value: String(value) });
          }}
        >
          <SelectTrigger
            id={inputId}
            className="rounded-none bg-transparent px-1.5 py-0.5 [&_svg]:hidden"
          >
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
      const options = column.columnDef.meta?.options ?? [];
      const selectedValues = Array.isArray(filter.value)
        ? filter.value
        : [filter.value];

      const selectedOptions = options.filter((option) =>
        selectedValues.includes(option.value),
      );

      return (
        <PopoverTrigger
          isOpen={showValueSelector}
          onOpenChange={setShowValueSelector}
        >
          <Button
            id={inputId}
            variant="ghost"
            className="h-full min-w-16 rounded-none border border-input px-1.5 font-normal dark:bg-input/30"
          >
            {selectedOptions.length === 0 ? (
              filter.variant === "multiSelect" ? (
                "Select options..."
              ) : (
                "Select option..."
              )
            ) : (
              <>
                <div className="flex items-center -space-x-2 rtl:space-x-reverse">
                  {selectedOptions.map((selectedOption) =>
                    selectedOption.icon ? (
                      <div
                        key={selectedOption.value}
                        className="rounded-full border bg-background p-0.5"
                      >
                        <selectedOption.icon className="size-3.5" />
                      </div>
                    ) : null,
                  )}
                </div>
                <span className="truncate">
                  {selectedOptions.length > 1
                    ? `${selectedOptions.length} selected`
                    : selectedOptions[0]?.label}
                </span>
              </>
            )}
          </Button>
          <Popover placement="bottom start" className="w-48 p-0">
            <Command>
              <CommandInput placeholder="Search options..." />
              <CommandList
                shouldCloseOnSelect={false}
                renderEmptyState={() => (
                  <CommandEmpty>No options found.</CommandEmpty>
                )}
              >
                <CommandGroup>
                  {options.map((option) => {
                    const isMultiSelect = filter.variant === "multiSelect";
                    const isSelected = selectedValues.includes(option.value);

                    return (
                      <CommandItem
                        key={option.value}
                        id={option.value}
                        textValue={option.label}
                        data-checked={isMultiSelect ? isSelected : undefined}
                        onAction={() => {
                          const value = isMultiSelect
                            ? isSelected
                              ? selectedValues.filter((v) => v !== option.value)
                              : [...selectedValues, option.value]
                            : option.value;
                          onFilterUpdate(filter.filterId, { value });
                        }}
                      >
                        {option.icon && <option.icon />}
                        <span className="truncate">{option.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </Popover>
        </PopoverTrigger>
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
            : "Pick date...";

      return (
        <PopoverTrigger
          isOpen={showValueSelector}
          onOpenChange={setShowValueSelector}
        >
          <Button
            id={inputId}
            variant="ghost"
            className={cn(
              "h-full rounded-none border px-1.5 font-normal dark:bg-input/30",
              !filter.value && "text-muted-foreground",
            )}
          >
            <IconPlaceholder
              lucide="CalendarIcon"
              tabler="IconCalendar"
              hugeicons="CalendarIcon"
              phosphor="CalendarIcon"
              remixicon="RiCalendarLine"
              className="size-3.5"
            />
            <span className="truncate">{displayValue}</span>
          </Button>
          <Popover placement="bottom start" className="w-auto p-0">
            {filter.operator === "isBetween" ? (
              <RangeCalendar
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
