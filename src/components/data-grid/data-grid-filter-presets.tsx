"use client";

import type { Table } from "@tanstack/react-table";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterPreset<TData> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  filters?: { id: keyof TData & string; value: unknown }[];
  columnVisibility?: Partial<Record<keyof TData & string, boolean>>;
  sorting?: { id: keyof TData & string; desc: boolean }[];
  className?: string;
  activeClassName?: string;
}

interface DataGridFilterPresetsProps<TData>
  extends React.ComponentProps<"div"> {
  table: Table<TData>;
  presets: FilterPreset<TData>[];
  onPresetChange?: (presetId: string | null) => void;
}

export function DataGridFilterPresets<TData>({
  table,
  presets,
  onPresetChange,
  className,
  ...props
}: DataGridFilterPresetsProps<TData>) {
  const [activePreset, setActivePreset] = React.useState<string | null>(null);

  const applyPreset = React.useCallback(
    (preset: FilterPreset<TData>) => {
      // Apply filters
      table.setColumnFilters(preset.filters ?? []);

      // Apply column visibility
      table.setColumnVisibility(
        (preset.columnVisibility as Record<string, boolean>) ?? {},
      );

      // Apply sorting
      table.setSorting(preset.sorting ?? []);

      setActivePreset(preset.id);
      onPresetChange?.(preset.id);
    },
    [table, onPresetChange],
  );

  const clearPreset = React.useCallback(() => {
    table.setColumnFilters([]);
    table.setColumnVisibility({});
    table.setSorting([]);
    setActivePreset(null);
    onPresetChange?.(null);
  }, [table, onPresetChange]);

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {presets.map((preset) => (
        <Button
          key={preset.id}
          variant={activePreset === preset.id ? "default" : "outline"}
          size="sm"
          onClick={() => applyPreset(preset)}
          className={cn(
            "gap-2",
            activePreset === preset.id
              ? cn("ring-2 ring-offset-2", preset.activeClassName)
              : preset.className,
          )}
        >
          {preset.icon}
          {preset.label}
        </Button>
      ))}
      {activePreset && (
        <Button variant="ghost" size="sm" onClick={clearPreset}>
          Clear
        </Button>
      )}
    </div>
  );
}
