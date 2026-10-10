"use client";

import {
  type Column,
  type ColumnSort,
  type Header,
  type RowData,
  type SortDirection,
  type SortingState,
  Subscribe,
  type Table,
} from "@tanstack/react-table";
import { cn } from "cn";
import { composeEventHandlers } from "radix-ui/internal";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { getBadgeListWidth } from "@/hooks/use-badge-overflow";
import {
  getColumnFitSize,
  getColumnLabel,
  getColumnVariant,
  getIsFileCellData,
  getIsEventOnScrollbar,
} from "@/lib/data-grid-utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/radix/ui/tooltip";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataGridColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.ComponentProps<typeof DropdownMenuTrigger> {
  header: Header<DataGridFeatures, TData, TValue>;
  table: Table<DataGridFeatures, TData>;
}

export function DataGridColumnHeader<TData extends RowData, TValue>(
  props: DataGridColumnHeaderProps<TData, TValue>,
) {
  return (
    <Subscribe
      source={props.table.atoms.columnResizing}
      selector={(columnResizing) => !!columnResizing.isResizingColumn}
    >
      {(isAnyColumnResizing) => (
        <DataGridColumnHeaderImpl
          {...props}
          isAnyColumnResizing={isAnyColumnResizing}
        />
      )}
    </Subscribe>
  );
}

function DataGridColumnHeaderImpl<TData extends RowData, TValue>({
  header,
  table,
  isAnyColumnResizing,
  className,
  onPointerDown,
  ...props
}: DataGridColumnHeaderProps<TData, TValue> & {
  isAnyColumnResizing: boolean;
}) {
  const column = header.column;
  const label = getColumnLabel(column);

  const cellVariant = column.columnDef.meta?.cell;
  const columnVariant = getColumnVariant(cellVariant?.variant);

  const pinnedPosition = column.getIsPinned();
  const isPinnedLeft = pinnedPosition === "start";
  const isPinnedRight = pinnedPosition === "end";

  const onSortingChange = React.useCallback(
    (direction: SortDirection) => {
      table.setSorting((prev: SortingState) => {
        const existingSortIndex = prev.findIndex(
          (sort) => sort.id === column.id,
        );
        const newSort: ColumnSort = {
          id: column.id,
          desc: direction === "desc",
        };

        if (existingSortIndex >= 0) {
          const updated = [...prev];
          updated[existingSortIndex] = newSort;
          return updated;
        } else {
          return [...prev, newSort];
        }
      });
    },
    [column.id, table],
  );

  const onSortRemove = React.useCallback(() => {
    table.setSorting((prev: SortingState) =>
      prev.filter((sort) => sort.id !== column.id),
    );
  }, [column.id, table]);

  const onLeftPin = React.useCallback(() => {
    column.pin("start");
  }, [column]);

  const onRightPin = React.useCallback(() => {
    column.pin("end");
  }, [column]);

  const onUnpin = React.useCallback(() => {
    column.pin(false);
  }, [column]);

  const onTriggerPointerDown = React.useMemo(
    () =>
      composeEventHandlers(
        onPointerDown,
        (event: React.PointerEvent<HTMLButtonElement>) => {
          // Also stops Radix from opening the menu on a scrollbar press
          if (getIsEventOnScrollbar(event)) {
            event.preventDefault();
            return;
          }

          if (event.button !== 0) return;
          table.selectColumnCells(column.id);
        },
      ),
    [table, column.id, onPointerDown],
  );

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          tabIndex={-1}
          className={cn(
            "flex size-full items-center justify-between gap-2 p-2 text-sm outline-none hover:bg-accent/40 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset data-[state=open]:bg-accent/40 [&_svg]:size-4",
            isAnyColumnResizing && "pointer-events-none",
            className,
          )}
          onPointerDown={onTriggerPointerDown}
          {...props}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {columnVariant && (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <columnVariant.icon className="size-3.5 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{columnVariant.label}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <span className="truncate">{label}</span>
          </div>
          <IconPlaceholder
            lucide="ChevronDownIcon"
            tabler="IconChevronDown"
            hugeicons="ArrowDown01Icon"
            phosphor="CaretDownIcon"
            remixicon="RiArrowDownSLine"
            className="shrink-0 text-muted-foreground"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={0} className="w-60">
          {column.getCanSort() && (
            <>
              <DropdownMenuCheckboxItem
                className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
                checked={column.getIsSorted() === "asc"}
                onSelect={() => onSortingChange("asc")}
              >
                <IconPlaceholder
                  lucide="ChevronUpIcon"
                  tabler="IconChevronUp"
                  hugeicons="ArrowUp01Icon"
                  phosphor="CaretUpIcon"
                  remixicon="RiArrowUpSLine"
                />
                Sort asc
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
                checked={column.getIsSorted() === "desc"}
                onSelect={() => onSortingChange("desc")}
              >
                <IconPlaceholder
                  lucide="ChevronDownIcon"
                  tabler="IconChevronDown"
                  hugeicons="ArrowDown01Icon"
                  phosphor="CaretDownIcon"
                  remixicon="RiArrowDownSLine"
                />
                Sort desc
              </DropdownMenuCheckboxItem>
              {column.getIsSorted() && (
                <DropdownMenuItem onSelect={onSortRemove}>
                  <IconPlaceholder
                    lucide="XIcon"
                    tabler="IconX"
                    hugeicons="Cancel01Icon"
                    phosphor="XIcon"
                    remixicon="RiCloseLine"
                  />
                  Remove sort
                </DropdownMenuItem>
              )}
            </>
          )}
          {column.getCanPin() && (
            <>
              {column.getCanSort() && <DropdownMenuSeparator />}

              {isPinnedLeft ? (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onSelect={onUnpin}
                >
                  <IconPlaceholder
                    lucide="PinOffIcon"
                    tabler="IconPinnedOff"
                    hugeicons="BookmarkIcon"
                    phosphor="PushPinSlashIcon"
                    remixicon="RiUnpinLine"
                  />
                  Unpin from left
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onSelect={onLeftPin}
                >
                  <IconPlaceholder
                    lucide="PinIcon"
                    tabler="IconPin"
                    hugeicons="BookmarkIcon"
                    phosphor="PushPinIcon"
                    remixicon="RiPushpinLine"
                  />
                  Pin to left
                </DropdownMenuItem>
              )}
              {isPinnedRight ? (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onSelect={onUnpin}
                >
                  <IconPlaceholder
                    lucide="PinOffIcon"
                    tabler="IconPinnedOff"
                    hugeicons="BookmarkIcon"
                    phosphor="PushPinSlashIcon"
                    remixicon="RiUnpinLine"
                  />
                  Unpin from right
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onSelect={onRightPin}
                >
                  <IconPlaceholder
                    lucide="PinIcon"
                    tabler="IconPin"
                    hugeicons="BookmarkIcon"
                    phosphor="PushPinIcon"
                    remixicon="RiPushpinLine"
                  />
                  Pin to right
                </DropdownMenuItem>
              )}
            </>
          )}
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="[&_svg]:text-muted-foreground"
                onSelect={() => column.toggleVisibility(false)}
              >
                <IconPlaceholder
                  lucide="EyeOffIcon"
                  tabler="IconEyeClosed"
                  hugeicons="ViewOffIcon"
                  phosphor="EyeSlashIcon"
                  remixicon="RiEyeOffLine"
                />
                Hide column
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {header.column.getCanResize() && (
        <DataGridColumnResizer header={header} table={table} label={label} />
      )}
    </>
  );
}

const DataGridColumnResizer = React.memo(
  DataGridColumnResizerImpl,
  (prev, next) => {
    const prevColumn = prev.header.column;
    const nextColumn = next.header.column;

    if (
      prevColumn.getIsResizing() !== nextColumn.getIsResizing() ||
      prevColumn.getSize() !== nextColumn.getSize()
    ) {
      return false;
    }

    if (prev.label !== next.label) return false;

    return true;
  },
) as typeof DataGridColumnResizerImpl;

interface DataGridColumnResizerProps<
  TData extends RowData,
  TValue,
> extends DataGridColumnHeaderProps<TData, TValue> {
  label: string;
}

function DataGridColumnResizerImpl<TData extends RowData, TValue>({
  header,
  table,
  label,
}: DataGridColumnResizerProps<TData, TValue>) {
  const defaultColumnDef = table.getDefaultColumnDef();
  const minSize =
    header.column.columnDef.minSize ?? defaultColumnDef.minSize ?? 0;
  const maxSize =
    header.column.columnDef.maxSize ??
    defaultColumnDef.maxSize ??
    Number.POSITIVE_INFINITY;

  const onDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const column = header.column;
      const gridElement =
        event.currentTarget.closest<HTMLElement>('[role="grid"]');
      const fitSize = gridElement
        ? getColumnFitSize({
            gridElement,
            columnId: column.id,
            minSize,
            maxSize,
            wrapperContentSize: getBadgeColumnContentSize(column, table),
          })
        : null;

      if (fitSize === null) {
        column.resetSize();
        return;
      }

      table.setColumnSizing((prev) => ({ ...prev, [column.id]: fitSize }));
    },
    [header.column, table, minSize, maxSize],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={header.column.getSize()}
      aria-valuemin={minSize}
      aria-valuemax={Number.isFinite(maxSize) ? maxSize : undefined}
      tabIndex={-1}
      className={cn(
        "absolute -inset-e-px top-0 z-50 h-full w-0.5 cursor-ew-resize touch-none bg-border transition-opacity select-none after:absolute after:inset-y-0 after:inset-s-1/2 after:h-full after:w-4.5 after:-translate-x-1/2 after:content-[''] hover:bg-primary focus:bg-primary focus:outline-none",
        header.column.getIsResizing()
          ? "bg-primary"
          : "opacity-0 hover:opacity-100",
      )}
      onDoubleClick={onDoubleClick}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
    />
  );
}

function getBadgeColumnContentSize<TData extends RowData, TValue>(
  column: Column<DataGridFeatures, TData, TValue>,
  table: Table<DataGridFeatures, TData>,
): number {
  const cellOpts = column.columnDef.meta?.cell;
  if (cellOpts?.variant !== "multi-select" && cellOpts?.variant !== "file") {
    return 0;
  }

  const labelByValue = new Map(
    cellOpts.variant === "multi-select"
      ? cellOpts.options.map((option) => [option.value, option.label])
      : [],
  );

  let contentSize = 0;
  for (const row of table.getRowModel().rows) {
    const value = row.getValue(column.id);
    if (!Array.isArray(value)) continue;

    const rowContentSize =
      cellOpts.variant === "multi-select"
        ? getBadgeListWidth({
            items: value
              .filter((item): item is string => typeof item === "string")
              .map((item) => labelByValue.get(item) ?? item)
              .filter(Boolean),
            getLabel: (label) => label,
          })
        : getBadgeListWidth({
            items: value.filter(getIsFileCellData),
            getLabel: (file) => file.name,
            cacheKeyPrefix: "file",
            iconSize: 12,
            maxWidth: 100,
          });
    contentSize = Math.max(contentSize, rowContentSize);
  }

  return contentSize;
}
