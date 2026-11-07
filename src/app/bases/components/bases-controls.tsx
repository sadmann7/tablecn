"use client";

import type * as React from "react";

import { PilcrowLeft, PilcrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";

import { FILTER_MODES } from "@/lib/flag";
import { Separator } from "@/registry/bases/radix/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/radix/ui/toggle-group";

import { BASES_VIEWS, basesSearchParams } from "../hooks/use-bases-demo";
import { type Base, BASES } from "../lib/data";

interface BasesControlsProps {
  base: Base;
}

export function BasesControls({ base }: BasesControlsProps) {
  const searchParams = useSearchParams();
  const [{ view, filterMode, dir }, setControls] = useQueryStates(
    basesSearchParams,
    {
      clearOnDefault: true,
    },
  );
  const query = searchParams.toString();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ControlGroup label="View">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="View"
          value={view}
          onValueChange={(value) => {
            const next = BASES_VIEWS.find((item) => item.value === value);
            if (next) void setControls({ view: next.value });
          }}
        >
          {BASES_VIEWS.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              className="px-2.5 text-xs"
            >
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </ControlGroup>
      <Separator
        orientation="vertical"
        className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
      />
      <ControlGroup label="Base">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Base"
          value={base}
        >
          {BASES.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={item.value}
              className="px-2.5 text-xs"
              asChild
            >
              <Link href={`/bases/${item.value}${query ? `?${query}` : ""}`}>
                {item.label}
              </Link>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </ControlGroup>
      {view === "table" ? (
        <>
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
                if (next) void setControls({ filterMode: next.value });
              }}
            >
              {FILTER_MODES.map((item) => (
                <ToggleGroupItem
                  key={item.value}
                  value={item.value}
                  className="px-2.5 text-xs"
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </ControlGroup>
        </>
      ) : null}
      <Separator
        orientation="vertical"
        className="max-sm:hidden data-vertical:h-4 data-vertical:self-center"
      />
      <ControlGroup label="Direction">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Direction"
          value={dir}
          onValueChange={(value) => {
            if (value === "ltr" || value === "rtl") {
              void setControls({ dir: value });
            }
          }}
        >
          <ToggleGroupItem value="ltr" className="px-2.5 text-xs">
            <PilcrowRight className="size-3.5" />
            LTR
          </ToggleGroupItem>
          <ToggleGroupItem value="rtl" className="px-2.5 text-xs">
            <PilcrowLeft className="size-3.5" />
            RTL
          </ToggleGroupItem>
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
