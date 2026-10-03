"use client";

import type {
  MenuItemProps,
  MenuProps,
  Selection,
} from "react-aria-components";

import { cn } from "cn";
import * as React from "react";

import { Badge } from "@/registry/bases/aria/ui/badge";
import { Button } from "@/registry/bases/aria/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/registry/bases/aria/ui/command";
import { Popover, PopoverTrigger } from "@/registry/bases/aria/ui/popover";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

type FacetedValue<Multiple extends boolean> = Multiple extends true
  ? string[]
  : string;

interface FacetedContextValue<Multiple extends boolean = boolean> {
  value?: FacetedValue<Multiple>;
  onSelectionChange?: (keys: Selection) => void;
  multiple?: Multiple;
}

const FacetedContext = React.createContext<FacetedContextValue | null>(null);

function useFacetedContext(name: string) {
  const context = React.useContext(FacetedContext);
  if (!context) {
    throw new Error(`\`${name}\` must be within Faceted`);
  }
  return context;
}

interface FacetedProps<Multiple extends boolean = false> extends Omit<
  React.ComponentProps<typeof PopoverTrigger>,
  "children" | "isOpen" | "onOpenChange"
> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  value?: FacetedValue<Multiple>;
  onValueChange?: (value: FacetedValue<Multiple> | undefined) => void;
  children?: React.ReactNode;
  multiple?: Multiple;
}

function Faceted<Multiple extends boolean = false>(
  props: FacetedProps<Multiple>,
) {
  const {
    open: openProp,
    onOpenChange: onOpenChangeProp,
    value,
    onValueChange,
    children,
    multiple = false,
    ...facetedProps
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const onOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen);
      }
      onOpenChangeProp?.(newOpen);
    },
    [isControlled, onOpenChangeProp],
  );

  const onSelectionChange = React.useCallback(
    (keys: Selection) => {
      if (!onValueChange || keys === "all") return;

      const selectedValues = [...keys].map(String);

      if (multiple) {
        onValueChange(selectedValues as FacetedValue<Multiple>);
      } else {
        onValueChange(selectedValues[0] as FacetedValue<Multiple> | undefined);

        requestAnimationFrame(() => onOpenChange(false));
      }
    },
    [multiple, onValueChange, onOpenChange],
  );

  const contextValue = React.useMemo<FacetedContextValue<typeof multiple>>(
    () => ({ value, onSelectionChange, multiple }),
    [value, onSelectionChange, multiple],
  );

  return (
    <FacetedContext.Provider value={contextValue}>
      <PopoverTrigger
        isOpen={open}
        onOpenChange={onOpenChange}
        {...facetedProps}
      >
        {children}
      </PopoverTrigger>
    </FacetedContext.Provider>
  );
}

function FacetedTrigger(props: React.ComponentProps<typeof Button>) {
  const { className, children, ...triggerProps } = props;

  return (
    <Button
      data-slot="faceted-trigger"
      {...triggerProps}
      className={cn("justify-between text-left", className)}
    >
      {children}
    </Button>
  );
}

interface FacetedBadgeListProps extends React.ComponentProps<"div"> {
  options?: { label: string; value: string }[];
  max?: number;
  badgeClassName?: string;
  placeholder?: string;
}

function FacetedBadgeList(props: FacetedBadgeListProps) {
  const {
    options = [],
    max = 2,
    placeholder = "Select options...",
    className,
    badgeClassName,
    ...badgeListProps
  } = props;

  const context = useFacetedContext("FacetedBadgeList");
  const values = Array.isArray(context.value)
    ? context.value
    : ([context.value].filter(Boolean) as string[]);

  const getLabel = React.useCallback(
    (value: string) => {
      const option = options.find((opt) => opt.value === value);
      return option?.label ?? value;
    },
    [options],
  );

  if (!values || values.length === 0) {
    return (
      <div
        {...badgeListProps}
        className="flex w-full items-center gap-1 text-muted-foreground"
      >
        {placeholder}
        <IconPlaceholder
          lucide="ChevronsUpDown"
          tabler="IconSelector"
          hugeicons="UnfoldMoreIcon"
          phosphor="CaretUpDownIcon"
          remixicon="RiArrowUpDownLine"
          className="ml-auto size-4 shrink-0 opacity-50"
        />
      </div>
    );
  }

  return (
    <div
      {...badgeListProps}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {values.length > max ? (
        <Badge
          variant="secondary"
          className={cn("rounded-sm px-1 font-normal", badgeClassName)}
        >
          {values.length} selected
        </Badge>
      ) : (
        values.map((value) => (
          <Badge
            key={value}
            variant="secondary"
            className={cn("rounded-sm px-1 font-normal", badgeClassName)}
          >
            <span className="truncate">{getLabel(value)}</span>
          </Badge>
        ))
      )}
    </div>
  );
}

interface FacetedContentProps extends Omit<
  React.ComponentProps<typeof Popover>,
  "children"
> {
  children?: React.ReactNode;
}

function FacetedContent(props: FacetedContentProps) {
  const { className, children, ...contentProps } = props;

  return (
    <Popover
      data-slot="faceted-content"
      {...contentProps}
      placement="bottom start"
      className={cn("w-50 p-0", className)}
    >
      <Command>{children}</Command>
    </Popover>
  );
}

const FacetedInput = CommandInput;

function FacetedList<T extends object>(props: MenuProps<T>) {
  const context = useFacetedContext("FacetedList");

  const selectedKeys = Array.isArray(context.value)
    ? context.value
    : ([context.value].filter(Boolean) as string[]);

  return (
    <CommandList
      selectionMode={context.multiple ? "multiple" : "single"}
      selectedKeys={selectedKeys}
      onSelectionChange={context.onSelectionChange}
      escapeKeyBehavior="none"
      {...props}
    />
  );
}

const FacetedEmpty = CommandEmpty;

const FacetedGroup = CommandGroup;

interface FacetedItemProps<T extends object> extends Omit<
  MenuItemProps<T>,
  "children" | "id" | "value"
> {
  value: string;
  children?: React.ReactNode;
}

function FacetedItem<T extends object>(props: FacetedItemProps<T>) {
  const { value, textValue, className, children, ...itemProps } = props;
  const context = useFacetedContext("FacetedItem");

  const isSelected = context.multiple
    ? Array.isArray(context.value) && context.value.includes(value)
    : context.value === value;

  return (
    <CommandItem
      id={value}
      textValue={textValue ?? value}
      className={cn(
        "gap-2 data-selected:not-data-focused:bg-transparent",
        className,
      )}
      {...itemProps}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-sm border border-primary",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "opacity-50 [&_svg]:invisible",
        )}
      >
        <IconPlaceholder
          lucide="Check"
          tabler="IconCheck"
          hugeicons="Tick02Icon"
          phosphor="CheckIcon"
          remixicon="RiCheckLine"
          className="size-4"
        />
      </span>
      {children}
    </CommandItem>
  );
}

const FacetedSeparator = CommandSeparator;

export {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
};
