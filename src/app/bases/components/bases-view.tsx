"use client";

import type * as React from "react";

import { useQueryStates } from "nuqs";

import { basesSearchParams } from "../lib/search-params";

interface BasesViewProps {
  table: React.ReactNode;
  grid: React.ReactNode;
}

export function BasesView({ table, grid }: BasesViewProps) {
  const [{ view }] = useQueryStates(basesSearchParams);

  if (view === "table") return table;

  return (
    grid ?? (
      <div className="flex h-[560px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        The data grid is not available on this base yet.
      </div>
    )
  );
}
