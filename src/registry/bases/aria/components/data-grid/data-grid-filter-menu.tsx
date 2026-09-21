"use client";

import type {
  Column,
  ColumnFilter,
  RowData,
  Table,
} from "@tanstack/react-table";
import type { KeyboardEvent as KeyboardEventPrimitive } from "react-aria-components";

import {
  fromDateToLocal,
  getLocalTimeZone,
  toCalendarDate,
} from "@internationalized/date";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { FilterOperator, FilterValue } from "@/lib/data-grid-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  getDefaultOperator,
  getOperatorsForVariant,
} from "@/lib/data-grid-filters";
import { formatDate } from "@/lib/format";
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
import { useDirection } from "@/registry/bases/aria/ui/direction";
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

const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = new Set(["backspace", "delete"]);
const FILTER_DEBOUNCE_MS = 300;
const OPERATORS_WITHOUT_VALUE = new Set([
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
]);

interface DataGridFilterMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof Popover> {
  table: Table<DataGridFeatures, TData>;
  disabled?: boolean;
}

export function DataGridFilterMenu<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataGridFilterMenuProps<TData>) {
  const dir = useDirection();
  const id = React.useId();
  const labelId = React.useId();
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  const columnFilters = table.store.state.columnFilters;

  const { columnLabels, columns, columnVariants } = React.useMemo(() => {
    const labels = new Map<string, string>();
    const variants = new Map<string, string>();
    const filteringIds = new Set(columnFilters.map((f) => f.id));
    const availableColumns: { id: string; label: string }[] = [];

    for (const column of table.getAllColumns()) {
      if (!column.getCanFilter()) continue;

      const label = column.columnDef.meta?.label ?? column.id;
      const variant = column.columnDef.meta?.cell?.variant ?? "short-text";

      labels.set(column.id, label);
      variants.set(column.id, variant);

      if (!filteringIds.has(column.id)) {
        availableColumns.push({ id: column.id, label });
      }
    }

    return {
      columnLabels: labels,
      columns: availableColumns,
      columnVariants: variants,
    };
  }, [columnFilters, table]);

  const onFilterAdd = React.useCallback(() => {
    const firstColumn = columns[0];
    if (!firstColumn) return;

    const variant = columnVariants.get(firstColumn.id) ?? "short-text";
    const defaultOperator = getDefaultOperator(variant);

    table.setColumnFilters((prevFilters) => [
      ...prevFilters,
      {
        id: firstColumn.id,
        value: {
          operator: defaultOperator,
          value: "",
        },
      },
    ]);
  }, [columns, columnVariants, table]);

  const onFilterUpdate = React.useCallback(
    (filterId: string, updates: Partial<ColumnFilter>) => {
      table.setColumnFilters((prevFilters) => {
        if (!prevFilters) return prevFilters;
        return prevFilters.map((filter) =>
          filter.id === filterId ? { ...filter, ...updates } : filter,
        );
      });
    },
    [table],
  );

  const onFilterRemove = React.useCallback(
    (filterId: string) => {
      table.setColumnFilters((prevFilters) =>
        prevFilters.filter((item) => item.id !== filterId),
      );
    },
    [table],
  );

  const onFiltersReset = React.useCallback(() => {
    table.setColumnFilters(table.initialState.columnFilters ?? []);
  }, [table]);

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

      if (REMOVE_FILTER_SHORTCUTS.has(event.key.toLowerCase())) {
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
        REMOVE_FILTER_SHORTCUTS.has(event.key.toLowerCase()) &&
        columnFilters.length > 0
      ) {
        event.preventDefault();
        onFiltersReset();
      }
    },
    [columnFilters.length, onFiltersReset],
  );

  return (
    <Sortable
      value={columnFilters}
      onValueChange={table.setColumnFilters}
      getItemValue={(item) => item.id}
    >
      <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
        <Button
          dir={dir}
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
          {columnFilters.length > 0 && (
            <Badge
              variant="secondary"
              className="h-[18.24px] rounded-md px-[5.12px] font-mono text-[10.4px] font-normal"
            >
              {columnFilters.length}
            </Badge>
          )}
        </Button>
        <Popover
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          dir={dir}
          className={cn(
            "flex w-auto max-w-[calc(100vw-1.5rem)] flex-col gap-3.5 p-4 sm:min-w-120",
            className,
          )}
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="leading-none font-medium">
              {columnFilters.length > 0 ? "Filter by" : "No filters applied"}
            </h4>
            <p
              id={descriptionId}
              className={cn(
                "text-sm text-muted-foreground",
                columnFilters.length > 0 && "sr-only",
              )}
            >
              {columnFilters.length > 0
                ? "Modify filters to narrow down your data."
                : "Add filters to narrow down your data."}
            </p>
          </div>
          {columnFilters.length > 0 && (
            <div onKeyDown={onItemKeyDown}>
              <SortableContent
                aria-labelledby={labelId}
                className="flex max-h-100 flex-col gap-2 overflow-y-auto p-1"
              >
                {columnFilters.map((filter, index) => (
                  <DataGridFilterItem
                    key={filter.id}
                    filter={filter}
                    index={index}
                    filterItemId={`${id}-filter-${filter.id}`}
                    dir={dir}
                    columns={columns}
                    columnLabels={columnLabels}
                    columnVariants={columnVariants}
                    table={table}
                    onFilterUpdate={onFilterUpdate}
                    onFilterRemove={onFilterRemove}
                  />
                ))}
              </SortableContent>
            </div>
          )}
          <div className="flex w-full items-center gap-2">
            <Button
              className="rounded"
              ref={addButtonRef}
              onPress={onFilterAdd}
              isDisabled={columns.length === 0}
            >
              Add filter
            </Button>
            {columnFilters.length > 0 && (
              <Button
                variant="outline"
                className="rounded"
                onPress={onFiltersReset}
              >
                Reset filters
              </Button>
            )}
          </div>
        </Popover>
      </PopoverTrigger>
    </Sortable>
  );
}

interface DataGridFilterItemProps<TData extends RowData> {
  filter: ColumnFilter;
  index: number;
  filterItemId: string;
  dir: "ltr" | "rtl";
  columns: { id: string; label: string }[];
  columnLabels: Map<string, string>;
  columnVariants: Map<string, string>;
  table: Table<DataGridFeatures, TData>;
  onFilterUpdate: (filterId: string, updates: Partial<ColumnFilter>) => void;
  onFilterRemove: (filterId: string) => void;
}

function DataGridFilterItem<TData extends RowData>({
  filter,
  index,
  filterItemId,
  dir,
  columns,
  columnLabels,
  columnVariants,
  table,
  onFilterUpdate,
  onFilterRemove,
}: DataGridFilterItemProps<TData>) {
  const fieldTriggerId = `${filterItemId}-field-trigger`;
  const inputId = `${filterItemId}-input`;

  const [showFieldSelector, setShowFieldSelector] = React.useState(false);
  const [showOperatorSelector, setShowOperatorSelector] = React.useState(false);

  const variant = columnVariants.get(filter.id) ?? "short-text";
  const filterValue = filter.value as FilterValue | undefined;
  const operator = filterValue?.operator ?? getDefaultOperator(variant);

  const operators = getOperatorsForVariant(variant);
  const needsValue = !OPERATORS_WITHOUT_VALUE.has(operator);

  const column = table.getColumn(filter.id);

  const onOperatorChange = React.useCallback(
    (newOperator: FilterOperator) => {
      onFilterUpdate(filter.id, {
        value: {
          operator: newOperator,
          value: filterValue?.value,
          endValue: filterValue?.endValue,
        },
      });
    },
    [filter.id, filterValue?.value, filterValue?.endValue, onFilterUpdate],
  );

  const onValueChange = React.useCallback(
    (newValue: string | number | string[] | undefined) => {
      onFilterUpdate(filter.id, {
        value: {
          operator,
          value: newValue,
          endValue: filterValue?.endValue,
        },
      });
    },
    [filter.id, operator, filterValue?.endValue, onFilterUpdate],
  );

  const onEndValueChange = React.useCallback(
    (newValue: string | number | string[] | undefined) => {
      onFilterUpdate(filter.id, {
        value: {
          operator,
          value: filterValue?.value,
          endValue: newValue as string | number | undefined,
        },
      });
    },
    [filter.id, operator, filterValue?.value, onFilterUpdate],
  );

  return (
    <SortableItem
      value={filter.id}
      textValue={columnLabels.get(filter.id)}
      className="flex items-center gap-2"
    >
      <div className="min-w-18 text-center">
        {index === 0 ? (
          <span className="text-sm text-muted-foreground">Where</span>
        ) : (
          <span className="text-sm text-muted-foreground">And</span>
        )}
      </div>
      <PopoverTrigger
        isOpen={showFieldSelector}
        onOpenChange={setShowFieldSelector}
      >
        <Button
          id={fieldTriggerId}
          dir={dir}
          variant="outline"
          className="w-32 justify-between rounded font-normal"
        >
          <span className="truncate">{columnLabels.get(filter.id)}</span>
          <IconPlaceholder
            lucide="ChevronsUpDown"
            tabler="IconSelector"
            hugeicons="UnfoldMoreIcon"
            phosphor="CaretUpDownIcon"
            remixicon="RiArrowUpDownLine"
            className="opacity-50"
          />
        </Button>
        <Popover dir={dir} placement="bottom start" className="w-40 p-0">
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
                    textValue={column.label}
                    onAction={() => {
                      const newVariant =
                        columnVariants.get(column.id) ?? "short-text";
                      const newOperator = getDefaultOperator(newVariant);

                      table.setColumnFilters((prevFilters) =>
                        prevFilters.map((f) =>
                          f.id === filter.id
                            ? {
                                id: column.id,
                                value: {
                                  operator: newOperator,
                                  value: "",
                                },
                              }
                            : f,
                        ),
                      );
                      setShowFieldSelector(false);
                    }}
                  >
                    <span className="truncate">{column.label}</span>
                    <IconPlaceholder
                      lucide="Check"
                      tabler="IconCheck"
                      hugeicons="Tick02Icon"
                      phosphor="CheckIcon"
                      remixicon="RiCheckLine"
                      className={cn(
                        "ms-auto",
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
        aria-label={`${columnLabels.get(filter.id)} filter operator`}
        isOpen={showOperatorSelector}
        onOpenChange={setShowOperatorSelector}
        value={operator}
        onChange={(value) => {
          if (value == null) return;
          onOperatorChange(value as FilterOperator);
        }}
      >
        <SelectTrigger className="w-32 rounded lowercase">
          <div className="truncate">
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {operators.map((op) => (
              <SelectItem key={op.value} id={op.value} className="lowercase">
                {op.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="max-w-60 min-w-36 flex-1">
        {needsValue && column ? (
          <DataGridFilterInput
            key={filter.id}
            variant={variant}
            operator={operator}
            column={column}
            inputId={inputId}
            dir={dir}
            value={filterValue?.value}
            endValue={filterValue?.endValue}
            onValueChange={onValueChange}
            onEndValueChange={onEndValueChange}
          />
        ) : (
          <div
            id={inputId}
            role="status"
            aria-label={`${columnLabels.get(filter.id)} filter is empty`}
            aria-live="polite"
            className="h-8 w-full rounded border bg-transparent dark:bg-input/30"
          />
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-8 rounded"
        onPress={() => onFilterRemove(filter.id)}
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

interface DataGridFilterInputProps<TData extends RowData> {
  variant: string;
  operator: FilterOperator;
  dir: "ltr" | "rtl";
  placeholder?: string;
  value: string | number | string[] | undefined;
  endValue?: string | number;
  column: Column<DataGridFeatures, TData>;
  inputId: string;
  onValueChange: (value: string | number | string[] | undefined) => void;
  onEndValueChange?: (value: string | number | string[] | undefined) => void;
}

function DataGridFilterInput<TData extends RowData>({
  variant,
  operator,
  dir,
  placeholder = "Value",
  value,
  endValue,
  column,
  inputId,
  onValueChange,
  onEndValueChange,
}: DataGridFilterInputProps<TData>) {
  const [showValueSelector, setShowValueSelector] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value);
  const [localEndValue, setLocalEndValue] = React.useState(endValue);

  const debouncedOnChange = useDebouncedCallback(
    (newValue: string | number | string[] | undefined) => {
      onValueChange(newValue);
    },
    FILTER_DEBOUNCE_MS,
  );

  const debouncedOnEndValueChange = useDebouncedCallback(
    (newValue: string | number | string[] | undefined) => {
      onEndValueChange?.(newValue);
    },
    FILTER_DEBOUNCE_MS,
  );

  const cellVariant = column.columnDef.meta?.cell;

  const selectOptions = React.useMemo(() => {
    return cellVariant?.variant === "select" ||
      cellVariant?.variant === "multi-select"
      ? cellVariant.options
      : [];
  }, [cellVariant]);

  const isBetween = operator === "isBetween";

  if (variant === "number") {
    if (isBetween) {
      return (
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            placeholder="Start"
            value={(localValue as number | undefined) ?? ""}
            onChange={(event) => {
              const val = event.target.value;
              const newValue = val === "" ? undefined : Number(val);
              setLocalValue(newValue);
              debouncedOnChange(newValue);
            }}
            className="h-8 w-full flex-1 rounded"
          />
          <Input
            id={`${inputId}-end`}
            type="number"
            inputMode="numeric"
            placeholder="End"
            value={(localEndValue as number | undefined) ?? ""}
            onChange={(event) => {
              const val = event.target.value;
              const newValue = val === "" ? undefined : Number(val);
              setLocalEndValue(newValue);
              debouncedOnEndValueChange(newValue);
            }}
            className="h-8 w-full flex-1 rounded"
          />
        </div>
      );
    }

    return (
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        placeholder={placeholder}
        value={(localValue as number | undefined) ?? ""}
        onChange={(event) => {
          const val = event.target.value;
          const newValue = val === "" ? undefined : Number(val);
          setLocalValue(newValue);
          debouncedOnChange(newValue);
        }}
        className="h-8 w-full rounded"
      />
    );
  }

  if (variant === "date") {
    if (isBetween) {
      const startDate =
        localValue && typeof localValue === "string"
          ? new Date(localValue)
          : undefined;
      const endDate =
        localEndValue && typeof localEndValue === "string"
          ? new Date(localEndValue)
          : undefined;

      const isSameDate =
        startDate &&
        endDate &&
        startDate.toDateString() === endDate.toDateString();

      const displayValue =
        startDate && endDate && !isSameDate
          ? `${formatDate(startDate, { month: "short" })} - ${formatDate(endDate, { month: "short" })}`
          : startDate
            ? formatDate(startDate, { month: "short" })
            : "Pick a range";

      return (
        <PopoverTrigger
          isOpen={showValueSelector}
          onOpenChange={setShowValueSelector}
        >
          <Button
            id={inputId}
            dir={dir}
            variant="outline"
            className={cn(
              "h-8 w-full justify-start rounded font-normal",
              !startDate && "text-muted-foreground",
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
          <Popover dir={dir} placement="bottom start" className="w-auto p-0">
            <RangeCalendar
              autoFocus
              captionLayout="dropdown"
              value={
                startDate && endDate
                  ? {
                      start: toCalendarDate(fromDateToLocal(startDate)),
                      end: toCalendarDate(fromDateToLocal(endDate)),
                    }
                  : startDate
                    ? {
                        start: toCalendarDate(fromDateToLocal(startDate)),
                        end: toCalendarDate(fromDateToLocal(startDate)),
                      }
                    : null
              }
              onChange={(range) => {
                const fromValue = range.start
                  .toDate(getLocalTimeZone())
                  .toISOString();
                const toValue = range.end
                  .toDate(getLocalTimeZone())
                  .toISOString();
                setLocalValue(fromValue);
                setLocalEndValue(toValue);
                onValueChange(fromValue);
                onEndValueChange?.(toValue);
              }}
            />
          </Popover>
        </PopoverTrigger>
      );
    }

    const dateValue =
      localValue && typeof localValue === "string"
        ? new Date(localValue)
        : undefined;

    return (
      <PopoverTrigger
        isOpen={showValueSelector}
        onOpenChange={setShowValueSelector}
      >
        <Button
          id={inputId}
          dir={dir}
          variant="outline"
          className={cn(
            "h-8 w-full justify-start rounded font-normal",
            !dateValue && "text-muted-foreground",
          )}
        >
          <IconPlaceholder
            lucide="CalendarIcon"
            tabler="IconCalendar"
            hugeicons="CalendarIcon"
            phosphor="CalendarIcon"
            remixicon="RiCalendarLine"
          />
          <span className="truncate">
            {dateValue
              ? formatDate(dateValue, { month: "short" })
              : "Pick a date"}
          </span>
        </Button>
        <Popover dir={dir} placement="bottom start" className="w-auto p-0">
          <Calendar
            autoFocus
            captionLayout="dropdown"
            value={
              dateValue ? toCalendarDate(fromDateToLocal(dateValue)) : null
            }
            onChange={(date) => {
              const newValue = date.toDate(getLocalTimeZone()).toISOString();
              setLocalValue(newValue);
              onValueChange(newValue);
              setShowValueSelector(false);
            }}
          />
        </Popover>
      </PopoverTrigger>
    );
  }

  const isSelectVariant = variant === "select" || variant === "multi-select";
  const isMultiValueOperator =
    operator === "isAnyOf" || operator === "isNoneOf";

  if (isSelectVariant && selectOptions.length > 0) {
    if (isMultiValueOperator) {
      const selectedValues = Array.isArray(value) ? value : [];
      const selectedOptions = selectOptions.filter((option) =>
        selectedValues.includes(option.value),
      );

      const selectedOptionsWithIcons = selectedOptions.filter(
        (selectedOption) => selectedOption.icon,
      );

      return (
        <PopoverTrigger
          isOpen={showValueSelector}
          onOpenChange={setShowValueSelector}
        >
          <Button
            id={inputId}
            dir={dir}
            variant="outline"
            className="h-8 w-full justify-start rounded font-normal"
          >
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {selectedOptionsWithIcons.length > 0 && (
                  <div className="flex items-center -space-x-2 rtl:space-x-reverse">
                    {selectedOptionsWithIcons.map(
                      (selectedOption) =>
                        selectedOption.icon && (
                          <div
                            key={selectedOption.value}
                            className="rounded-full border bg-background p-0.5"
                          >
                            <selectedOption.icon className="size-3.5" />
                          </div>
                        ),
                    )}
                  </div>
                )}
                <span className="truncate">
                  {selectedOptions.length > 1
                    ? `${selectedOptions.length} selected`
                    : selectedOptions[0]?.label}
                </span>
              </>
            )}
          </Button>
          <Popover dir={dir} placement="bottom start" className="w-48 p-0">
            <Command>
              <CommandInput placeholder="Search options..." />
              <CommandList
                shouldCloseOnSelect={false}
                renderEmptyState={() => (
                  <CommandEmpty>No options found.</CommandEmpty>
                )}
              >
                <CommandGroup>
                  {selectOptions.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        id={option.value}
                        textValue={option.label}
                        onAction={() => {
                          const newValues = isSelected
                            ? selectedValues.filter((v) => v !== option.value)
                            : [...selectedValues, option.value];
                          onValueChange(
                            newValues.length > 0 ? newValues : undefined,
                          );
                        }}
                      >
                        {option.icon && <option.icon />}
                        <span className="truncate">{option.label}</span>
                        {option.count && (
                          <span className="ms-auto font-mono text-xs">
                            {option.count}
                          </span>
                        )}
                        <IconPlaceholder
                          lucide="Check"
                          tabler="IconCheck"
                          hugeicons="Tick02Icon"
                          phosphor="CheckIcon"
                          remixicon="RiCheckLine"
                          className={cn(
                            "ms-auto",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
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

    const selectedOption = selectOptions.find(
      (opt) => opt.value === (value as string),
    );

    return (
      <PopoverTrigger
        isOpen={showValueSelector}
        onOpenChange={setShowValueSelector}
      >
        <Button
          id={inputId}
          dir={dir}
          variant="outline"
          className="h-8 w-full justify-start rounded font-normal"
        >
          {selectedOption ? (
            <>
              {selectedOption.icon && <selectedOption.icon />}
              <span className="truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
        <Popover dir={dir} placement="bottom start" className="w-50 p-0">
          <Command>
            <CommandInput placeholder="Search options..." />
            <CommandList
              renderEmptyState={() => (
                <CommandEmpty>No options found.</CommandEmpty>
              )}
            >
              <CommandGroup>
                {selectOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    id={option.value}
                    textValue={option.label}
                    onAction={() => {
                      onValueChange(option.value);
                      setShowValueSelector(false);
                    }}
                  >
                    {option.icon && <option.icon />}
                    <span className="truncate">{option.label}</span>
                    {option.count && (
                      <span className="ms-auto font-mono text-xs">
                        {option.count}
                      </span>
                    )}
                    <IconPlaceholder
                      lucide="Check"
                      tabler="IconCheck"
                      hugeicons="Tick02Icon"
                      phosphor="CheckIcon"
                      remixicon="RiCheckLine"
                      className={cn(
                        "ms-auto",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover>
      </PopoverTrigger>
    );
  }

  if (isBetween) {
    return (
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="text"
          placeholder="Start"
          className="h-8 w-full flex-1 rounded"
          value={(localValue as string | undefined) ?? ""}
          onChange={(event) => {
            const val = event.target.value;
            const newValue = val === "" ? undefined : val;
            setLocalValue(newValue);
            debouncedOnChange(newValue);
          }}
        />
        <Input
          id={`${inputId}-end`}
          type="text"
          placeholder="End"
          className="h-8 w-full flex-1 rounded"
          value={(localEndValue as string | undefined) ?? ""}
          onChange={(event) => {
            const val = event.target.value;
            const newValue = val === "" ? undefined : val;
            setLocalEndValue(newValue);
            debouncedOnEndValueChange(newValue);
          }}
        />
      </div>
    );
  }

  return (
    <Input
      id={inputId}
      type="text"
      placeholder={placeholder}
      className="h-8 w-full rounded"
      value={(localValue as string | undefined) ?? ""}
      onChange={(event) => {
        const val = event.target.value;
        const newValue = val === "" ? undefined : val;
        setLocalValue(newValue);
        debouncedOnChange(newValue);
      }}
    />
  );
}
