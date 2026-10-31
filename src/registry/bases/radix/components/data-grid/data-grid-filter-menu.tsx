"use client";

import {
  type Column,
  type ColumnFilter,
  type ColumnFiltersState,
  type ReactTable,
  type RowData,
  Subscribe,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { FilterOperator, FilterValue } from "@/lib/data-grid-types";

import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  getDefaultOperator,
  getFilterValueForOperator,
  getOperatorsForVariant,
} from "@/lib/data-grid-filters";
import { formatDate } from "@/lib/format";
import { Badge } from "@/registry/bases/radix/ui/badge";
import { Button } from "@/registry/bases/radix/ui/button";
import { Calendar } from "@/registry/bases/radix/ui/calendar";
import { useDirection } from "@/registry/bases/radix/ui/direction";
import {
  Faceted,
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
import { Input } from "@/registry/bases/radix/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/radix/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/radix/ui/select";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/registry/bases/radix/ui/sortable";
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
> extends React.ComponentProps<typeof PopoverContent> {
  table: ReactTable<DataGridFeatures, TData, unknown>;
  disabled?: boolean;
}

export function DataGridFilterMenu<TData extends RowData>(
  props: DataGridFilterMenuProps<TData>,
) {
  return (
    <Subscribe source={props.table.atoms.columnFilters}>
      {(columnFilters) => (
        <DataGridFilterMenuContent {...props} columnFilters={columnFilters} />
      )}
    </Subscribe>
  );
}

function DataGridFilterMenuContent<TData extends RowData>({
  table,
  columnFilters,
  disabled,
  className,
  ...props
}: DataGridFilterMenuProps<TData> & { columnFilters: ColumnFiltersState }) {
  const dir = useDirection();
  const id = React.useId();
  const labelId = React.useId();
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);

  const { columnLabels, columns, columnVariants } = React.useMemo(() => {
    const labels = new Map<string, string>();
    const variants = new Map<string, string>();
    const filteringIds = new Set(columnFilters.map((f) => f.id));
    const availableColumns: { id: string; label: string }[] = [];

    for (const column of table.getAllColumns()) {
      if (!column.getCanFilter()) continue;

      const label = column.columnDef.meta?.label ?? column.id;
      const variant = column.columnDef.meta?.variant ?? "text";

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

    const variant = columnVariants.get(firstColumn.id) ?? "text";
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
      table.setColumnFilters((prevFilters) =>
        prevFilters.map((filter) =>
          filter.id === filterId ? { ...filter, ...updates } : filter,
        ),
      );
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

  const onTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
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

  return (
    <Sortable
      value={columnFilters}
      onValueChange={table.setColumnFilters}
      getItemValue={(item) => item.id}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            dir={dir}
            variant="outline"
            onKeyDown={onTriggerKeyDown}
            disabled={disabled}
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
                className="h-[18.24px] px-[5.12px] font-mono text-[10.4px]"
              >
                {columnFilters.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          dir={dir}
          className={cn(
            "flex w-full max-w-(--radix-popover-content-available-width) flex-col gap-3.5 p-4 sm:min-w-120",
            className,
          )}
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h2 id={labelId} className="leading-none font-medium">
              {columnFilters.length > 0 ? "Filter by" : "No filters applied"}
            </h2>
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
            <SortableContent asChild>
              <div
                role="list"
                className="grid max-h-100 grid-cols-[minmax(4.5rem,auto)_8rem_8rem_minmax(10rem,max-content)_auto_auto] gap-x-2 gap-y-2 overflow-y-auto p-1"
              >
                {columnFilters.map((filter, index) => (
                  <DataGridFilterItem
                    key={filter.id}
                    table={table}
                    filter={filter}
                    index={index}
                    filterItemId={`${id}-filter-${filter.id}`}
                    dir={dir}
                    columns={columns}
                    columnLabels={columnLabels}
                    columnVariants={columnVariants}
                    onFilterUpdate={onFilterUpdate}
                    onFilterRemove={onFilterRemove}
                  />
                ))}
              </div>
            </SortableContent>
          )}
          <div className="flex w-full items-center gap-2">
            <Button onClick={onFilterAdd} disabled={columns.length === 0}>
              Add filter
            </Button>
            {columnFilters.length > 0 && (
              <Button variant="outline" onClick={onFiltersReset}>
                Reset filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <SortableOverlay>
        <div
          dir={dir}
          className="grid size-full grid-cols-[minmax(4.5rem,auto)_8rem_8rem_minmax(10rem,1fr)_auto_auto] items-center gap-2"
        >
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="size-8 rounded-lg bg-primary/10" />
          <div className="size-8 rounded-lg bg-primary/10" />
        </div>
      </SortableOverlay>
    </Sortable>
  );
}

interface DataGridFilterItemProps<TData extends RowData> {
  table: ReactTable<DataGridFeatures, TData, unknown>;
  filter: ColumnFilter;
  index: number;
  filterItemId: string;
  dir: "ltr" | "rtl";
  columns: { id: string; label: string }[];
  columnLabels: Map<string, string>;
  columnVariants: Map<string, string>;
  onFilterUpdate: (filterId: string, updates: Partial<ColumnFilter>) => void;
  onFilterRemove: (filterId: string) => void;
}

function DataGridFilterItem<TData extends RowData>({
  table,
  filter,
  index,
  filterItemId,
  dir,
  columns,
  columnLabels,
  columnVariants,
  onFilterUpdate,
  onFilterRemove,
}: DataGridFilterItemProps<TData>) {
  const fieldListboxId = `${filterItemId}-field-listbox`;
  const fieldTriggerId = `${filterItemId}-field-trigger`;
  const operatorListboxId = `${filterItemId}-operator-listbox`;
  const inputId = `${filterItemId}-input`;
  const label = columnLabels.get(filter.id) ?? filter.id;

  const [showFieldSelector, setShowFieldSelector] = React.useState(false);
  const [showOperatorSelector, setShowOperatorSelector] = React.useState(false);

  const variant = columnVariants.get(filter.id) ?? "text";
  const filterValue = filter.value as FilterValue | undefined;
  const operator = filterValue?.operator ?? getDefaultOperator(variant);

  const operators = getOperatorsForVariant(variant);
  const needsValue = !OPERATORS_WITHOUT_VALUE.has(operator);

  const column = table.getColumn(filter.id);

  const onItemKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (showFieldSelector || showOperatorSelector) {
        return;
      }

      if (REMOVE_FILTER_SHORTCUTS.has(event.key.toLowerCase())) {
        event.preventDefault();
        onFilterRemove(filter.id);
      }
    },
    [filter.id, showFieldSelector, showOperatorSelector, onFilterRemove],
  );

  const onOperatorChange = React.useCallback(
    (newOperator: FilterOperator) => {
      onFilterUpdate(filter.id, {
        value: {
          operator: newOperator,
          value: getFilterValueForOperator(filterValue?.value, newOperator),
          endValue: filterValue?.endValue,
        },
      });
    },
    [filter.id, filterValue?.value, filterValue?.endValue, onFilterUpdate],
  );

  function onValueChange(newValue: string | number | string[] | undefined) {
    onFilterUpdate(filter.id, {
      value: { operator, value: newValue, endValue: filterValue?.endValue },
    });
  }

  function onEndValueChange(newValue: string | number | string[] | undefined) {
    onFilterUpdate(filter.id, {
      value: {
        operator,
        value: filterValue?.value,
        endValue: newValue as string | number | undefined,
      },
    });
  }

  return (
    <SortableItem id={filterItemId} value={filter.id} asChild>
      <div
        role="listitem"
        tabIndex={-1}
        className="col-span-full grid grid-cols-subgrid items-center"
        onKeyDown={onItemKeyDown}
      >
        <div className="min-w-18 text-center">
          <span className="text-sm text-muted-foreground">
            {index === 0 ? "Where" : "And"}
          </span>
        </div>
        <Faceted
          open={showFieldSelector}
          onOpenChange={setShowFieldSelector}
          onValueChange={(columnId) => {
            if (!columnId) return;
            const newVariant = columnVariants.get(columnId) ?? "text";
            const newOperator = getDefaultOperator(newVariant);

            table.setColumnFilters((prevFilters) =>
              prevFilters.map((f) =>
                f.id === filter.id
                  ? {
                      id: columnId,
                      value: {
                        operator: newOperator,
                        value: "",
                      },
                    }
                  : f,
              ),
            );
          }}
        >
          <FacetedTrigger asChild>
            <Button
              id={fieldTriggerId}
              aria-controls={fieldListboxId}
              dir={dir}
              variant="outline"
              className="w-32"
            >
              <span className="truncate">{label}</span>
              <IconPlaceholder
                lucide="ChevronsUpDown"
                tabler="IconSelector"
                hugeicons="UnfoldMoreIcon"
                phosphor="CaretUpDownIcon"
                remixicon="RiArrowUpDownLine"
                className="opacity-50"
              />
            </Button>
          </FacetedTrigger>
          <FacetedContent id={fieldListboxId} dir={dir} className="w-40">
            <FacetedInput placeholder="Search fields..." />
            <FacetedList>
              <FacetedEmpty>No fields found.</FacetedEmpty>
              <FacetedGroup>
                {columns.map((column) => (
                  <FacetedItem
                    key={column.id}
                    value={column.id}
                    keywords={[column.label]}
                  >
                    <span className="truncate">{column.label}</span>
                    <FacetedItemIndicator />
                  </FacetedItem>
                ))}
              </FacetedGroup>
            </FacetedList>
          </FacetedContent>
        </Faceted>
        <Select
          open={showOperatorSelector}
          onOpenChange={setShowOperatorSelector}
          value={operator}
          onValueChange={(value) => {
            const option = operators.find((item) => item.value === value);
            if (option) onOperatorChange(option.value);
          }}
        >
          <SelectTrigger
            aria-controls={operatorListboxId}
            aria-label={`${label} filter operator`}
            className="w-32 lowercase"
          >
            <div className="truncate">
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent id={operatorListboxId}>
            <SelectGroup>
              {operators.map((op) => (
                <SelectItem
                  key={op.value}
                  value={op.value}
                  className="lowercase"
                >
                  {op.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="w-full min-w-0">
          {needsValue && column ? (
            <DataGridFilterInput
              key={filter.id}
              column={column}
              variant={variant}
              operator={operator}
              dir={dir}
              value={filterValue?.value}
              inputId={inputId}
              endValue={filterValue?.endValue}
              onValueChange={onValueChange}
              onEndValueChange={onEndValueChange}
            />
          ) : (
            <div
              id={inputId}
              role="status"
              aria-label={`${label} filter is empty`}
              aria-live="polite"
              className="h-8 w-full rounded-lg border border-dashed border-input bg-transparent dark:bg-input/30"
            />
          )}
        </div>
        <Button
          aria-controls={filterItemId}
          aria-label={`Remove ${label} filter`}
          variant="outline"
          size="icon"
          onClick={() => onFilterRemove(filter.id)}
        >
          <IconPlaceholder
            lucide="Trash2"
            tabler="IconTrash"
            hugeicons="Delete02Icon"
            phosphor="TrashIcon"
            remixicon="RiDeleteBinLine"
          />
        </Button>
        <SortableItemHandle aria-label={`Reorder ${label} filter`} asChild>
          <Button variant="outline" size="icon">
            <IconPlaceholder
              lucide="GripVertical"
              tabler="IconGripVertical"
              hugeicons="DragDropVerticalIcon"
              phosphor="DotsSixVerticalIcon"
              remixicon="RiDraggable"
            />
          </Button>
        </SortableItemHandle>
      </div>
    </SortableItem>
  );
}

interface DataGridFilterInputProps<TData extends RowData> {
  column: Column<DataGridFeatures, TData>;
  variant: string;
  operator: FilterOperator;
  dir: "ltr" | "rtl";
  value: string | number | string[] | undefined;
  inputId: string;
  placeholder?: string;
  endValue?: string | number;
  onValueChange: (value: string | number | string[] | undefined) => void;
  onEndValueChange?: (value: string | number | string[] | undefined) => void;
}

function DataGridFilterInput<TData extends RowData>({
  column,
  variant,
  operator,
  dir,
  value,
  inputId,
  placeholder = "Value",
  endValue,
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

  const meta = column.columnDef.meta;

  const selectOptions = React.useMemo(() => {
    return meta?.variant === "select" || meta?.variant === "multi-select"
      ? meta.options
      : [];
  }, [meta]);

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
            value={localValue ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const newValue = value === "" ? undefined : Number(value);
              setLocalValue(newValue);
              debouncedOnChange(newValue);
            }}
            className="w-full flex-1"
          />
          <Input
            id={`${inputId}-end`}
            type="number"
            inputMode="numeric"
            placeholder="End"
            value={localEndValue ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const newValue = value === "" ? undefined : Number(value);
              setLocalEndValue(newValue);
              debouncedOnEndValueChange(newValue);
            }}
            className="w-full flex-1"
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
        value={localValue ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          const newValue = value === "" ? undefined : Number(value);
          setLocalValue(newValue);
          debouncedOnChange(newValue);
        }}
      />
    );
  }

  if (variant === "date") {
    const inputListboxId = `${inputId}-listbox`;

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
        <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
          <PopoverTrigger asChild>
            <Button
              id={inputId}
              aria-controls={inputListboxId}
              dir={dir}
              variant="outline"
              className={cn(
                "w-full justify-start",
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
          </PopoverTrigger>
          <PopoverContent
            id={inputListboxId}
            dir={dir}
            align="start"
            className="w-auto p-0"
          >
            <Calendar
              autoFocus
              captionLayout="dropdown"
              mode="range"
              selected={
                startDate && endDate
                  ? { from: startDate, to: endDate }
                  : startDate
                    ? { from: startDate, to: startDate }
                    : undefined
              }
              onSelect={(range) => {
                const fromValue = range?.from
                  ? range.from.toISOString()
                  : undefined;
                const toValue = range?.to ? range.to.toISOString() : undefined;
                setLocalValue(fromValue);
                setLocalEndValue(toValue);
                onValueChange(fromValue);
                onEndValueChange?.(toValue);
              }}
            />
          </PopoverContent>
        </Popover>
      );
    }

    const dateValue =
      localValue && typeof localValue === "string"
        ? new Date(localValue)
        : undefined;

    return (
      <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            aria-controls={inputListboxId}
            dir={dir}
            variant="outline"
            className={cn(
              "w-full justify-start",
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
        </PopoverTrigger>
        <PopoverContent
          id={inputListboxId}
          dir={dir}
          align="start"
          className="w-auto p-0"
        >
          <Calendar
            autoFocus
            captionLayout="dropdown"
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              const newValue = date ? date.toISOString() : undefined;
              setLocalValue(newValue);
              onValueChange(newValue);
              setShowValueSelector(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  const isSelectVariant = variant === "select" || variant === "multi-select";
  const isMultiValueOperator =
    operator === "isAnyOf" || operator === "isNoneOf";

  if (isSelectVariant && selectOptions.length > 0) {
    const inputListboxId = `${inputId}-listbox`;

    if (isMultiValueOperator) {
      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <Faceted
          open={showValueSelector}
          onOpenChange={setShowValueSelector}
          value={selectedValues}
          onValueChange={(nextValue) => {
            const values = nextValue ?? [];
            onValueChange(values.length > 0 ? values : undefined);
          }}
          items={selectOptions}
          multiple
        >
          <FacetedTrigger asChild>
            <Button
              id={inputId}
              aria-controls={inputListboxId}
              dir={dir}
              variant="outline"
              className="w-full"
            >
              <FacetedValue placeholder={placeholder} />
            </Button>
          </FacetedTrigger>
          <FacetedContent id={inputListboxId} dir={dir} className="w-48">
            <FacetedInput placeholder="Search options..." />
            <FacetedList>
              <FacetedEmpty>No options found.</FacetedEmpty>
              <FacetedGroup>
                {selectOptions.map((option) => (
                  <FacetedItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                  >
                    {option.icon && <option.icon />}
                    <span className="truncate">{option.label}</span>
                    <FacetedItemIndicator>{option.count}</FacetedItemIndicator>
                  </FacetedItem>
                ))}
              </FacetedGroup>
            </FacetedList>
          </FacetedContent>
        </Faceted>
      );
    }

    return (
      <Faceted
        open={showValueSelector}
        onOpenChange={setShowValueSelector}
        value={typeof value === "string" ? value : undefined}
        onValueChange={(nextValue) => onValueChange(nextValue)}
        items={selectOptions}
      >
        <FacetedTrigger asChild>
          <Button
            id={inputId}
            aria-controls={inputListboxId}
            dir={dir}
            variant="outline"
            className="w-full"
          >
            <FacetedValue placeholder={placeholder} />
          </Button>
        </FacetedTrigger>
        <FacetedContent id={inputListboxId} dir={dir} className="w-50">
          <FacetedInput placeholder="Search options..." />
          <FacetedList>
            <FacetedEmpty>No options found.</FacetedEmpty>
            <FacetedGroup>
              {selectOptions.map((option) => (
                <FacetedItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                >
                  {option.icon && <option.icon />}
                  <span className="truncate">{option.label}</span>
                  <FacetedItemIndicator>{option.count}</FacetedItemIndicator>
                </FacetedItem>
              ))}
            </FacetedGroup>
          </FacetedList>
        </FacetedContent>
      </Faceted>
    );
  }

  if (isBetween) {
    return (
      <div className="flex gap-2">
        <Input
          id={inputId}
          type="text"
          placeholder="Start"
          className="w-full flex-1"
          value={localValue ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            const newValue = value === "" ? undefined : value;
            setLocalValue(newValue);
            debouncedOnChange(newValue);
          }}
        />
        <Input
          id={`${inputId}-end`}
          type="text"
          placeholder="End"
          className="w-full flex-1"
          value={localEndValue ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            const newValue = value === "" ? undefined : value;
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
      value={localValue ?? ""}
      onChange={(event) => {
        const value = event.target.value;
        const newValue = value === "" ? undefined : value;
        setLocalValue(newValue);
        debouncedOnChange(newValue);
      }}
    />
  );
}
