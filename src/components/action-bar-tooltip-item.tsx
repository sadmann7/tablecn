"use client";

import type * as React from "react";

import { cn } from "cn";

import { ActionBarItem } from "@/registry/bases/radix/ui/action-bar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/radix/ui/tooltip";

interface ActionBarTooltipItemProps extends React.ComponentProps<
  typeof ActionBarItem
> {
  label: string;
  icon: React.ReactNode;
}

// Collapses to its icon on small screens, where the label moves into a tooltip
export function ActionBarTooltipItem({
  label,
  icon,
  className,
  ...props
}: ActionBarTooltipItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionBarItem
          aria-label={label}
          className={cn("max-sm:px-2", className)}
          {...props}
        >
          {icon}
          <span className="max-sm:hidden">{label}</span>
        </ActionBarItem>
      </TooltipTrigger>
      <TooltipContent className="sm:hidden">{label}</TooltipContent>
    </Tooltip>
  );
}
