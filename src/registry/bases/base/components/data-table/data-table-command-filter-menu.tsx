"use client";

import {
  type Column,
  type RowData,
  Subscribe,
  type Table,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type { ColumnFilterItem, Option } from "@/lib/data-table-types";

import {
  getColumnFilterDefaults,
  getDateFilterLabel,
  getFilterDates,
  getFilterOperators,
  getFilterValueForOperator,
  getIsEditableTarget,
  getIsValuelessOperator,
  getSelectFilterValue,
  toFilterTimestamp,
} from "@/lib/data-table-utils";
import { generateId } from "@/lib/id";
import { DataTableRangeFilter } from "@/registry/bases/base/components/data-table/data-table-range-filter";
import { Button } from "@/registry/bases/base/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/registry/bases/base/ui/command";
import {
  Faceted,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedTrigger,
} from "@/registry/bases/base/ui/faceted";
import { Input } from "@/registry/bases/base/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { Calendar } from "@/registry/bases/radix/ui/calendar";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];

function getIsRemoveKey(event: React.KeyboardEvent) {
  return REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase());
}

type FilterUpdate = Partial<Omit<ColumnFilterItem, "filterId">>;
type FilterSelector = "field" | "operator" | "value";

interface CommandQuery {
  columnId: string | null;
  search: string;
}

const EMPTY_QUERY: CommandQuery = { columnId: null, search: "" };

interface DataTableCommandFilterMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof PopoverContent> {
  table: Table<DataTableFeatures, TData>;
  disabled?: boolean;
}

export function DataTableCommandFilterMenu<TData extends RowData>({
  table,
  ...props
}: DataTableCommandFilterMenuProps<TData>) {
  return (
    <Subscribe
      source={table.atoms.columnFilters}
      selector={() => table.getColumnFilterItems()}
    >
      {(filters) => (
        <DataTableCommandFilterMenuContent
          table={table}
          filters={filters}
          {...props}
        />
      )}
    </Subscribe>
  );
}

interface DataTableCommandFilterMenuContentProps<
  TData extends RowData,
> extends DataTableCommandFilterMenuProps<TData> {
  filters: ColumnFilterItem[];
}

function DataTableCommandFilterMenuContent<TData extends RowData>({
  table,
  filters,
  disabled,
  className,
  ...props
}: DataTableCommandFilterMenuContentProps<TData>) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(EMPTY_QUERY);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (getIsEditableTarget(event.target)) return;
      if (
        event.key.toLowerCase() !== FILTER_SHORTCUT_KEY ||
        !(event.ctrlKey || event.metaKey) ||
        !event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      setOpen((open) => !open);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table],
  );

  const selectedColumn = columns.find((column) => column.id === query.columnId);
  const hasFilters = filters.length > 0;

  function onColumnSelect(column: Column<DataTableFeatures, TData>) {
    setQuery({ columnId: column.id, search: "" });
    inputRef.current?.focus();
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!selectedColumn || query.search || !getIsRemoveKey(event)) return;

    event.preventDefault();
    setQuery(EMPTY_QUERY);
  }

  function onFilterAdd(
    column: Column<DataTableFeatures, TData>,
    value: string,
  ) {
    const defaults = getColumnFilterDefaults(column);
    if (!value.trim() && defaults.variant !== "boolean") return;

    table.addColumnFilter({
      ...defaults,
      value: defaults.variant === "multiSelect" ? [value] : value,
      filterId: generateId({ length: 8 }),
    });
    setOpen(false);
  }

  function onFilterUpdate(filterId: string, updates: FilterUpdate) {
    table.updateColumnFilter(filterId, updates);
  }

  function onFilterRemove(filterId: string) {
    table.removeColumnFilter(filterId);
    triggerRef.current?.focus();
  }

  function onFiltersReset() {
    table.resetColumnFilters(true);
    table.resetJoinOperator(true);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const lastFilter = filters.at(-1);
    if (!lastFilter || !getIsRemoveKey(event)) return;

    event.preventDefault();
    onFilterRemove(lastFilter.filterId);
  }

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
      {hasFilters && (
        <Button
          aria-label="Reset all filters"
          variant="outline"
          size="icon"
          onClick={onFiltersReset}
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
      <Popover
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(open) => {
          if (!open) setQuery(EMPTY_QUERY);
        }}
      >
        <PopoverTrigger
          render={
            <Button
              ref={triggerRef}
              aria-label="Open filter command menu"
              variant="outline"
              size={hasFilters ? "icon" : "default"}
              onKeyDown={onTriggerKeyDown}
              disabled={disabled}
            />
          }
        >
          <IconPlaceholder
            lucide="ListFilter"
            tabler="IconListDetails"
            hugeicons="LeftToRightListBulletIcon"
            phosphor="ListIcon"
            remixicon="RiListUnordered"
            className="text-muted-foreground"
          />
          {!hasFilters && "Filter"}
        </PopoverTrigger>
        <PopoverContent
          className={cn("w-full max-w-(--available-width) p-0", className)}
          {...props}
        >
          <Command loop className="[&_[cmdk-input-wrapper]_svg]:hidden">
            <CommandInput
              ref={inputRef}
              placeholder={
                selectedColumn
                  ? (selectedColumn.columnDef.meta?.label ?? selectedColumn.id)
                  : "Search fields..."
              }
              value={query.search}
              onValueChange={(search) =>
                setQuery((query) => ({ ...query, search }))
              }
              onKeyDown={onInputKeyDown}
            />
            <CommandList>
              {selectedColumn ? (
                <FilterValueOptions
                  column={selectedColumn}
                  search={query.search}
                  onSelect={(value) => onFilterAdd(selectedColumn, value)}
                />
              ) : (
                <FilterFieldOptions
                  columns={columns}
                  onSelect={onColumnSelect}
                />
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface DataTableFilterItemProps<TData extends RowData> {
  filter: ColumnFilterItem;
  filterItemId: string;
  columns: Column<DataTableFeatures, TData>[];
  onFilterUpdate: (filterId: string, updates: FilterUpdate) => void;
  onFilterRemove: (filterId: string) => void;
}

function DataTableFilterItem<TData extends RowData>({
  filter,
  filterItemId,
  columns,
  onFilterUpdate,
  onFilterRemove,
}: DataTableFilterItemProps<TData>) {
  const [activeSelector, setActiveSelector] =
    React.useState<FilterSelector | null>(null);

  const column = columns.find((column) => column.id === filter.id);
  if (!column) return null;

  const columnMeta = column.columnDef.meta;

  function getSelectorProps(selector: FilterSelector) {
    return {
      open: activeSelector === selector,
      onOpenChange: (open: boolean) =>
        setActiveSelector(open ? selector : null),
    };
  }

  function onItemKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (activeSelector || getIsEditableTarget(event.target)) return;
    if (!getIsRemoveKey(event)) return;

    event.preventDefault();
    onFilterRemove(filter.filterId);
  }

  return (
    <div
      role="listitem"
      id={filterItemId}
      className="flex h-8 items-center rounded-md bg-background"
      onKeyDown={onItemKeyDown}
    >
      <FilterFieldSelector
        filter={filter}
        column={column}
        columns={columns}
        onFilterUpdate={onFilterUpdate}
        {...getSelectorProps("field")}
      />
      <FilterOperatorSelector
        filter={filter}
        listboxId={`${filterItemId}-operator-listbox`}
        onFilterUpdate={onFilterUpdate}
        {...getSelectorProps("operator")}
      />
      <FilterValueInput
        filter={filter}
        column={column}
        inputId={`${filterItemId}-input`}
        onFilterUpdate={onFilterUpdate}
        {...getSelectorProps("value")}
      />
      <Button
        aria-controls={filterItemId}
        aria-label={`Remove ${columnMeta?.label ?? column.id} filter`}
        variant="ghost"
        className="h-full rounded-none rounded-r-md border border-l-0 border-input px-1.5 dark:bg-input/30"
        onClick={() => onFilterRemove(filter.filterId)}
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

interface FilterFieldOptionsProps<TData extends RowData> {
  columns: Column<DataTableFeatures, TData>[];
  onSelect: (column: Column<DataTableFeatures, TData>) => void;
}

function FilterFieldOptions<TData extends RowData>({
  columns,
  onSelect,
}: FilterFieldOptionsProps<TData>) {
  return (
    <>
      <CommandEmpty>No fields found.</CommandEmpty>
      <CommandGroup>
        {columns.map((column) => (
          <CommandItem
            key={column.id}
            value={column.id}
            onSelect={() => onSelect(column)}
          >
            <ColumnLabel column={column} />
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
}

interface ColumnLabelProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData>;
}

function ColumnLabel<TData extends RowData>({
  column,
}: ColumnLabelProps<TData>) {
  const columnMeta = column.columnDef.meta;

  return (
    <>
      {columnMeta?.icon && <columnMeta.icon />}
      <span className="truncate">{columnMeta?.label ?? column.id}</span>
    </>
  );
}

interface FilterValueOptionsProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData>;
  search: string;
  onSelect: (value: string) => void;
}

function FilterValueOptions<TData extends RowData>({
  column,
  search,
  onSelect,
}: FilterValueOptionsProps<TData>) {
  const columnMeta = column.columnDef.meta;

  switch (columnMeta?.variant ?? "text") {
    case "boolean":
      return (
        <CommandGroup>
          <CommandItem value="true" onSelect={() => onSelect("true")}>
            True
          </CommandItem>
          <CommandItem value="false" onSelect={() => onSelect("false")}>
            False
          </CommandItem>
        </CommandGroup>
      );

    case "select":
    case "multiSelect":
      return (
        <>
          <CommandEmpty>No options found.</CommandEmpty>
          <CommandGroup>
            {columnMeta?.options?.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                keywords={[option.label]}
                className="[&>svg:last-child]:hidden"
                onSelect={() => onSelect(option.value)}
              >
                {option.icon && <option.icon />}
                <span className="truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="ml-auto font-mono text-xs">
                    {option.count}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      );

    case "date":
    case "dateRange":
      return (
        <Calendar
          autoFocus
          captionLayout="dropdown"
          mode="single"
          onSelect={(date) => onSelect(toFilterTimestamp(date))}
        />
      );

    default:
      return <TextFilterValueOption search={search} onSelect={onSelect} />;
  }
}

interface TextFilterValueOptionProps {
  search: string;
  onSelect: (value: string) => void;
}

function TextFilterValueOption({
  search,
  onSelect,
}: TextFilterValueOptionProps) {
  const isEmpty = !search.trim();

  return (
    <CommandGroup>
      <CommandItem
        value={search}
        disabled={isEmpty}
        onSelect={() => onSelect(search)}
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
            <span className="truncate">Filter by &quot;{search}&quot;</span>
          </>
        )}
      </CommandItem>
    </CommandGroup>
  );
}

interface FilterSelectorProps {
  filter: ColumnFilterItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilterUpdate: (filterId: string, updates: FilterUpdate) => void;
}

interface FilterFieldSelectorProps<
  TData extends RowData,
> extends FilterSelectorProps {
  column: Column<DataTableFeatures, TData>;
  columns: Column<DataTableFeatures, TData>[];
}

function FilterFieldSelector<TData extends RowData>({
  filter,
  column,
  columns,
  open,
  onOpenChange,
  onFilterUpdate,
}: FilterFieldSelectorProps<TData>) {
  const columnMeta = column.columnDef.meta;

  return (
    <Faceted
      open={open}
      onOpenChange={onOpenChange}
      value={filter.id}
      onValueChange={(columnId) => {
        const column = columns.find((column) => column.id === columnId);
        if (column) {
          onFilterUpdate(filter.filterId, getColumnFilterDefaults(column));
        }
      }}
    >
      <FacetedTrigger
        render={
          <Button
            variant="ghost"
            className="rounded-none rounded-l-md border border-r-0 border-input dark:bg-input/30"
          />
        }
      >
        {columnMeta?.icon && (
          <columnMeta.icon className="text-muted-foreground" />
        )}
        {columnMeta?.label ?? column.id}
      </FacetedTrigger>
      <FacetedContent className="w-48">
        <FacetedInput placeholder="Search fields..." />
        <FacetedList>
          <FacetedEmpty>No fields found.</FacetedEmpty>
          <FacetedGroup>
            {columns.map((column) => (
              <FacetedItem key={column.id} value={column.id}>
                <ColumnLabel column={column} />
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

interface FilterOperatorSelectorProps extends FilterSelectorProps {
  listboxId: string;
}

function FilterOperatorSelector({
  filter,
  listboxId,
  open,
  onOpenChange,
  onFilterUpdate,
}: FilterOperatorSelectorProps) {
  return (
    <Select
      open={open}
      onOpenChange={onOpenChange}
      value={filter.operator}
      onValueChange={(operator) => {
        if (operator == null) return;
        onFilterUpdate(filter.filterId, {
          operator,
          value: getFilterValueForOperator(operator, filter.value),
        });
      }}
    >
      <SelectTrigger
        aria-controls={listboxId}
        className="h-8 rounded-none border-r-0 px-2.5 lowercase data-size:h-8 [&_svg]:hidden"
      >
        <SelectValue placeholder={filter.operator} />
      </SelectTrigger>
      <SelectContent id={listboxId}>
        <SelectGroup>
          {getFilterOperators(filter.variant).map((operator) => (
            <SelectItem
              key={operator.value}
              value={operator.value}
              className="lowercase"
            >
              {operator.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

interface FilterValueInputProps<
  TData extends RowData,
> extends FilterSelectorProps {
  column: Column<DataTableFeatures, TData>;
  inputId: string;
}

function FilterValueInput<TData extends RowData>(
  props: FilterValueInputProps<TData>,
) {
  const { filter, column, inputId, onFilterUpdate } = props;
  const columnMeta = column.columnDef.meta;

  if (getIsValuelessOperator(filter.operator)) {
    return (
      <div
        id={inputId}
        role="status"
        aria-label={`${columnMeta?.label} filter is ${
          filter.operator === "isEmpty" ? "empty" : "not empty"
        }`}
        aria-live="polite"
        className="h-full w-16 rounded-none border border-dashed border-input bg-transparent px-1.5 py-0.5 text-muted-foreground dark:bg-input/30"
      />
    );
  }

  switch (filter.variant) {
    case "text":
    case "number":
    case "range":
      if (filter.operator === "isBetween") {
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

      return (
        <Input
          id={inputId}
          type={filter.variant === "text" ? "text" : "number"}
          aria-label={`${columnMeta?.label} filter value`}
          inputMode={filter.variant === "text" ? undefined : "numeric"}
          placeholder={columnMeta?.placeholder ?? "Enter value..."}
          className="h-full w-24 rounded-none px-1.5"
          defaultValue={typeof filter.value === "string" ? filter.value : ""}
          onChange={(event) =>
            onFilterUpdate(filter.filterId, { value: event.target.value })
          }
        />
      );

    case "boolean":
      return <BooleanFilterValue {...props} />;

    case "select":
    case "multiSelect":
      return <SelectFilterValue {...props} />;

    case "date":
    case "dateRange":
      return <DateFilterValue {...props} />;

    default:
      return null;
  }
}

function BooleanFilterValue<TData extends RowData>({
  filter,
  column,
  inputId,
  open,
  onOpenChange,
  onFilterUpdate,
}: FilterValueInputProps<TData>) {
  const listboxId = `${inputId}-listbox`;

  return (
    <Select
      open={open}
      onOpenChange={onOpenChange}
      value={typeof filter.value === "string" ? filter.value : "true"}
      onValueChange={(value) => {
        if (value == null) return;
        onFilterUpdate(filter.filterId, { value });
      }}
    >
      <SelectTrigger
        id={inputId}
        aria-controls={listboxId}
        aria-label={`${column.columnDef.meta?.label} boolean filter`}
        className="rounded-none bg-transparent px-1.5 py-0.5 [&_svg]:hidden"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent id={listboxId}>
        <SelectGroup>
          <SelectItem value="true">True</SelectItem>
          <SelectItem value="false">False</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function SelectFilterValue<TData extends RowData>({
  filter,
  column,
  inputId,
  open,
  onOpenChange,
  onFilterUpdate,
}: FilterValueInputProps<TData>) {
  const listboxId = `${inputId}-listbox`;
  const columnMeta = column.columnDef.meta;
  const options = columnMeta?.options ?? [];
  const value = getSelectFilterValue(filter);
  const multiple = filter.variant === "multiSelect";

  return (
    <Faceted
      open={open}
      onOpenChange={onOpenChange}
      value={value}
      onValueChange={(value) =>
        onFilterUpdate(filter.filterId, { value: value ?? "" })
      }
      items={options}
      multiple={multiple}
    >
      <FacetedTrigger
        render={
          <Button
            id={inputId}
            aria-controls={listboxId}
            aria-label={`${columnMeta?.label} filter value${multiple ? "s" : ""}`}
            variant="ghost"
            className="h-full min-w-16 rounded-none border border-input px-1.5 dark:bg-input/30"
          />
        }
      >
        <SelectedOptions
          options={options}
          value={value}
          placeholder={`Select option${multiple ? "s" : ""}...`}
        />
      </FacetedTrigger>
      <FacetedContent id={listboxId} className="w-48">
        <FacetedInput
          aria-label={`Search ${columnMeta?.label} options`}
          placeholder="Search options..."
        />
        <FacetedList>
          <FacetedEmpty>No options found.</FacetedEmpty>
          <FacetedGroup>
            {options.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                {option.icon && <option.icon />}
                <span className="truncate">{option.label}</span>
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

interface SelectedOptionsProps {
  options: Option[];
  value: string | string[] | undefined;
  placeholder: string;
}

function SelectedOptions({
  options,
  value,
  placeholder,
}: SelectedOptionsProps) {
  const selectedValues = Array.isArray(value) ? value : [value];
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );

  if (selectedOptions.length === 0) return placeholder;

  return (
    <>
      <div className="flex items-center -space-x-2 rtl:space-x-reverse">
        {selectedOptions.map(
          (option) =>
            option.icon && (
              <div
                key={option.value}
                className="rounded-full border bg-background p-0.5"
              >
                <option.icon className="size-3.5" />
              </div>
            ),
        )}
      </div>
      <span className="truncate">
        {selectedOptions.length > 1
          ? `${selectedOptions.length} selected`
          : selectedOptions[0]?.label}
      </span>
    </>
  );
}

function DateFilterValue<TData extends RowData>({
  filter,
  column,
  inputId,
  open,
  onOpenChange,
  onFilterUpdate,
}: FilterValueInputProps<TData>) {
  const listboxId = `${inputId}-listbox`;
  const label = column.columnDef.meta?.label;
  const [startDate, endDate] = getFilterDates(filter.value);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            id={inputId}
            aria-controls={listboxId}
            aria-label={`${label} date filter`}
            variant="ghost"
            className={cn(
              "h-full rounded-none border px-1.5 dark:bg-input/30",
              !startDate && "text-muted-foreground",
            )}
          />
        }
      >
        <IconPlaceholder
          lucide="CalendarIcon"
          tabler="IconCalendar"
          hugeicons="CalendarIcon"
          phosphor="CalendarIcon"
          remixicon="RiCalendarLine"
          className="size-3.5"
        />
        <span className="truncate">
          {getDateFilterLabel(filter) ?? "Pick date..."}
        </span>
      </PopoverTrigger>
      <PopoverContent id={listboxId} align="start" className="w-auto p-0">
        {filter.operator === "isBetween" ? (
          <Calendar
            aria-label={`Select ${label} date range`}
            autoFocus
            captionLayout="dropdown"
            mode="range"
            selected={startDate ? { from: startDate, to: endDate } : undefined}
            onSelect={(range) =>
              onFilterUpdate(filter.filterId, {
                value: range
                  ? [toFilterTimestamp(range.from), toFilterTimestamp(range.to)]
                  : [],
              })
            }
          />
        ) : (
          <Calendar
            aria-label={`Select ${label} date`}
            autoFocus
            captionLayout="dropdown"
            mode="single"
            selected={startDate}
            onSelect={(date) => {
              onFilterUpdate(filter.filterId, {
                value: toFilterTimestamp(date),
              });
              onOpenChange(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
