"use client";

import type * as React from "react";

import { parseAsStringEnum, useQueryState } from "nuqs";

import { type Flag, filterFlags, tableModes } from "@/lib/flag";
import { Separator } from "@/registry/bases/radix/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/radix/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/radix/ui/tooltip";

export function TasksTableControls() {
  const [mode, setMode] = useQueryState(
    "tableMode",
    parseAsStringEnum(tableModes.map((mode) => mode.value))
      .withDefault("server")
      .withOptions({ shallow: false, clearOnDefault: true }),
  );
  const [filterFlag, setFilterFlag] = useQueryState(
    "filterFlag",
    parseAsStringEnum(filterFlags.map((flag) => flag.value))
      .withDefault("simple")
      .withOptions({ shallow: false, clearOnDefault: true }),
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ControlGroup label="Data">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Data mode"
          value={mode}
          onValueChange={(value) => {
            const next = tableModes.find((mode) => mode.value === value);
            if (next) void setMode(next.value);
          }}
        >
          {tableModes.map((mode) => (
            <ControlItem key={mode.value} flag={mode} />
          ))}
        </ToggleGroup>
      </ControlGroup>
      <Separator
        orientation="vertical"
        className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
      />
      <ControlGroup label="Filters">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Filter variant"
          value={filterFlag}
          onValueChange={(value) => {
            const flag = filterFlags.find((item) => item.value === value);
            if (flag) void setFilterFlag(flag.value);
          }}
        >
          {filterFlags.map((flag) => (
            <ControlItem key={flag.value} flag={flag} />
          ))}
        </ToggleGroup>
      </ControlGroup>
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
