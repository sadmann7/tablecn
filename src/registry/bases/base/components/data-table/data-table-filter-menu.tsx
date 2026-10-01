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
import type { ColumnFilterItem, JoinOperator } from "@/lib/data-table-types";

import {
  getColumnFilterDefaults,
  getDateFilterLabel,
  getFilterDates,
  getFilterOperators,
  getFilterValueForOperator,
  getIsEditableTarget,
  getIsValuelessOperator,
  getSelectFilterValue,
  JOIN_OPERATORS,
  toFilterTimestamp,
} from "@/lib/data-table-utils";
import { generateId } from "@/lib/id";
import { DataTableRangeFilter } from "@/registry/bases/base/components/data-table/data-table-range-filter";
import { Badge } from "@/registry/bases/base/ui/badge";
import { Button } from "@/registry/bases/base/ui/button";
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
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay,
} from "@/registry/bases/base/ui/sortable";
import { Calendar } from "@/registry/bases/radix/ui/calendar";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

const FILTER_SHORTCUT_KEY = "f";
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"];

function getIsRemoveKey(event: React.KeyboardEvent) {
  return REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase());
}

type FilterUpdate = Partial<Omit<ColumnFilterItem, "filterId">>;
type FilterSelector = "field" | "operator" | "value";

interface DataTableFilterMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof PopoverContent> {
  table: Table<DataTableFeatures, TData>;
  disabled?: boolean;
}

export function DataTableFilterMenu<TData extends RowData>({
  table,
  ...props
}: DataTableFilterMenuProps<TData>) {
  return (
    <Subscribe
      source={table.store}
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
    </Subscribe>
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
  const id = React.useId();
  const labelId = React.useId();
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

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

  const hasFilters = filters.length > 0;

  function onFilterAdd() {
    const column = columns[0];
    if (!column) return;

    table.addColumnFilter({
      ...getColumnFilterDefaults(column),
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

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
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
          Filter
          {hasFilters && (
            <Badge
              variant="secondary"
              className="h-[18.24px] px-[5.12px] font-mono text-[10.4px]"
            >
              {filters.length}
            </Badge>
          )}
        </PopoverTrigger>
        <PopoverContent
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          className="flex w-full max-w-(--available-width) flex-col gap-3.5 p-4 sm:min-w-95"
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
              render={
                <div
                  role="list"
                  className="grid max-h-75 grid-cols-[minmax(4.5rem,auto)_8rem_8rem_minmax(10rem,max-content)_auto_auto] gap-x-2 gap-y-2 overflow-y-auto p-1"
                />
              }
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
            <Button ref={addButtonRef} onClick={onFilterAdd}>
              Add filter
            </Button>
            {hasFilters && (
              <Button variant="outline" onClick={onFiltersReset}>
                Reset filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <SortableOverlay>
        <div className="grid size-full grid-cols-[minmax(4.5rem,auto)_8rem_8rem_minmax(10rem,1fr)_auto_auto] items-center gap-2">
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
      render={
        <div
          role="listitem"
          id={filterItemId}
          tabIndex={-1}
          className="col-span-full grid grid-cols-subgrid items-center"
          onKeyDown={onItemKeyDown}
        />
      }
    >
      <div className="min-w-18 text-center">
        <FilterJoinOperator
          index={index}
          joinOperator={joinOperator}
          listboxId={`${filterItemId}-join-operator-listbox`}
          onJoinOperatorChange={onJoinOperatorChange}
        />
      </div>
      <FilterFieldSelector
        filter={filter}
        column={column}
        columns={columns}
        listboxId={`${filterItemId}-field-listbox`}
        onFilterUpdate={onFilterUpdate}
        {...getSelectorProps("field")}
      />
      <FilterOperatorSelector
        filter={filter}
        listboxId={`${filterItemId}-operator-listbox`}
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
        aria-controls={filterItemId}
        variant="outline"
        size="icon"
        onClick={() => onFilterRemove(filter.filterId)}
      >
        <IconPlaceholder
          lucide="Trash2"
          tabler="IconTrash"
          hugeicons="Delete02Icon"
          phosphor="TrashIcon"
          remixicon="RiDeleteBinLine"
        />
      </Button>
      <SortableItemHandle render={<Button variant="outline" size="icon" />}>
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
  listboxId: string;
  onJoinOperatorChange: (value: JoinOperator) => void;
}

function FilterJoinOperator({
  index,
  joinOperator,
  listboxId,
  onJoinOperatorChange,
}: FilterJoinOperatorProps) {
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
      value={joinOperator}
      onValueChange={(value) => {
        if (value == null) return;
        onJoinOperatorChange(value);
      }}
    >
      <SelectTrigger
        aria-label="Select join operator"
        aria-controls={listboxId}
        className="lowercase"
      >
        <SelectValue placeholder={joinOperator} />
      </SelectTrigger>
      <SelectContent
        id={listboxId}
        alignItemWithTrigger={false}
        className="min-w-(--anchor-width) lowercase"
      >
        <SelectGroup>
          {JOIN_OPERATORS.map((joinOperator) => (
            <SelectItem key={joinOperator} value={joinOperator}>
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
  listboxId: string;
}

function FilterFieldSelector<TData extends RowData>({
  filter,
  column,
  columns,
  listboxId,
  open,
  onOpenChange,
  onFilterUpdate,
}: FilterFieldSelectorProps<TData>) {
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
            aria-controls={listboxId}
            variant="outline"
            className="w-32"
          />
        }
      >
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
      <FacetedContent id={listboxId} className="w-40">
        <FacetedInput placeholder="Search fields..." />
        <FacetedList>
          <FacetedEmpty>No fields found.</FacetedEmpty>
          <FacetedGroup>
            {columns.map((column) => (
              <FacetedItem key={column.id} value={column.id}>
                <span className="truncate">{column.columnDef.meta?.label}</span>
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
      <SelectTrigger aria-controls={listboxId} className="w-32 lowercase">
        <div className="truncate">
          <SelectValue placeholder={filter.operator} />
        </div>
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
          aria-label={`${columnMeta?.label} filter value`}
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
      value={typeof filter.value === "string" ? filter.value : null}
      onValueChange={(value) => {
        if (value == null) return;
        onFilterUpdate(filter.filterId, { value });
      }}
    >
      <SelectTrigger
        id={inputId}
        aria-controls={listboxId}
        aria-label={`${column.columnDef.meta?.label} boolean filter`}
        className="w-full"
      >
        <SelectValue placeholder="Select value" />
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
  const multiple = filter.variant === "multiSelect";

  return (
    <Faceted
      open={open}
      onOpenChange={onOpenChange}
      value={getSelectFilterValue(filter)}
      onValueChange={(value) =>
        onFilterUpdate(filter.filterId, { value: value ?? "" })
      }
      items={columnMeta?.options}
      multiple={multiple}
    >
      <FacetedTrigger
        render={
          <Button
            id={inputId}
            aria-controls={listboxId}
            aria-label={`${columnMeta?.label} filter value${multiple ? "s" : ""}`}
            variant="outline"
            className="w-full hover:bg-muted/50 aria-expanded:bg-background dark:aria-expanded:bg-input/30"
          />
        }
      >
        <FacetedValue
          placeholder={
            columnMeta?.placeholder ?? `Select option${multiple ? "s" : ""}...`
          }
        />
      </FacetedTrigger>
      <FacetedContent id={listboxId} className="w-50">
        <FacetedInput
          aria-label={`Search ${columnMeta?.label} options`}
          placeholder={columnMeta?.placeholder ?? "Search options..."}
        />
        <FacetedList>
          <FacetedEmpty>No options found.</FacetedEmpty>
          <FacetedGroup>
            {columnMeta?.options?.map((option) => (
              <FacetedItem key={option.value} value={option.value}>
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
            variant="outline"
            className={cn(
              "w-full justify-start text-left",
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
        />
        <span className="truncate">
          {getDateFilterLabel(filter) ?? "Pick a date"}
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
