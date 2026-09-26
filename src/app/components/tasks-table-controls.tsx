"use client";

import type * as React from "react";

import { ListFilterIcon } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";

import { tableModes } from "@/app/lib/table-mode";
import { flagConfig } from "@/config/flag";
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

import { useFilterFlag } from "./feature-flags-provider";

export function TasksTableControls() {
  const [mode, setMode] = useQueryState(
    "tableMode",
    parseAsStringEnum([...tableModes])
      .withDefault("server")
      .withOptions({ shallow: false, clearOnDefault: true }),
  );
  const [filterFlag, setFilterFlag] = useFilterFlag();

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
            if (value === "server" || value === "client") void setMode(value);
          }}
        >
          <ControlItem
            value="server"
            label="Server"
            description="Paginate, sort, and filter in the database."
          />
          <ControlItem
            value="client"
            label="Client"
            description="Load all rows once, then paginate, sort, and filter in the browser."
          />
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
          value={filterFlag ?? "simple"}
          onValueChange={(value) => {
            if (!value) return;
            const flag = flagConfig.featureFlags.find(
              (item) => item.value === value,
            );
            void setFilterFlag(flag?.value ?? null);
          }}
        >
          <ControlItem
            value="simple"
            icon={ListFilterIcon}
            label="Simple"
            description="Faceted filters inline with the toolbar."
          />
          {flagConfig.featureFlags.map((flag) => (
            <ControlItem
              key={flag.value}
              value={flag.value}
              icon={flag.icon}
              label={flag.label.replace(/ filters$/, "")}
              description={flag.tooltipDescription}
            />
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
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

function ControlItem({
  value,
  icon: Icon,
  label,
  description,
}: ControlItemProps) {
  return (
    <Tooltip delayDuration={700}>
      <ToggleGroupItem value={value} className="px-2.5 text-xs" asChild>
        <TooltipTrigger>
          {Icon && <Icon className="size-3.5" />}
          {label}
        </TooltipTrigger>
      </ToggleGroupItem>
      <TooltipContent side="bottom" sideOffset={6}>
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
