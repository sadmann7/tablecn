"use client";

import type { Column, ReactTable, RowData } from "@tanstack/react-table";
import type { KeyboardEvent as KeyboardEventPrimitive } from "react-aria-components";

import {
  fromDateToLocal,
  getLocalTimeZone,
  toCalendarDate,
} from "@internationalized/date";
import { cn } from "cn";
import * as React from "react";

import type { DataTableFeatures } from "@/lib/data-table-features";
import type {
  ColumnFilterItem,
  FilterOperator,
  JoinOperator,
} from "@/lib/data-table-types";

import {
  coerceFilterValue,
  getColumnSelectOptions,
  getDateFilterLabel,
  getDefaultFilter,
  getFilterDates,
  getFilterDateValue,
  getFilterOperators,
  getIsEditableTarget,
  getIsTableShortcutTarget,
  getIsValuelessOperator,
  getSelectFilterValue,
  JOIN_OPERATORS,
} from "@/lib/data-table-utils";
import { generateId } from "@/lib/id";
import { DataTableRangeFilter } from "@/registry/bases/aria/components/data-table/data-table-range-filter";
import { Badge } from "@/registry/bases/aria/ui/badge";
import { Button } from "@/registry/bases/aria/ui/button";
import { Calendar, RangeCalendar } from "@/registry/bases/aria/ui/calendar";
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
  FacetedValue,
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

const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];

type FilterUpdate = Partial<Omit<ColumnFilterItem, "filterId">>;
type FilterSelector = "field" | "operator" | "value";

interface DataTableFilterMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof Popover> {
  table: ReactTable<DataTableFeatures, TData, unknown>;
  disabled?: boolean;
}

export function DataTableFilterMenu<TData extends RowData>({
  table,
  ...props
}: DataTableFilterMenuProps<TData>) {
  return (
    <table.Subscribe
      selector={(state) => ({
        filters: table.getColumnFilterItems(),
        joinOperator: state.joinOperator,
      })}
    >
      {({ filters, joinOperator }) => (
        <DataTableFilterMenuContent
          table={table}
          filters={filters}
          joinOperator={joinOperator}
          {...props}
        />
      )}
    </table.Subscribe>
  );
}

interface DataTableFilterMenuContentProps<
  TData extends RowData,
> extends DataTableFilterMenuProps<TData> {
  filters: ColumnFilterItem[];
  joinOperator: JoinOperator;
}

function DataTableFilterMenuContent<TData extends RowData>({
  table,
  filters,
  joinOperator,
  disabled,
  ...props
}: DataTableFilterMenuContentProps<TData>) {
  const dir = useDirection();
  const id = React.useId();
  const labelId = React.useId();
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

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
      setOpen((open) => !open);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, open]);

  const columns = React.useMemo(
    () => table.getAllLeafColumns().filter((column) => column.getCanFilter()),
    [table],
  );

  const hasFilters = filters.length > 0;

  function onFilterAdd() {
    const column = columns[0];
    if (!column) return;

    table.addColumnFilter({
      ...getDefaultFilter(column),
      filterId: generateId({ length: 8 }),
    });
  }

  function onFilterUpdate(filterId: string, updates: FilterUpdate) {
    table.updateColumnFilter(filterId, updates);
  }

  function onFilterRemove(filterId: string) {
    table.removeColumnFilter(filterId);
    addButtonRef.current?.focus();
  }

  function onFiltersReset() {
    table.resetColumnFilters(true);
    table.resetJoinOperator(true);
  }

  function onTriggerKeyDown(event: KeyboardEventPrimitive) {
    event.continuePropagation();

    const lastFilter = filters.at(-1);
    if (!lastFilter || !getIsRemoveKey(event)) return;

    event.preventDefault();
    onFilterRemove(lastFilter.filterId);
  }

  return (
    <Sortable
      value={filters}
      onValueChange={(value) => table.setColumnFilters(value)}
      getItemValue={(item) => item.filterId}
    >
      <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
        <Button
          ref={triggerRef}
          variant="outline"
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
          {hasFilters && (
            <Badge
              variant="secondary"
              className="h-[18.24px] px-[5.12px] font-mono text-[10.4px]"
            >
              {filters.length}
            </Badge>
          )}
        </Button>
        <Popover
          dir={dir}
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          className="flex w-auto max-w-[calc(100vw-1.5rem)] flex-col gap-3.5 p-4 sm:min-w-95"
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="leading-none font-medium">
              {hasFilters ? "Filters" : "No filters applied"}
            </h4>
            <p
              id={descriptionId}
              className={cn(
                "text-sm text-muted-foreground",
                hasFilters && "sr-only",
              )}
            >
              {hasFilters
                ? "Modify filters to refine your rows."
                : "Add filters to refine your rows."}
            </p>
          </div>
          {hasFilters && (
            <SortableContent
              aria-labelledby={labelId}
              className="grid max-h-75 grid-cols-[minmax(4.5rem,auto)_8rem_8rem_minmax(10rem,max-content)_auto_auto] gap-x-2 gap-y-2 overflow-y-auto p-1"
            >
              {filters.map((filter, index) => (
                <DataTableFilterItem<TData>
                  key={filter.filterId}
                  filter={filter}
                  index={index}
                  filterItemId={`${id}-filter-${filter.filterId}`}
                  joinOperator={joinOperator}
                  columns={columns}
                  onJoinOperatorChange={(value) => table.setJoinOperator(value)}
                  onFilterUpdate={onFilterUpdate}
                  onFilterRemove={onFilterRemove}
                />
              ))}
            </SortableContent>
          )}
          <div className="flex w-full items-center gap-2">
            <Button ref={addButtonRef} onPress={onFilterAdd}>
              Add filter
            </Button>
            {hasFilters && (
              <Button variant="outline" onPress={onFiltersReset}>
                Reset filters
              </Button>
            )}
          </div>
        </Popover>
      </PopoverTrigger>
    </Sortable>
  );
}

function getIsRemoveKey(event: React.KeyboardEvent) {
  return REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase());
}

interface DataTableFilterItemProps<TData extends RowData> {
  filter: ColumnFilterItem;
  index: number;
  filterItemId: string;
  joinOperator: JoinOperator;
  columns: Column<DataTableFeatures, TData>[];
  onJoinOperatorChange: (value: JoinOperator) => void;
  onFilterUpdate: (filterId: string, updates: FilterUpdate) => void;
  onFilterRemove: (filterId: string) => void;
}

function DataTableFilterItem<TData extends RowData>({
  filter,
  index,
  filterItemId,
  joinOperator,
  columns,
  onJoinOperatorChange,
  onFilterUpdate,
  onFilterRemove,
}: DataTableFilterItemProps<TData>) {
  const [activeSelector, setActiveSelector] =
    React.useState<FilterSelector | null>(null);

  const column = columns.find((column) => column.id === filter.id);
  if (!column) return null;

  const label = column.columnDef.meta?.label ?? column.id;

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
    <SortableItem
      value={filter.filterId}
      textValue={column.columnDef.meta?.label ?? filter.id}
      className="col-span-full grid grid-cols-subgrid items-center"
      onKeyDown={onItemKeyDown}
    >
      <div className="min-w-18 text-center">
        <FilterJoinOperator
          index={index}
          joinOperator={joinOperator}
          onJoinOperatorChange={onJoinOperatorChange}
        />
      </div>
      <FilterFieldSelector
        filter={filter}
        column={column}
        columns={columns}
        onFilterUpdate={onFilterUpdate}
        {...getSelectorProps("field")}
      />
      <FilterOperatorSelector
        filter={filter}
        label={label}
        onFilterUpdate={onFilterUpdate}
        {...getSelectorProps("operator")}
      />
      <div className="w-full min-w-0">
        <FilterValueInput
          filter={filter}
          column={column}
          inputId={`${filterItemId}-input`}
          onFilterUpdate={onFilterUpdate}
          {...getSelectorProps("value")}
        />
      </div>
      <Button
        aria-label={`Remove ${label} filter`}
        variant="outline"
        size="icon"
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
        aria-label={`Reorder ${label} filter`}
        variant="outline"
        size="icon"
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

interface FilterJoinOperatorProps {
  index: number;
  joinOperator: JoinOperator;
  onJoinOperatorChange: (value: JoinOperator) => void;
}

function FilterJoinOperator({
  index,
  joinOperator,
  onJoinOperatorChange,
}: FilterJoinOperatorProps) {
  const dir = useDirection();
  if (index === 0) {
    return <span className="text-sm text-muted-foreground">Where</span>;
  }

  if (index > 1) {
    return (
      <span className="text-sm text-muted-foreground">{joinOperator}</span>
    );
  }

  return (
    <Select
      aria-label="Select join operator"
      placeholder={joinOperator}
      value={joinOperator}
      onChange={(value) => {
        if (value == null) return;
        onJoinOperatorChange(value as JoinOperator);
      }}
    >
      <SelectTrigger className="lowercase">
        <SelectValue />
      </SelectTrigger>
      <SelectContent dir={dir} className="min-w-(--trigger-width) lowercase">
        <SelectGroup>
          {JOIN_OPERATORS.map((joinOperator) => (
            <SelectItem key={joinOperator} id={joinOperator}>
              {joinOperator}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
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
      <FacetedTrigger variant="outline" className="w-32">
        <span className="truncate">
          {column.columnDef.meta?.label ?? "Select field"}
        </span>
        <IconPlaceholder
          lucide="ChevronsUpDown"
          tabler="IconSelector"
          hugeicons="UnfoldMoreIcon"
          phosphor="CaretUpDownIcon"
          remixicon="RiArrowUpDownLine"
          className="opacity-50"
        />
      </FacetedTrigger>
      <FacetedContent dir={dir} className="w-40">
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
                <span className="truncate">
                  {column.columnDef.meta?.label ?? column.id}
                </span>
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
      <SelectTrigger className="w-32 lowercase">
        <div className="truncate">
          <SelectValue />
        </div>
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
        className="h-8 w-full rounded-lg border border-dashed border-input bg-transparent dark:bg-input/30"
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
          />
        );
      }

      return (
        <Input
          id={inputId}
          type={filter.variant === "text" ? "text" : "number"}
          aria-label={`${columnMeta?.label ?? column.id} filter value`}
          inputMode={filter.variant === "text" ? undefined : "numeric"}
          placeholder={columnMeta?.placeholder ?? "Enter a value..."}
          defaultValue={
            typeof filter.value === "string" ? filter.value : undefined
          }
          onChange={(event) =>
            onFilterUpdate(filter.filterId, { value: event.target.value })
          }
        />
      );

    case "boolean":
      return <BooleanFilterValue {...props} />;

    case "select":
    case "multi-select":
      return <SelectFilterValue {...props} />;

    case "date":
    case "date-range":
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
      placeholder="Select value"
      isOpen={open}
      onOpenChange={onOpenChange}
      value={typeof filter.value === "string" ? filter.value : null}
      onChange={(value) => {
        if (value == null) return;
        onFilterUpdate(filter.filterId, { value: String(value) });
      }}
    >
      <SelectTrigger id={inputId} className="w-full">
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
  const multiple = filter.variant === "multi-select";

  return (
    <Faceted
      open={open}
      onOpenChange={onOpenChange}
      value={getSelectFilterValue(filter)}
      onValueChange={(value) =>
        onFilterUpdate(filter.filterId, { value: value ?? "" })
      }
      items={getColumnSelectOptions(columnMeta)}
      multiple={multiple}
    >
      <FacetedTrigger
        id={inputId}
        aria-label={`${columnMeta?.label ?? column.id} filter value${multiple ? "s" : ""}`}
        variant="outline"
        className="w-full hover:bg-muted/50 aria-expanded:bg-background dark:aria-expanded:bg-input/30"
      >
        <FacetedValue
          placeholder={
            columnMeta?.placeholder ?? `Select option${multiple ? "s" : ""}...`
          }
        />
      </FacetedTrigger>
      <FacetedContent dir={dir} className="w-50">
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
            {getColumnSelectOptions(columnMeta).map((option) => (
              <FacetedItem
                key={option.value}
                value={option.value}
                textValue={option.label}
              >
                {option.icon && <option.icon />}
                <span className="flex-1 truncate">{option.label}</span>
                <FacetedItemIndicator>{option.count}</FacetedItemIndicator>
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
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
        variant="outline"
        className={cn(
          "w-full justify-start text-start",
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
        <span className="truncate">
          {getDateFilterLabel(filter) ?? "Pick a date"}
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
