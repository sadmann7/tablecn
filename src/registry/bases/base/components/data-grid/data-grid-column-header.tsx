"use client";

import type { BaseUIEvent } from "@base-ui/react/types";

import {
  type Column,
  type ColumnSort,
  type Header,
  type ReactTable,
  type RowData,
  type SortDirection,
  Subscribe,
  type Table,
} from "@tanstack/react-table";
import { cn } from "cn";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { getBadgeListWidth } from "@/hooks/use-badge-overflow";
import {
  getColumnFitSize,
  getColumnLabel,
  getColumnVariantLabel,
  getIsEventOnScrollbar,
  getIsFileCellData,
} from "@/lib/data-grid-utils";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/registry/bases/base/ui/tooltip";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataGridColumnHeaderProps<
  TData extends RowData,
  TValue,
> extends React.ComponentProps<typeof DropdownMenuTrigger> {
  table: ReactTable<DataGridFeatures, TData, unknown>;
  header: Header<DataGridFeatures, TData, TValue>;
}

export function DataGridColumnHeader<TData extends RowData, TValue>(
  props: DataGridColumnHeaderProps<TData, TValue>,
) {
  return (
    <Subscribe
      source={props.table.atoms.columnResizing}
      selector={(columnResizing) => columnResizing.isResizingColumn}
    >
      {(resizingColumnId) => (
        <DataGridColumnHeaderContent
          {...props}
          resizingColumnId={resizingColumnId}
        />
      )}
    </Subscribe>
  );
}

function DataGridColumnHeaderContent<TData extends RowData, TValue>({
  table,
  header,
  resizingColumnId,
  onPointerDown,
  onMouseDown,
  className,
  ...props
}: DataGridColumnHeaderProps<TData, TValue> & {
  resizingColumnId: string | false;
}) {
  const column = header.column;
  const isAnyColumnResizing = resizingColumnId !== false;
  const label = getColumnLabel(column);

  const meta = column.columnDef.meta;
  const columnVariant = getColumnVariantLabel(meta);
  const ColumnIcon = meta?.icon ?? columnVariant?.icon;

  const onTriggerPointerDown = React.useCallback(
    (event: BaseUIEvent<React.PointerEvent<HTMLButtonElement>>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented) return;

      if (getIsEventOnScrollbar(event)) return;
      if (event.button !== 0) return;
      table.selectColumnCells(column.id);
    },
    [table, column.id, onPointerDown],
  );

  const onTriggerMouseDown = React.useCallback(
    (event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>) => {
      onMouseDown?.(event);
      if (event.defaultPrevented) return;

      if (getIsEventOnScrollbar(event)) event.preventBaseUIHandler();
    },
    [onMouseDown],
  );

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          tabIndex={-1}
          className={cn(
            "flex size-full items-center justify-between gap-2 p-2 text-sm outline-none hover:bg-accent/40 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset data-open:bg-accent/40 [&_svg]:size-4",
            isAnyColumnResizing && "pointer-events-none",
            className,
          )}
          onPointerDown={onTriggerPointerDown}
          onMouseDown={onTriggerMouseDown}
          {...props}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {ColumnIcon &&
              (columnVariant ? (
                <TooltipProvider delay={100}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <ColumnIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      }
                    />
                    <TooltipContent side="top">
                      <p>{columnVariant.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <ColumnIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ))}
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
        <DropdownMenuContent align="start" sideOffset={1} className="w-60">
          <DataGridColumnMenuItems column={column} />
        </DropdownMenuContent>
      </DropdownMenu>
      {header.column.getCanResize() && (
        <DataGridColumnResizer
          table={table}
          header={header}
          label={label}
          isResizing={resizingColumnId === column.id}
          isBeforePinned={getIsBeforePinned(header)}
        />
      )}
    </>
  );
}

interface DataGridColumnMenuItemsProps<TData extends RowData, TValue> {
  column: Column<DataGridFeatures, TData, TValue>;
}

function DataGridColumnMenuItems<TData extends RowData, TValue>({
  column,
}: DataGridColumnMenuItemsProps<TData, TValue>) {
  const { table } = column;
  const canSort = column.getCanSort();
  const canPin = column.getCanPin();
  const canOrder = column.getCanOrder();
  const sortDirection = column.getIsSorted();
  const pinnedPosition = column.getIsPinned();

  const isRtl = table.options.dir === "rtl";
  const leftStep = isRtl ? 1 : -1;
  const leftPosition = isRtl ? "end" : "start";
  const rightPosition = isRtl ? "start" : "end";

  function onSortingChange(direction: SortDirection) {
    table.setSorting((prev) => {
      const existingSortIndex = prev.findIndex((sort) => sort.id === column.id);
      const newSort: ColumnSort = {
        id: column.id,
        desc: direction === "desc",
      };

      if (existingSortIndex === -1) return [...prev, newSort];
      const updated = [...prev];
      updated[existingSortIndex] = newSort;
      return updated;
    });
  }

  return (
    <>
      {canSort && (
        <DropdownMenuGroup>
          <DropdownMenuCheckboxItem
            className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
            checked={sortDirection === "asc"}
            onClick={() => onSortingChange("asc")}
          >
            <IconPlaceholder
              lucide="ChevronUpIcon"
              tabler="IconChevronUp"
              hugeicons="ArrowUp01Icon"
              phosphor="CaretUpIcon"
              remixicon="RiArrowUpSLine"
            />
            Sort ascending
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
            checked={sortDirection === "desc"}
            onClick={() => onSortingChange("desc")}
          >
            <IconPlaceholder
              lucide="ChevronDownIcon"
              tabler="IconChevronDown"
              hugeicons="ArrowDown01Icon"
              phosphor="CaretDownIcon"
              remixicon="RiArrowDownSLine"
            />
            Sort descending
          </DropdownMenuCheckboxItem>
          {sortDirection && (
            <DropdownMenuItem
              className="[&_svg]:text-muted-foreground"
              onClick={() => column.clearSorting()}
            >
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
        </DropdownMenuGroup>
      )}
      {canPin && (
        <>
          {canSort && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            {(
              [
                ["left", leftPosition],
                ["right", rightPosition],
              ] as const
            ).map(([side, position]) => {
              const isPinned = pinnedPosition === position;

              return (
                <DropdownMenuItem
                  key={side}
                  className="[&_svg]:text-muted-foreground"
                  onClick={() => column.pin(isPinned ? false : position)}
                >
                  {isPinned ? (
                    <IconPlaceholder
                      lucide="PinOffIcon"
                      tabler="IconPinnedOff"
                      hugeicons="BookmarkIcon"
                      phosphor="PushPinSlashIcon"
                      remixicon="RiUnpinLine"
                    />
                  ) : (
                    <IconPlaceholder
                      lucide="PinIcon"
                      tabler="IconPin"
                      hugeicons="BookmarkIcon"
                      phosphor="PushPinIcon"
                      remixicon="RiPushpinLine"
                    />
                  )}
                  {isPinned ? `Unpin from ${side}` : `Pin to ${side}`}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </>
      )}
      {canOrder && (
        <>
          {(canSort || canPin) && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="[&_svg]:text-muted-foreground"
              disabled={!column.getCanMove(leftStep)}
              onClick={() => column.move(leftStep)}
            >
              <IconPlaceholder
                lucide="ArrowLeftIcon"
                tabler="IconArrowLeft"
                hugeicons="ArrowLeft02Icon"
                phosphor="ArrowLeftIcon"
                remixicon="RiArrowLeftLine"
              />
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              className="[&_svg]:text-muted-foreground"
              disabled={!column.getCanMove(-leftStep)}
              onClick={() => column.move(-leftStep)}
            >
              <IconPlaceholder
                lucide="ArrowRightIcon"
                tabler="IconArrowRight"
                hugeicons="ArrowRight02Icon"
                phosphor="ArrowRightIcon"
                remixicon="RiArrowRightLine"
              />
              Move right
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </>
      )}
      {column.getCanHide() && (
        <>
          {(canSort || canPin || canOrder) && <DropdownMenuSeparator />}
          <DropdownMenuItem
            className="[&_svg]:text-muted-foreground"
            onClick={() => column.toggleVisibility(false)}
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
    </>
  );
}

interface DataGridColumnResizerProps<
  TData extends RowData,
  TValue,
> extends DataGridColumnHeaderProps<TData, TValue> {
  label: string;
  isResizing: boolean;
  isBeforePinned: boolean;
}

const DataGridColumnResizer = React.memo(
  DataGridColumnResizerImpl,
  (prev, next) =>
    prev.isResizing === next.isResizing &&
    prev.isBeforePinned === next.isBeforePinned &&
    prev.label === next.label,
) as typeof DataGridColumnResizerImpl;

function DataGridColumnResizerImpl<TData extends RowData, TValue>({
  table,
  header,
  label,
  isResizing,
  isBeforePinned,
}: DataGridColumnResizerProps<TData, TValue>) {
  const defaultColumnDef = table.getDefaultColumnDef();
  const minSize =
    header.column.columnDef.minSize ?? defaultColumnDef.minSize ?? 0;
  const maxSize =
    header.column.columnDef.maxSize ??
    defaultColumnDef.maxSize ??
    Number.POSITIVE_INFINITY;

  const onResizeStart = React.useCallback(
    (
      event:
        | React.MouseEvent<HTMLDivElement>
        | React.TouchEvent<HTMLDivElement>,
    ) => {
      if (event.type === "mousedown") event.preventDefault();
      if (table.getEditingCell()) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        table.stopEditing();
      }
      header.getResizeHandler()(event);
    },
    [header, table],
  );

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
        "absolute top-0 h-full w-0.5 cursor-ew-resize touch-none bg-border transition-opacity select-none after:absolute after:inset-y-0 after:content-[''] hover:bg-primary focus:bg-primary focus:outline-none",
        isBeforePinned
          ? "inset-e-0 after:-inset-s-4 after:inset-e-0"
          : "-inset-e-px after:-inset-x-2",
        isResizing ? "z-30 bg-primary" : "z-10 opacity-0 hover:opacity-100",
      )}
      onMouseDown={onResizeStart}
      onTouchStart={onResizeStart}
      onDoubleClick={onDoubleClick}
    />
  );
}

function getBadgeColumnContentSize<TData extends RowData, TValue>(
  column: Column<DataGridFeatures, TData, TValue>,
  table: Table<DataGridFeatures, TData>,
): number {
  const meta = column.columnDef.meta;
  if (meta?.variant !== "multi-select" && meta?.variant !== "file") {
    return 0;
  }

  const labelByValue = new Map(
    meta.variant === "multi-select"
      ? meta.options.map((option) => [option.value, option.label])
      : [],
  );

  let contentSize = 0;
  for (const row of table.getRowModel().rows) {
    const value = row.getValue(column.id);
    if (!Array.isArray(value)) continue;

    const rowContentSize =
      meta.variant === "multi-select"
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

function getIsBeforePinned<TData extends RowData, TValue>(
  header: Header<DataGridFeatures, TData, TValue>,
) {
  const headers = header.headerGroup?.headers ?? [];
  const index = headers.findIndex((item) => item.id === header.id);
  return !!headers[index + 1]?.column.getIsPinned();
}
