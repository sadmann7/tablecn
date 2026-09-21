"use client";

import type {
  ColumnSort,
  Header,
  RowData,
  SortDirection,
  SortingState,
  Table,
} from "@tanstack/react-table";

import { cn } from "cn";
import * as React from "react";
import { Button as ButtonPrimitive } from "react-aria-components";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { getColumnVariant } from "@/lib/data-grid-utils";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/aria/ui/dropdown-menu";
import { Tooltip, TooltipTrigger } from "@/registry/bases/aria/ui/tooltip";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface DataGridColumnHeaderProps<TData extends RowData, TValue> extends Omit<
  React.ComponentProps<typeof ButtonPrimitive>,
  "className"
> {
  header: Header<DataGridFeatures, TData, TValue>;
  table: Table<DataGridFeatures, TData>;
  className?: string;
}

export function DataGridColumnHeader<TData extends RowData, TValue>({
  header,
  table,
  className,
  onPointerDown,
  ...props
}: DataGridColumnHeaderProps<TData, TValue>) {
  const column = header.column;
  const label = column.columnDef.meta?.label
    ? column.columnDef.meta.label
    : typeof column.columnDef.header === "string"
      ? column.columnDef.header
      : column.id;

  const isAnyColumnResizing = table.store.state.columnResizing.isResizingColumn;

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

  const onTriggerPointerDown = React.useCallback<
    NonNullable<React.ComponentProps<typeof ButtonPrimitive>["onPointerDown"]>
  >(
    (event) => {
      onPointerDown?.(event);
      if (event.defaultPrevented) return;

      if (event.button !== 0) {
        return;
      }
      table.options.meta?.onColumnClick?.(column.id);
    },
    [table.options.meta, column.id, onPointerDown],
  );

  const sorted = column.getIsSorted();

  return (
    <>
      <DropdownMenuTrigger>
        <ButtonPrimitive
          className={cn(
            "flex size-full items-center justify-between gap-2 p-2 text-sm hover:bg-accent/40 aria-expanded:bg-accent/40 [&_svg]:size-4",
            isAnyColumnResizing && "pointer-events-none",
            className,
          )}
          onPointerDown={onTriggerPointerDown}
          {...props}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {columnVariant && (
              <TooltipTrigger delay={100}>
                <columnVariant.icon className="size-3.5 shrink-0 text-muted-foreground" />
                <Tooltip placement="top">
                  <p>{columnVariant.label}</p>
                </Tooltip>
              </TooltipTrigger>
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
        </ButtonPrimitive>
        <DropdownMenu placement="bottom start" offset={0} className="w-60">
          {column.getCanSort() && (
            <DropdownMenuGroup
              selectionMode="single"
              selectedKeys={sorted ? [sorted] : []}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                const [key] = keys;
                if (key === "asc" || key === "desc") onSortingChange(key);
              }}
            >
              <DropdownMenuItem
                id="asc"
                className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
              >
                <IconPlaceholder
                  lucide="ChevronUpIcon"
                  tabler="IconChevronUp"
                  hugeicons="ArrowUp01Icon"
                  phosphor="CaretUpIcon"
                  remixicon="RiArrowUpSLine"
                />
                Sort asc
              </DropdownMenuItem>
              <DropdownMenuItem
                id="desc"
                className="relative ltr:pr-8 ltr:pl-2 rtl:pr-2 rtl:pl-8 [&_svg]:text-muted-foreground [&>span:first-child]:ltr:right-2 [&>span:first-child]:ltr:left-auto [&>span:first-child]:rtl:right-auto [&>span:first-child]:rtl:left-2"
              >
                <IconPlaceholder
                  lucide="ChevronDownIcon"
                  tabler="IconChevronDown"
                  hugeicons="ArrowDown01Icon"
                  phosphor="CaretDownIcon"
                  remixicon="RiArrowDownSLine"
                />
                Sort desc
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {column.getCanSort() && sorted && (
            <DropdownMenuItem onAction={onSortRemove}>
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
          {column.getCanPin() && (
            <>
              {column.getCanSort() && <DropdownMenuSeparator />}

              {isPinnedLeft ? (
                <DropdownMenuItem
                  className="[&_svg]:text-muted-foreground"
                  onAction={onUnpin}
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
                  onAction={onLeftPin}
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
                  onAction={onUnpin}
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
                  onAction={onRightPin}
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
                onAction={() => column.toggleVisibility(false)}
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
        </DropdownMenu>
      </DropdownMenuTrigger>
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

  const onDoubleClick = React.useCallback(() => {
    header.column.resetSize();
  }, [header.column]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={header.column.getSize()}
      aria-valuemin={defaultColumnDef.minSize}
      aria-valuemax={defaultColumnDef.maxSize}
      tabIndex={0}
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
