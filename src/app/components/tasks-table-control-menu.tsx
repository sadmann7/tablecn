"use client";

import type * as React from "react";

import { parseAsStringEnum, useQueryState } from "nuqs";

import { DATA_MODES, FILTER_MODES, type Flag } from "@/lib/flag";
import { Separator } from "@/registry/bases/radix/ui/separator";
import { Skeleton } from "@/registry/bases/radix/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/radix/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/radix/ui/tooltip";

function TasksTableControlMenu() {
  const [dataMode, setDataMode] = useQueryState(
    "dataMode",
    parseAsStringEnum(DATA_MODES.map((dataMode) => dataMode.value))
      .withDefault("server")
      .withOptions({ shallow: false, clearOnDefault: true }),
  );
  const [filterMode, setFilterMode] = useQueryState(
    "filterMode",
    parseAsStringEnum(FILTER_MODES.map((filterMode) => filterMode.value))
      .withDefault("plain")
      .withOptions({ shallow: false, clearOnDefault: true }),
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ControlGroup label="Mode">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Mode"
          value={dataMode}
          onValueChange={(value) => {
            const next = DATA_MODES.find((item) => item.value === value);
            if (next) void setDataMode(next.value);
          }}
        >
          {DATA_MODES.map((dataMode) => (
            <ControlItem key={dataMode.value} flag={dataMode} />
          ))}
        </ToggleGroup>
      </ControlGroup>
      <Separator
        orientation="vertical"
        className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
      />
      <ControlGroup label="Filter">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Filter"
          value={filterMode}
          onValueChange={(value) => {
            const next = FILTER_MODES.find((item) => item.value === value);
            if (next) void setFilterMode(next.value);
          }}
        >
          {FILTER_MODES.map((filterMode) => (
            <ControlItem key={filterMode.value} flag={filterMode} />
          ))}
        </ToggleGroup>
      </ControlGroup>
    </div>
  );
}

function FlagGroupSkeleton({ flags }: { flags: readonly Flag[] }) {
  return (
    <div className="relative flex h-7 items-center">
      {flags.map((flag) => (
        <div
          key={flag.value}
          className="flex items-center gap-1 px-2 text-[0.8rem]"
        >
          <span className="invisible size-3.5 shrink-0" />
          <span className="invisible">{flag.label}</span>
        </div>
      ))}
      <Skeleton className="absolute inset-0 rounded-[min(var(--radius-md),10px)]" />
    </div>
  );
}

interface ControlGroupProps {
  label: string;
  children: React.ReactNode;
}

function ControlGroup({ label, children }: ControlGroupProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

interface ControlItemProps {
  flag: Flag;
}

function ControlItem({ flag }: ControlItemProps) {
  const Icon = flag.icon;

  return (
    <Tooltip delayDuration={700}>
      <ToggleGroupItem value={flag.value} className="px-2.5 text-xs" asChild>
        <TooltipTrigger>
          <Icon className="size-3.5" />
          {flag.label}
        </TooltipTrigger>
      </ToggleGroupItem>
      <TooltipContent side="bottom" sideOffset={6}>
        {flag.description}
      </TooltipContent>
    </Tooltip>
  );
}

function TasksTableControlMenuSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ControlGroup label="Mode">
        <FlagGroupSkeleton flags={DATA_MODES} />
      </ControlGroup>
      <Separator
        orientation="vertical"
        className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
      />
      <ControlGroup label="Filter">
        <FlagGroupSkeleton flags={FILTER_MODES} />
      </ControlGroup>
    </div>
  );
}

export { TasksTableControlMenu, TasksTableControlMenuSkeleton };
