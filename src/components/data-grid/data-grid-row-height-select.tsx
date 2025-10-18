"use client";

import type { Table } from "@tanstack/react-table";
import {
  AlignVerticalSpaceAround,
  ChevronsDownUp,
  Equal,
  Minus,
} from "lucide-react";
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RowHeightValue } from "@/lib/data-grid-row-height-feature";

const rowHeights = [
  {
    label: "Short",
    value: "short" as const,
    icon: Minus,
  },
  {
    label: "Medium",
    value: "medium" as const,
    icon: Equal,
  },
  {
    label: "Tall",
    value: "tall" as const,
    icon: AlignVerticalSpaceAround,
  },
  {
    label: "Extra Tall",
    value: "extra-tall" as const,
    icon: ChevronsDownUp,
  },
] as const;

interface DataGridRowHeightSelectProps<TData> {
  table: Table<TData>;
}

export function DataGridRowHeightSelect<TData>({
  table,
}: DataGridRowHeightSelectProps<TData>) {
  const rowHeight = table.getState().rowHeight;

  const onValueChange = React.useCallback(
    (value: RowHeightValue) => {
      table.setRowHeight(value);
    },
    [table],
  );

  return (
    <Select value={rowHeight} onValueChange={onValueChange}>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Row height">
          {rowHeights.find((opt) => opt.value === rowHeight)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {rowHeights.map((option) => {
          const OptionIcon = option.icon;
          return (
            <SelectItem key={option.value} value={option.value}>
              <OptionIcon className="size-4" />
              {option.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
