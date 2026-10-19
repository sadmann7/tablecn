"use client";

import type * as React from "react";

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

export function ActionBarTooltipItem({
  label,
  icon,
  ...props
}: ActionBarTooltipItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionBarItem aria-label={label} size="icon-sm" {...props}>
          {icon}
        </ActionBarItem>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
