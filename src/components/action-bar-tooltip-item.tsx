"use client";

import * as React from "react";

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
  const [open, setOpen] = React.useState(false);
  const isFocusReturnRef = React.useRef(false);

  const onFocus = React.useCallback((event: React.FocusEvent) => {
    if (event.relatedTarget) return;
    isFocusReturnRef.current = true;
    queueMicrotask(() => {
      isFocusReturnRef.current = false;
    });
  }, []);

  const onOpenChange = React.useCallback((nextOpen: boolean) => {
    if (nextOpen && isFocusReturnRef.current) return;
    setOpen(nextOpen);
  }, []);

  return (
    <Tooltip open={open} onOpenChange={onOpenChange}>
      <TooltipTrigger asChild onFocus={onFocus}>
        <ActionBarItem aria-label={label} size="icon-sm" {...props}>
          {icon}
        </ActionBarItem>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
