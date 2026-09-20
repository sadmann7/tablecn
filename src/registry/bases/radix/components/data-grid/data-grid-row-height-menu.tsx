"use client";

import type { RowData, Table } from "@tanstack/react-table";

import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/radix/ui/select";
import { IconPlaceholder } from "@/registry/icon-placeholder";

const rowHeights = [
  {
    label: "Short",
    value: "short" as const,
    icon: (props: React.ComponentProps<"svg">) => (
      <IconPlaceholder
        lucide="MinusIcon"
        tabler="IconMinus"
        hugeicons="MinusSignIcon"
        phosphor="MinusIcon"
        remixicon="RiSubtractLine"
        {...props}
      />
    ),
  },
  {
    label: "Medium",
    value: "medium" as const,
    icon: (props: React.ComponentProps<"svg">) => (
      <IconPlaceholder
        lucide="EqualIcon"
        tabler="IconMinus"
        hugeicons="MinusSignIcon"
        phosphor="MinusIcon"
        remixicon="RiSubtractLine"
        {...props}
      />
    ),
  },
  {
    label: "Tall",
    value: "tall" as const,
    icon: (props: React.ComponentProps<"svg">) => (
      <IconPlaceholder
        lucide="AlignVerticalSpaceAroundIcon"
        tabler="IconLayoutRows"
        hugeicons="LayoutIcon"
        phosphor="RowsIcon"
        remixicon="RiLayoutLine"
        {...props}
      />
    ),
  },
  {
    label: "Extra Tall",
    value: "extra-tall" as const,
    icon: (props: React.ComponentProps<"svg">) => (
      <IconPlaceholder
        lucide="ChevronsDownUpIcon"
        tabler="IconSelector"
        hugeicons="UnfoldMoreIcon"
        phosphor="ArrowsVerticalIcon"
        remixicon="RiArrowUpDownLine"
        {...props}
      />
    ),
  },
] as const;

interface DataGridRowHeightMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof SelectContent> {
  table: Table<DataGridFeatures, TData>;
  disabled?: boolean;
}

export function DataGridRowHeightMenu<TData extends RowData>({
  table,
  disabled,
  ...props
}: DataGridRowHeightMenuProps<TData>) {
  const rowHeight = table.options.meta?.rowHeight;
  const onRowHeightChange = table.options.meta?.onRowHeightChange;

  const selectedRowHeight = React.useMemo(() => {
    return (
      rowHeights.find((opt) => opt.value === rowHeight) ?? {
        label: "Short",
        value: "short" as const,
        icon: (props: React.ComponentProps<"svg">) => (
          <IconPlaceholder
            lucide="MinusIcon"
            tabler="IconMinus"
            hugeicons="MinusSignIcon"
            phosphor="MinusIcon"
            remixicon="RiSubtractLine"
            {...props}
          />
        ),
      }
    );
  }, [rowHeight]);

  return (
    <Select
      value={rowHeight}
      onValueChange={onRowHeightChange}
      disabled={disabled}
    >
      <SelectTrigger className="[&_svg:nth-child(2)]:hidden">
        <SelectValue placeholder="Row height">
          <selectedRowHeight.icon />
          {selectedRowHeight.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...props}>
        <SelectGroup>
          {rowHeights.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <option.icon />
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
