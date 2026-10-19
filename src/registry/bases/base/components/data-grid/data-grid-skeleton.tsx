import type * as React from "react";

import { cn } from "cn";

import { Skeleton } from "@/registry/bases/base/ui/skeleton";

function DataGridSkeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-grid-skeleton"
      className={cn(
        "flex h-[calc(100dvh-(--spacing(16)))] w-full flex-col gap-4 has-[>[data-slot=data-grid-skeleton-toolbar]]:h-[calc(100dvh-(--spacing(20)))]",
        className,
      )}
      {...props}
    />
  );
}

interface DataGridSkeletonToolbarProps extends React.ComponentProps<"div"> {
  align?: "start" | "center" | "end";
  actionCount?: number;
}

function DataGridSkeletonToolbar({
  align = "end",
  actionCount = 4,
  className,
  ...props
}: DataGridSkeletonToolbarProps) {
  return (
    <div
      data-slot="data-grid-skeleton-toolbar"
      className={cn(
        "flex items-center gap-2",
        {
          "justify-start": align === "start",
          "justify-center": align === "center",
          "justify-end": align === "end",
        },
        className,
      )}
      {...props}
    >
      {Array.from({ length: actionCount }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-lg" />
      ))}
    </div>
  );
}

function DataGridSkeletonGrid({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Skeleton
      data-slot="data-grid-skeleton-grid"
      className={cn("flex-1", className)}
      {...props}
    />
  );
}

export { DataGridSkeleton, DataGridSkeletonGrid, DataGridSkeletonToolbar };
