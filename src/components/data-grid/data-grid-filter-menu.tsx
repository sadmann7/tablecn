"use client";

import { useDirection } from "@radix-ui/react-direction";
import type { Column, ColumnFilter, Table } from "@tanstack/react-table";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  GripVertical,
  ListFilter,
  Trash2,
} from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/components/ui/sortable";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import {
  getDefaultOperator,
  getOperatorsForVariant,
} from "@/lib/data-grid-filters";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FilterOperator, FilterValue } from "@/types/data-grid";

const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];
const FILTER_DEBOUNCE_MS = 300;
const OPERATORS_WITHOUT_VALUE = ["isEmpty", "isNotEmpty", "isTrue", "isFalse"];

interface DataGridFilterMenuProps<TData>
  extends React.ComponentProps<typeof PopoverContent> {
  table: Table<TData>;
  disabled?: boolean;
}

export function DataGridFilterMenu<TData>({
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

  const columnFilters = table.getState().columnFilters;

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

  const onTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (
        REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase()) &&
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            dir={dir}
            variant="outline"
            size="sm"
            className="font-normal"
            onKeyDown={onTriggerKeyDown}
            disabled={disabled}
          >
            <ListFilter className="text-muted-foreground" />
            Filter
            {columnFilters.length > 0 && (
              <Badge
                variant="secondary"
                className="h-[18.24px] rounded-[3.2px] px-[5.12px] font-mono font-normal text-[10.4px]"
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
            "flex w-full max-w-(--radix-popover-content-available-width) flex-col gap-3.5 p-4 sm:min-w-[480px]",
            className,
          )}
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="font-medium leading-none">
              {columnFilters.length > 0 ? "Filter by" : "No filters applied"}
            </h4>
            <p
              id={descriptionId}
              className={cn(
                "text-muted-foreground text-sm",
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
                className="flex max-h-[400px] flex-col gap-2 overflow-y-auto p-1"
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
              </div>
            </SortableContent>
          )}
          <div className="flex w-full items-center gap-2">
            <Button
              size="sm"
              className="rounded"
              ref={addButtonRef}
              onClick={onFilterAdd}
              disabled={columns.length === 0}
            >
              Add filter
            </Button>
            {columnFilters.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded"
                onClick={onFiltersReset}
              >
                Reset filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <SortableOverlay>
        <div dir={dir} className="flex items-center gap-2">
          <div className="h-8 min-w-[72px] rounded-sm bg-primary/10" />
          <div className="h-8 w-32 rounded-sm bg-primary/10" />
          <div className="h-8 w-32 rounded-sm bg-primary/10" />
          <div className="h-8 w-36 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
        </div>
      </SortableOverlay>
    </Sortable>
  );
}

interface DataGridFilterItemProps<TData> {
  filter: ColumnFilter;
  index: number;
  filterItemId: string;
  dir: "ltr" | "rtl";
  columns: { id: string; label: string }[];
  columnLabels: Map<string, string>;
  columnVariants: Map<string, string>;
  table: Table<TData>;
  onFilterUpdate: (filterId: string, updates: Partial<ColumnFilter>) => void;
  onFilterRemove: (filterId: string) => void;
}

function DataGridFilterItem<TData>({
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
  const fieldListboxId = `${filterItemId}-field-listbox`;
  const fieldTriggerId = `${filterItemId}-field-trigger`;
  const operatorListboxId = `${filterItemId}-operator-listbox`;
  const inputId = `${filterItemId}-input`;

  const [showFieldSelector, setShowFieldSelector] = React.useState(false);
  const [showOperatorSelector, setShowOperatorSelector] = React.useState(false);

  const variant = columnVariants.get(filter.id) ?? "short-text";
  const filterValue = filter.value as FilterValue | undefined;
  const operator = filterValue?.operator ?? getDefaultOperator(variant);

  const operators = getOperatorsForVariant(variant);
  const needsValue = !OPERATORS_WITHOUT_VALUE.includes(operator);

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

      if (REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase())) {
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
    <SortableItem value={filter.id} asChild>
      <div
        role="listitem"
        id={filterItemId}
        tabIndex={-1}
        className="flex items-center gap-2"
        onKeyDown={onItemKeyDown}
      >
        <div className="min-w-[72px] text-center">
          {index === 0 ? (
            <span className="text-muted-foreground text-sm">Where</span>
          ) : (
            <span className="text-muted-foreground text-sm">And</span>
          )}
        </div>
        <Popover open={showFieldSelector} onOpenChange={setShowFieldSelector}>
          <PopoverTrigger asChild>
            <Button
              id={fieldTriggerId}
              aria-controls={fieldListboxId}
              dir={dir}
              variant="outline"
              size="sm"
              className="w-32 justify-between rounded font-normal"
            >
              <span className="truncate">{columnLabels.get(filter.id)}</span>
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            id={fieldListboxId}
            dir={dir}
            align="start"
            className="w-40 p-0"
          >
            <Command>
              <CommandInput placeholder="Search fields..." />
              <CommandList>
                <CommandEmpty>No fields found.</CommandEmpty>
                <CommandGroup>
                  {columns.map((column) => (
                    <CommandItem
                      key={column.id}
                      value={column.id}
                      onSelect={(value) => {
                        const newVariant =
                          columnVariants.get(value) ?? "short-text";
                        const newOperator = getDefaultOperator(newVariant);

                        table.setColumnFilters((prevFilters) =>
                          prevFilters.map((f) =>
                            f.id === filter.id
                              ? {
                                  id: value,
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
                      <Check
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
          </PopoverContent>
        </Popover>
        <Select
          open={showOperatorSelector}
          onOpenChange={setShowOperatorSelector}
          value={operator}
          onValueChange={onOperatorChange}
        >
          <SelectTrigger
            aria-controls={operatorListboxId}
            size="sm"
            className="w-32 rounded lowercase"
          >
            <div className="truncate">
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent id={operatorListboxId}>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value} className="lowercase">
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="min-w-36 max-w-60 flex-1">
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
          aria-controls={filterItemId}
          variant="outline"
          size="icon"
          className="size-8 rounded"
          onClick={() => onFilterRemove(filter.id)}
        >
          <Trash2 />
        </Button>
        <SortableItemHandle asChild>
          <Button variant="outline" size="icon" className="size-8 rounded">
            <GripVertical />
          </Button>
        </SortableItemHandle>
      </div>
    </SortableItem>
  );
}

interface DataGridFilterInputProps<TData> {
  variant: string;
  operator: FilterOperator;
  dir: "ltr" | "rtl";
  placeholder?: string;
  value: string | number | string[] | undefined;
  endValue?: string | number;
  column: Column<TData>;
  inputId: string;
  onValueChange: (value: string | number | string[] | undefined) => void;
  onEndValueChange?: (value: string | number | string[] | undefined) => void;
}

function DataGridFilterInput<TData>({
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
              size="sm"
              className={cn(
                "h-8 w-full justify-start rounded font-normal",
                !startDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon />
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
            size="sm"
            className={cn(
              "h-8 w-full justify-start rounded font-normal",
              !dateValue && "text-muted-foreground",
            )}
          >
            <CalendarIcon />
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
      const selectedOptions = selectOptions.filter((option) =>
        selectedValues.includes(option.value),
      );

      const selectedOptionsWithIcons = selectedOptions.filter(
        (selectedOption) => selectedOption.icon,
      );

      return (
        <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
          <PopoverTrigger asChild>
            <Button
              id={inputId}
              aria-controls={inputListboxId}
              dir={dir}
              variant="outline"
              size="sm"
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
          </PopoverTrigger>
          <PopoverContent
            id={inputListboxId}
            dir={dir}
            align="start"
            className="w-48 p-0"
          >
            <Command>
              <CommandInput placeholder="Search options..." />
              <CommandList>
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup>
                  {selectOptions.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
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
                        <Check
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
          </PopoverContent>
        </Popover>
      );
    }

    const selectedOption = selectOptions.find(
      (opt) => opt.value === (value as string),
    );

    return (
      <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            aria-controls={inputListboxId}
            dir={dir}
            variant="outline"
            size="sm"
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
        </PopoverTrigger>
        <PopoverContent
          id={inputListboxId}
          dir={dir}
          align="start"
          className="w-[200px] p-0"
        >
          <Command>
            <CommandInput placeholder="Search options..." />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {selectOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
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
                    <Check
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
        </PopoverContent>
      </Popover>
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
