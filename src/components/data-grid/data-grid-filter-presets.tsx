"use client";

import type { Table } from "@tanstack/react-table";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn, deepEqual } from "@/lib/utils";

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

function matchesPreset<TData>(
  table: Table<TData>,
  preset: FilterPreset<TData>,
): boolean {
  const currentFilters = table.getState().columnFilters;
  const currentVisibility = table.getState().columnVisibility;
  const currentSorting = table.getState().sorting;

  const presetFilters = preset.filters ?? [];
  const presetVisibility = preset.columnVisibility ?? {};
  const presetSorting = preset.sorting ?? [];

  return (
    deepEqual(currentFilters, presetFilters) &&
    deepEqual(currentVisibility, presetVisibility) &&
    deepEqual(currentSorting, presetSorting)
  );
}

export function DataGridFilterPresets<TData>({
  table,
  presets,
  onPresetChange,
  className,
  ...props
}: DataGridFilterPresetsProps<TData>) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: subscribe to table state changes
  const activePreset = React.useMemo(() => {
    for (const preset of presets) {
      if (matchesPreset(table, preset)) {
        return preset.id;
      }
    }
    return null;
  }, [
    table,
    presets,
    table.getState().columnFilters,
    table.getState().columnVisibility,
    table.getState().sorting,
  ]);

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

      onPresetChange?.(preset.id);
    },
    [table, onPresetChange],
  );

  const clearPreset = React.useCallback(() => {
    table.setColumnFilters([]);
    table.setColumnVisibility({});
    table.setSorting([]);
    onPresetChange?.(null);
  }, [table, onPresetChange]);

  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {presets.map((preset) => {
        const isActive = activePreset === preset.id;
        return (
          <Button
            key={preset.id}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset(preset)}
            className={cn(
              "gap-2",
              isActive
                ? cn("ring-2 ring-offset-2", preset.activeClassName)
                : preset.className,
            )}
          >
            {preset.icon}
            {preset.label}
          </Button>
        );
      })}
      {activePreset && (
        <Button variant="ghost" size="sm" onClick={clearPreset}>
          Clear
        </Button>
      )}
    </div>
  );
}
