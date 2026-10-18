import type * as React from "react";

import { Skeleton } from "@/registry/bases/radix/ui/skeleton";

// Widths of the toolbar's default triggers, so nothing shifts when the grid mounts
const TOOLBAR_ITEMS = [
  { id: "benchmark", className: "w-[119px]" },
  { id: "direction", className: "w-[65px]" },
  { id: "filter", className: "w-[78px]" },
  { id: "sort", className: "w-[72px]" },
  { id: "row-height", className: "w-[77px]" },
  { id: "view", className: "hidden w-[76px] lg:block" },
] as const;

interface DataGridDemoSkeletonProps {
  rowCountSelect?: React.ReactNode;
}

export function DataGridDemoSkeleton({
  rowCountSelect,
}: DataGridDemoSkeletonProps) {
  return (
    <div className="container flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between gap-2">
        {rowCountSelect ?? (
          <Skeleton className="h-8 w-[99px] shrink-0 rounded-lg" />
        )}
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className="flex items-center gap-2"
        >
          {TOOLBAR_ITEMS.map((item) => (
            <Skeleton
              key={item.id}
              className={`h-8 shrink-0 rounded-lg ${item.className}`}
            />
          ))}
        </div>
      </div>
      {/* Matches the grid's height, which follows the window height */}
      <Skeleton className="h-[max(400px,calc(100dvh-150px))] w-full" />
    </div>
  );
}
