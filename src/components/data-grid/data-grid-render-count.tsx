"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DataGridRenderCountProps extends React.ComponentProps<"div"> {
  label?: string;
}

export function DataGridRenderCount({
  label = "Grid",
  className,
  ...props
}: DataGridRenderCountProps) {
  const [mounted, setMounted] = React.useState(false);
  const renderCount = React.useRef(0);

  renderCount.current += 1;

  React.useLayoutEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50 rounded-md border bg-background/95 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur supports-backdrop-filter:bg-background/60",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{label} Renders:</span>
          <span className="font-semibold tabular-nums">
            {renderCount.current}
          </span>
        </div>
      </div>
    </div>
  );
}
