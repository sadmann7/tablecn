"use client";

import type * as React from "react";

import {
  type ReactTable,
  type RowData,
  Subscribe,
} from "@tanstack/react-table";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { RowHeightValue } from "@/lib/data-grid-types";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

interface RowHeightOption {
  label: string;
  value: RowHeightValue;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
}

const rowHeights = [
  {
    label: "Short",
    value: "short",
    icon: (props) => (
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
    value: "medium",
    icon: (props) => (
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
    value: "tall",
    icon: (props) => (
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
    value: "extra-tall",
    icon: (props) => (
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
] as const satisfies ReadonlyArray<RowHeightOption>;

interface DataGridRowHeightMenuProps<
  TData extends RowData,
> extends React.ComponentProps<typeof SelectContent> {
  table: ReactTable<DataGridFeatures, TData, unknown>;
  disabled?: boolean;
}

export function DataGridRowHeightMenu<TData extends RowData>({
  table,
  disabled,
  ...props
}: DataGridRowHeightMenuProps<TData>) {
  return (
    <Subscribe source={table.atoms.rowHeight}>
      {(rowHeight) => {
        const selectedRowHeight =
          rowHeights.find((option) => option.value === rowHeight) ??
          rowHeights[0];

        return (
          <Select
            value={rowHeight}
            onValueChange={(value: RowHeightValue | null) => {
              if (value == null) return;
              table.setRowHeight(value);
            }}
            disabled={disabled}
          >
            <SelectTrigger
              aria-label="Row height"
              className="[&_svg:nth-child(2)]:hidden"
            >
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
      }}
    </Subscribe>
  );
}
