"use client";

import type { Table } from "@tanstack/react-table";
import {
  AlignVerticalSpaceAround,
  ChevronsDownUp,
  Equal,
  Minus,
} from "lucide-react";
import type * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface DataGridRowHeightSelectProps<TData>
  extends React.ComponentProps<typeof SelectContent> {
  table: Table<TData>;
}

export function DataGridRowHeightSelect<TData>({
  table,
  ...props
}: DataGridRowHeightSelectProps<TData>) {
  const rowHeight = table.options.meta?.rowHeight;
  const onRowHeightChange = table.options.meta?.onRowHeightChange;

  return (
    <Select value={rowHeight} onValueChange={onRowHeightChange}>
      <SelectTrigger size="sm">
        <SelectValue placeholder="Row height">
          {rowHeights.find((opt) => opt.value === rowHeight)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...props}>
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
