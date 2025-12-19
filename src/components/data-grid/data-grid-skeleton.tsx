import type * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DivProps extends React.ComponentProps<"div"> {}

function DataGridSkeleton({ className, ...props }: DivProps) {
  return (
    <div
      data-slot="grid-skeleton"
      className={cn(
        "flex h-[calc(100dvh-(--spacing(16)))] w-full flex-col gap-4 has-[>[data-slot=grid-skeleton-toolbar]]:h-[calc(100dvh-(--spacing(20)))]",
        className,
      )}
      {...props}
    />
  );
}

interface DataGridSkeletonToolbarProps extends DivProps {
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
      data-slot="grid-skeleton-toolbar"
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
        <Skeleton key={i} className="h-7 w-20 shrink-0" />
      ))}
    </div>
  );
}

function DataGridSkeletonGrid({ className, ...props }: DivProps) {
  return (
    <Skeleton
      data-slot="grid-skeleton-grid"
      className={cn("flex-1", className)}
      {...props}
    />
  );
}

export { DataGridSkeleton, DataGridSkeletonGrid, DataGridSkeletonToolbar };
