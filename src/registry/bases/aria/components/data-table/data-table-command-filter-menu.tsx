"use client";

import type { KeyboardEvent as KeyboardEventPrimitive } from "react-aria-components";

import {
  fromDateToLocal,
  getLocalTimeZone,
  toCalendarDate,
} from "@internationalized/date";
import {
  type Column,
  type ReactTable,
  type RowData,
  Subscribe,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  ColumnFilterItem,
  ColumnSelectOption,
  FilterOperator,
} from "@/lib/data-table-types";

import {
  coerceFilterValue,
  getColumnSelectOptions,
  getDateFilterLabel,
  getDefaultFilter,
  getFilterDates,
  getFilterDateValue,
  getFilterOperators,
  getFilterVariant,
  getIsEditableTarget,
  getIsTableShortcutTarget,
  getIsValuelessOperator,
  getSelectFilterValue,
} from "@/lib/data-table-utils";
import { generateId } from "@/lib/id";
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
import { useDirection } from "@/registry/bases/aria/ui/direction";
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
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];

type FilterUpdate = Partial<Omit<ColumnFilterItem, "filterId">>;
type FilterSelector = "field" | "operator" | "value";

interface CommandQuery {
  columnId: string | null;
  search: string;
}

const EMPTY_QUERY: CommandQuery = { columnId: null, search: "" };

interface DataTableCommandFilterMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof Popover> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
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
  const dir = useDirection();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(EMPTY_QUERY);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (disabled) return;
      if (
        !open &&
        !getIsTableShortcutTarget(triggerRef.current, event.target)
      ) {
        return;
      }
      if (getIsEditableTarget(event.target)) return;
      if (
        event.key.toLowerCase() !== FILTER_SHORTCUT_KEY ||
        !(event.ctrlKey || event.metaKey) ||
        !event.shiftKey
      ) {
        return;
      }

      event.preventDefault();
      // React Aria returns focus on close to where it was on open, so start from the trigger.
      triggerRef.current?.focus();
      onOpenChange(!open);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, open]);

  const columns = React.useMemo(
    () => table.getAllLeafColumns().filter((column) => column.getCanFilter()),
    [table],
  );

  const selectedColumn = columns.find((column) => column.id === query.columnId);
  const hasFilters = filters.length > 0;
  const selectedVariant = selectedColumn?.columnDef.meta?.variant;
  const isDateVariant = selectedVariant === "date";
  const isSelectVariant = selectedVariant === "select";

  function onOpenChange(next: boolean) {
    if (next) setQuery(EMPTY_QUERY);
    setOpen(next);
  }

  function onColumnSelect(column: Column<DataTableFeatures, TData>) {
    setQuery({ columnId: column.id, search: "" });
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
    const defaults = getDefaultFilter(column);
    if (!value.trim() && defaults.variant !== "boolean") return;

    table.addColumnFilter({
      ...defaults,
      value: defaults.operator === "inArray" ? [value] : value,
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
    table.resetJoinOperator();
  }

  function onTriggerKeyDown(event: KeyboardEventPrimitive) {
    event.continuePropagation();

    const lastFilter = filters.at(-1);
    if (!lastFilter || !getIsRemoveKey(event)) return;

    event.preventDefault();
    onFilterRemove(lastFilter.filterId);
  }

  return (
    <div
      data-slot="data-table-command-filter-menu"
      className="flex flex-wrap items-center gap-2"
    >
      {hasFilters && (
        <>
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
          </div>
          <Button
            aria-label="Reset all filters"
            variant="outline"
            size="icon"
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
        </>
      )}
      <PopoverTrigger isOpen={open} onOpenChange={onOpenChange}>
        <Button
          ref={triggerRef}
          aria-label="Open filter command menu"
          variant="outline"
          size={hasFilters ? "icon" : "default"}
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
          {!hasFilters && "Filter"}
        </Button>
        <Popover
          dir={dir}
          className={cn("w-auto max-w-[calc(100vw-1.5rem)] p-0", className)}
          {...props}
        >
          <Command
            inputValue={query.search}
            onInputChange={(search) =>
              setQuery((query) => ({ ...query, search }))
            }
          >
            <CommandInput
              placeholder={
                selectedColumn
                  ? (selectedColumn.columnDef.meta?.label ?? selectedColumn.id)
                  : "Search fields..."
              }
              onKeyDown={onInputKeyDown}
            />
            {selectedColumn && isDateVariant ? null : (
              <CommandList
                key={selectedColumn?.id}
                autoFocus="first"
                shouldFocusWrap
                shouldCloseOnSelect={false}
                renderEmptyState={() =>
                  selectedColumn ? (
                    isSelectVariant ? (
                      <CommandEmpty>No options found.</CommandEmpty>
                    ) : null
                  ) : (
                    <CommandEmpty>No fields found.</CommandEmpty>
                  )
                }
              >
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
            )}
          </Command>
          {selectedColumn && isDateVariant ? (
            <FilterValueOptions
              column={selectedColumn}
              search={query.search}
              onSelect={(value) => onFilterAdd(selectedColumn, value)}
            />
          ) : null}
        </Popover>
      </PopoverTrigger>
    </div>
  );
}

function getIsRemoveKey(event: React.KeyboardEvent) {
  return REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase());
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
        label={columnMeta?.label ?? column.id}
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
        className="h-full rounded-none rounded-e-md border border-s-0 border-input px-1.5 dark:bg-input/30"
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
  const dir = useDirection();
  const columnMeta = column.columnDef.meta;

  return (
    <Faceted
      open={open}
      onOpenChange={onOpenChange}
      value={filter.id}
      onValueChange={(columnId) => {
        const column = columns.find((column) => column.id === columnId);
        if (column) {
          onFilterUpdate(filter.filterId, getDefaultFilter(column));
        }
      }}
    >
      <FacetedTrigger
        variant="ghost"
        className="rounded-none rounded-s-md border border-e-0 border-input dark:bg-input/30"
      >
        {columnMeta?.icon && (
          <columnMeta.icon className="text-muted-foreground" />
        )}
        {columnMeta?.label ?? column.id}
      </FacetedTrigger>
      <FacetedContent dir={dir} className="w-48">
        <FacetedInput placeholder="Search fields..." />
        <FacetedList
          renderEmptyState={() => <FacetedEmpty>No fields found.</FacetedEmpty>}
        >
          <FacetedGroup>
            {columns.map((column) => (
              <FacetedItem
                key={column.id}
                value={column.id}
                textValue={column.columnDef.meta?.label ?? column.id}
              >
                <ColumnLabel column={column} />
                <FacetedItemIndicator />
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

interface FilterOperatorSelectorProps extends FilterSelectorProps {
  label: string;
}

function FilterOperatorSelector({
  filter,
  label,
  open,
  onOpenChange,
  onFilterUpdate,
}: FilterOperatorSelectorProps) {
  const dir = useDirection();
  return (
    <Select
      aria-label={`${label} filter operator`}
      placeholder={filter.operator}
      isOpen={open}
      onOpenChange={onOpenChange}
      value={filter.operator}
      onChange={(operator) => {
        if (operator == null) return;
        onFilterUpdate(filter.filterId, {
          operator: operator as FilterOperator,
          value: coerceFilterValue(operator as FilterOperator, filter.value),
        });
      }}
    >
      <SelectTrigger className="h-8 rounded-none border-e-0 px-2.5 lowercase data-size:h-8 [&_svg]:hidden">
        <SelectValue />
      </SelectTrigger>
      <SelectContent dir={dir}>
        <SelectGroup>
          {getFilterOperators(filter.variant).map((operator) => (
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
        aria-label={`${columnMeta?.label ?? column.id} filter is ${
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
      if (filter.operator === "isBetween") {
        return (
          <DataTableRangeFilter
            filter={filter}
            column={column}
            inputId={inputId}
            onFilterUpdate={onFilterUpdate}
            className="h-full w-40 gap-0 **:data-[slot='data-table-range-filter-min']:border-e-0 **:data-[slot='data-table-range-filter-separator']:sr-only [&_input]:rounded-none [&_input]:px-1.5"
          />
        );
      }

      return (
        <Input
          id={inputId}
          type={filter.variant === "text" ? "text" : "number"}
          aria-label={`${columnMeta?.label ?? column.id} filter value`}
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
      return <SelectFilterValue {...props} />;

    case "date":
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
  const dir = useDirection();
  return (
    <Select
      aria-label={`${column.columnDef.meta?.label ?? column.id} boolean filter`}
      isOpen={open}
      onOpenChange={onOpenChange}
      placeholder="Select value"
      value={
        typeof filter.value === "string" && filter.value !== ""
          ? filter.value
          : null
      }
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
      <SelectContent dir={dir}>
        <SelectGroup>
          <SelectItem id="true">True</SelectItem>
          <SelectItem id="false">False</SelectItem>
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
  const dir = useDirection();
  const columnMeta = column.columnDef.meta;
  const options = getColumnSelectOptions(columnMeta);
  const value = getSelectFilterValue(filter);
  const multiple =
    filter.operator === "inArray" || filter.operator === "notInArray";

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
        id={inputId}
        aria-label={`${columnMeta?.label ?? column.id} filter value${multiple ? "s" : ""}`}
        variant="ghost"
        className="h-full min-w-16 rounded-none border border-input px-1.5 dark:bg-input/30"
      >
        <SelectedOptions
          options={options}
          value={value}
          placeholder={
            columnMeta?.placeholder ?? `Select option${multiple ? "s" : ""}...`
          }
        />
      </FacetedTrigger>
      <FacetedContent dir={dir} className="w-48">
        <FacetedInput
          aria-label={`Search ${columnMeta?.label ?? column.id} options`}
          placeholder={columnMeta?.placeholder ?? "Search options..."}
        />
        <FacetedList
          renderEmptyState={() => (
            <FacetedEmpty>No options found.</FacetedEmpty>
          )}
        >
          <FacetedGroup>
            {options.map((option) => (
              <FacetedItem
                key={option.value}
                value={option.value}
                textValue={option.label}
              >
                {option.icon && <option.icon />}
                <span className="truncate">{option.label}</span>
                <FacetedItemIndicator />
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

interface SelectedOptionsProps {
  options: ColumnSelectOption[];
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
        {selectedOptions.length > 1 ? (
          <bdi>{`${selectedOptions.length} selected`}</bdi>
        ) : (
          selectedOptions[0]?.label
        )}
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
  const dir = useDirection();
  const label = column.columnDef.meta?.label ?? column.id;
  const [startDate, endDate] = getFilterDates(filter.value);

  return (
    <PopoverTrigger isOpen={open} onOpenChange={onOpenChange}>
      <Button
        id={inputId}
        aria-label={`${label} date filter`}
        variant="ghost"
        className={cn(
          "h-full rounded-none border px-1.5 dark:bg-input/30",
          !startDate && "text-muted-foreground",
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
        <span className="truncate">
          {getDateFilterLabel(filter) ?? "Pick date..."}
        </span>
      </Button>
      <Popover dir={dir} placement="bottom start" className="w-auto p-0">
        {filter.operator === "isBetween" ? (
          <RangeCalendar
            aria-label={`Select ${label} date range`}
            autoFocus
            captionLayout="dropdown"
            value={
              startDate && endDate
                ? {
                    start: toCalendarDate(fromDateToLocal(startDate)),
                    end: toCalendarDate(fromDateToLocal(endDate)),
                  }
                : null
            }
            onChange={(range) =>
              onFilterUpdate(filter.filterId, {
                value: [
                  getFilterDateValue(range.start.toDate(getLocalTimeZone())),
                  getFilterDateValue(range.end.toDate(getLocalTimeZone())),
                ],
              })
            }
          />
        ) : (
          <Calendar
            aria-label={`Select ${label} date`}
            autoFocus
            captionLayout="dropdown"
            value={
              startDate ? toCalendarDate(fromDateToLocal(startDate)) : null
            }
            onChange={(date) => {
              onFilterUpdate(filter.filterId, {
                value: getFilterDateValue(date.toDate(getLocalTimeZone())),
              });
              onOpenChange(false);
            }}
          />
        )}
      </Popover>
    </PopoverTrigger>
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

  switch (getFilterVariant(columnMeta)) {
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
      return (
        <CommandGroup>
          {getColumnSelectOptions(columnMeta).map((option) => (
            <CommandItem
              key={option.value}
              id={option.value}
              textValue={[option.value, option.label].join(" ")}
              className="[&>svg:last-child]:hidden"
              onAction={() => onSelect(option.value)}
            >
              {option.icon && <option.icon />}
              <span className="truncate">{option.label}</span>
              {option.count !== undefined && (
                <span className="ms-auto font-mono text-xs">
                  {option.count}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      );

    case "date":
      return (
        <Calendar
          autoFocus
          captionLayout="dropdown"
          onChange={(date) =>
            onSelect(getFilterDateValue(date.toDate(getLocalTimeZone())))
          }
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
        textValue={search}
        isDisabled={isEmpty}
        onAction={() => onSelect(search)}
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

interface FilterFieldOptionsProps<TData extends RowData> {
  columns: Column<DataTableFeatures, TData>[];
  onSelect: (column: Column<DataTableFeatures, TData>) => void;
}

function FilterFieldOptions<TData extends RowData>({
  columns,
  onSelect,
}: FilterFieldOptionsProps<TData>) {
  return (
    <CommandGroup>
      {columns.map((column) => (
        <CommandItem
          key={column.id}
          id={column.id}
          textValue={column.id}
          onAction={() => onSelect(column)}
        >
          <ColumnLabel column={column} />
        </CommandItem>
      ))}
    </CommandGroup>
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
