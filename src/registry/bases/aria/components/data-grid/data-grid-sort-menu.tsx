"use client";

import type { ColumnSort, RowData, Table } from "@tanstack/react-table";
import type { KeyboardEvent as KeyboardEventPrimitive } from "react-aria-components";

import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { Badge } from "@/registry/bases/aria/ui/badge";
import { Button } from "@/registry/bases/aria/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/registry/bases/aria/ui/command";
import { useDirection } from "@/registry/bases/aria/ui/direction";
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

const SORT_SHORTCUT_KEY = "s";
const REMOVE_SORT_SHORTCUTS = new Set(["backspace", "delete"]);
const SORT_ORDERS = [
  { label: "Asc", value: "asc" },
  { label: "Desc", value: "desc" },
];

interface DataGridSortMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof Popover> {
  table: Table<DataGridFeatures, TData>;
  disabled?: boolean;
}

export function DataGridSortMenu<TData extends RowData>({
  table,
  disabled,
  className,
  ...props
}: DataGridSortMenuProps<TData>) {
  const dir = useDirection();
  const id = React.useId();
  const labelId = React.useId();
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  const sorting = table.store.state.sorting;
  const onSortingChange = table.setSorting;

  const { columnLabels, columns } = React.useMemo(() => {
    const labels = new Map<string, string>();
    const sortingIds = new Set(sorting.map((s) => s.id));
    const availableColumns: { id: string; label: string }[] = [];

    for (const column of table.getAllColumns()) {
      if (!column.getCanSort()) continue;

      const label = column.columnDef.meta?.label ?? column.id;
      labels.set(column.id, label);

      if (!sortingIds.has(column.id)) {
        availableColumns.push({ id: column.id, label });
      }
    }

    return {
      columnLabels: labels,
      columns: availableColumns,
    };
  }, [sorting, table]);

  const onSortAdd = React.useCallback(() => {
    const firstColumn = columns[0];
    if (!firstColumn) return;

    onSortingChange((prevSorting) => [
      ...prevSorting,
      { id: firstColumn.id, desc: false },
    ]);
  }, [columns, onSortingChange]);

  const onSortUpdate = React.useCallback(
    (sortId: string, updates: Partial<ColumnSort>) => {
      onSortingChange((prevSorting) => {
        if (!prevSorting) return prevSorting;
        return prevSorting.map((sort) =>
          sort.id === sortId ? { ...sort, ...updates } : sort,
        );
      });
    },
    [onSortingChange],
  );

  const onSortRemove = React.useCallback(
    (sortId: string) => {
      onSortingChange((prevSorting) =>
        prevSorting.filter((item) => item.id !== sortId),
      );
    },
    [onSortingChange],
  );

  const onSortingReset = React.useCallback(
    () => onSortingChange(table.initialState.sorting),
    [onSortingChange, table.initialState.sorting],
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
        event.key.toLowerCase() === SORT_SHORTCUT_KEY &&
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
      const sortId = (event.target as HTMLElement)
        .closest('[data-slot="sortable-item"]')
        ?.getAttribute("data-value");
      if (!sortId) return;

      if (REMOVE_SORT_SHORTCUTS.has(event.key.toLowerCase())) {
        event.preventDefault();
        onSortRemove(sortId);
      }
    },
    [onSortRemove],
  );

  const onTriggerKeyDown = React.useCallback(
    (event: KeyboardEventPrimitive) => {
      event.continuePropagation();

      if (
        REMOVE_SORT_SHORTCUTS.has(event.key.toLowerCase()) &&
        sorting.length > 0
      ) {
        event.preventDefault();
        onSortingReset();
      }
    },
    [sorting.length, onSortingReset],
  );

  return (
    <Sortable
      value={sorting}
      onValueChange={onSortingChange}
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
            lucide="ArrowDownUp"
            tabler="IconArrowsLeftRight"
            hugeicons="ArrowDataTransferHorizontalIcon"
            phosphor="ArrowsVerticalIcon"
            remixicon="RiArrowUpDownLine"
            className="text-muted-foreground"
          />
          Sort
          {sorting.length > 0 && (
            <Badge
              variant="secondary"
              className="h-[18.24px] rounded-md px-[5.12px] font-mono text-[10.4px] font-normal"
            >
              {sorting.length}
            </Badge>
          )}
        </Button>
        <Popover
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          dir={dir}
          className={cn(
            "flex w-auto max-w-[calc(100vw-1.5rem)] flex-col gap-3.5 p-4 sm:min-w-95",
            className,
          )}
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="leading-none font-medium">
              {sorting.length > 0 ? "Sort by" : "No sorting applied"}
            </h4>
            <p
              id={descriptionId}
              className={cn(
                "text-sm text-muted-foreground",
                sorting.length > 0 && "sr-only",
              )}
            >
              {sorting.length > 0
                ? "Modify sorting to organize your rows."
                : "Add sorting to organize your rows."}
            </p>
          </div>
          {sorting.length > 0 && (
            <div onKeyDown={onItemKeyDown}>
              <SortableContent
                aria-labelledby={labelId}
                className="flex max-h-75 flex-col gap-2 overflow-y-auto p-1"
              >
                {sorting.map((sort) => (
                  <DataTableSortItem
                    key={sort.id}
                    sort={sort}
                    sortItemId={`${id}-sort-${sort.id}`}
                    dir={dir}
                    columns={columns}
                    columnLabels={columnLabels}
                    onSortUpdate={onSortUpdate}
                    onSortRemove={onSortRemove}
                  />
                ))}
              </SortableContent>
            </div>
          )}
          <div className="flex w-full items-center gap-2">
            <Button
              className="rounded"
              ref={addButtonRef}
              onPress={onSortAdd}
              isDisabled={columns.length === 0}
            >
              Add sort
            </Button>
            {sorting.length > 0 && (
              <Button
                variant="outline"
                className="rounded"
                onPress={onSortingReset}
              >
                Reset sorting
              </Button>
            )}
          </div>
        </Popover>
      </PopoverTrigger>
    </Sortable>
  );
}

interface DataTableSortItemProps {
  sort: ColumnSort;
  sortItemId: string;
  dir: "ltr" | "rtl";
  columns: { id: string; label: string }[];
  columnLabels: Map<string, string>;
  onSortUpdate: (sortId: string, updates: Partial<ColumnSort>) => void;
  onSortRemove: (sortId: string) => void;
}

function DataTableSortItem({
  sort,
  sortItemId,
  dir,
  columns,
  columnLabels,
  onSortUpdate,
  onSortRemove,
}: DataTableSortItemProps) {
  const fieldTriggerId = `${sortItemId}-field-trigger`;

  const [showFieldSelector, setShowFieldSelector] = React.useState(false);
  const [showDirectionSelector, setShowDirectionSelector] =
    React.useState(false);

  return (
    <SortableItem
      value={sort.id}
      textValue={columnLabels.get(sort.id)}
      className="flex items-center gap-2"
    >
      <PopoverTrigger
        isOpen={showFieldSelector}
        onOpenChange={setShowFieldSelector}
      >
        <Button
          id={fieldTriggerId}
          variant="outline"
          className="w-44 justify-between rounded font-normal"
        >
          <span className="truncate">{columnLabels.get(sort.id)}</span>
          <IconPlaceholder
            lucide="ChevronsUpDown"
            tabler="IconSelector"
            hugeicons="UnfoldMoreIcon"
            phosphor="CaretUpDownIcon"
            remixicon="RiArrowUpDownLine"
            className="opacity-50"
          />
        </Button>
        <Popover dir={dir} className="w-(--trigger-width) p-0">
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
                    onAction={() => onSortUpdate(sort.id, { id: column.id })}
                  >
                    <span className="truncate">{column.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover>
      </PopoverTrigger>
      <Select
        aria-label="Select sort direction"
        isOpen={showDirectionSelector}
        onOpenChange={setShowDirectionSelector}
        value={sort.desc ? "desc" : "asc"}
        onChange={(value) => {
          if (value == null) return;
          onSortUpdate(sort.id, { desc: value === "desc" });
        }}
      >
        <SelectTrigger className="w-24 rounded">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {SORT_ORDERS.map((order) => (
              <SelectItem key={order.value} id={order.value}>
                {order.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0 rounded"
        onPress={() => onSortRemove(sort.id)}
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
        className="size-8 shrink-0 rounded"
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
