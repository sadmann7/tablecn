"use client";

import { cn } from "cn";
import { Slot } from "radix-ui";
import { composeEventHandlers } from "radix-ui/internal";
import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/registry/bases/radix/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/radix/ui/popover";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

type FacetedSelectedValue<Multiple extends boolean> = Multiple extends true
  ? string[]
  : string;

interface FacetedOption {
  label: string;
  value: string;
}

const NO_ITEMS: FacetedOption[] = [];

interface FacetedStoreState {
  value: string | string[] | undefined;
  open: boolean;
}

interface FacetedStore {
  subscribe: (callback: () => void) => () => void;
  getState: () => FacetedStoreState;
  getProps: () => FacetedController;
  notify: () => void;
  setOpen: (open: boolean) => void;
  selectItem: (value: string) => void;
  clear: () => void;
}

interface FacetedController {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  value?: string | string[];
  onValueChange?: (value: string | string[] | undefined) => void;
  isControlled: boolean;
  multiple: boolean;
  items: FacetedOption[];
}

function getSelection(
  state: FacetedStoreState,
  props: FacetedController,
): string | string[] | undefined {
  return props.isControlled ? props.value : state.value;
}

function getHasSelection(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return !!value;
}

function getIsValueSelected(
  value: string | string[] | undefined,
  multiple: boolean,
  itemValue: string,
) {
  if (multiple) return Array.isArray(value) && value.includes(itemValue);
  return value === itemValue;
}

function getSelectedItems(
  value: string | string[] | undefined,
  items: FacetedOption[],
) {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values.map((itemValue) => ({
    value: itemValue,
    label: items.find((item) => item.value === itemValue)?.label ?? itemValue,
  }));
}

function getIsFacetedSelectedValue<Multiple extends boolean>(
  value: string | string[] | undefined,
  multiple: Multiple,
): value is FacetedSelectedValue<Multiple> | undefined {
  if (value === undefined) return true;
  return multiple ? Array.isArray(value) : typeof value === "string";
}

function createFacetedStore(
  propsRef: React.RefObject<FacetedController>,
  state: FacetedStoreState,
): FacetedStore {
  const listeners = new Set<() => void>();

  function commitValue(nextValue: string | string[] | undefined) {
    const props = propsRef.current;
    if (!props.isControlled && !Object.is(state.value, nextValue)) {
      state.value = nextValue;
      store.notify();
    }
    props.onValueChange?.(nextValue);
  }

  const store: FacetedStore = {
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getState: () => state,
    getProps: () => propsRef.current,
    notify: () => {
      for (const callback of listeners) {
        callback();
      }
    },
    setOpen: (open) => {
      const { open: openProp, onOpenChange } = propsRef.current;
      if (openProp === undefined && state.open !== open) {
        state.open = open;
        store.notify();
      }
      onOpenChange?.(open);
    },
    selectItem: (selectedValue) => {
      const props = propsRef.current;
      const currentValue = getSelection(state, props);

      if (props.multiple) {
        const selected = Array.isArray(currentValue) ? currentValue : [];
        commitValue(
          selected.includes(selectedValue)
            ? selected.filter((item) => item !== selectedValue)
            : [...selected, selectedValue],
        );
        return;
      }

      commitValue(currentValue === selectedValue ? undefined : selectedValue);
      store.setOpen(false);
    },
    clear: () => {
      commitValue(propsRef.current.multiple ? [] : undefined);
    },
  };

  return store;
}

function useFacetedStoreSelector<T>(
  store: FacetedStore,
  selector: (state: FacetedStoreState) => T,
): T {
  const getSnapshot = () => selector(store.getState());
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

const FacetedStoreContext = React.createContext<FacetedStore | null>(null);

function useFacetedStore(name: string) {
  const store = React.useContext(FacetedStoreContext);
  if (!store) {
    throw new Error(`\`${name}\` must be used within \`Faceted\`.`);
  }
  return store;
}

interface FacetedProps<
  Multiple extends boolean = false,
> extends React.ComponentProps<typeof Popover> {
  value?: FacetedSelectedValue<Multiple>;
  defaultValue?: FacetedSelectedValue<Multiple>;
  onValueChange?: (value: FacetedSelectedValue<Multiple> | undefined) => void;
  items?: FacetedOption[];
  multiple?: Multiple;
}

function Faceted<Multiple extends boolean = false>(
  props: FacetedProps<Multiple>,
) {
  const {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    value,
    defaultValue,
    onValueChange,
    items = NO_ITEMS,
    multiple = false as Multiple,
    ...popoverProps
  } = props;

  const controller: FacetedController = {
    open: openProp,
    onOpenChange,
    value,
    onValueChange(nextValue) {
      if (!getIsFacetedSelectedValue(nextValue, multiple)) return;
      onValueChange?.(nextValue);
    },
    isControlled: "value" in props,
    multiple,
    items,
  };
  const propsRef = React.useRef(controller);
  propsRef.current = controller;

  const storeRef = React.useRef<FacetedStore | null>(null);
  storeRef.current ??= createFacetedStore(propsRef, {
    value: defaultValue,
    open: defaultOpen,
  });
  const store = storeRef.current;
  const open = useFacetedStoreSelector(store, (state) => state.open);

  return (
    <FacetedStoreContext.Provider value={store}>
      <Popover
        data-slot="faceted"
        open={openProp ?? open}
        onOpenChange={store.setOpen}
        {...popoverProps}
      />
    </FacetedStoreContext.Provider>
  );
}

function FacetedTrigger({
  className,
  ...props
}: React.ComponentProps<typeof PopoverTrigger>) {
  return (
    <PopoverTrigger
      data-slot="faceted-trigger"
      className={cn("justify-between text-left", className)}
      {...props}
    />
  );
}

interface FacetedValueProps {
  placeholder?: React.ReactNode;
  children?: React.ReactNode | ((selected: FacetedOption[]) => React.ReactNode);
}

function FacetedValue({
  placeholder = "Select options...",
  children,
}: FacetedValueProps) {
  const store = useFacetedStore("FacetedValue");
  const value = useFacetedStoreSelector(store, (state) =>
    getSelection(state, store.getProps()),
  );
  const selected = getSelectedItems(value, store.getProps().items);

  if (typeof children === "function") return children(selected);
  if (children != null) return children;

  if (selected.length === 0) {
    return (
      <span
        data-slot="faceted-value"
        className="flex w-full items-center gap-1 text-muted-foreground"
      >
        {placeholder}
        <IconPlaceholder
          lucide="ChevronDown"
          tabler="IconChevronDown"
          hugeicons="ArrowDown01Icon"
          phosphor="CaretDownIcon"
          remixicon="RiArrowDownSLine"
          className="ml-auto size-4 shrink-0 text-muted-foreground"
        />
      </span>
    );
  }

  if (selected.length > 2) {
    return (
      <FacetedBadgeList>
        <FacetedBadge>{selected.length} selected</FacetedBadge>
      </FacetedBadgeList>
    );
  }

  return (
    <FacetedBadgeList>
      {selected.map((item) => (
        <FacetedBadge key={item.value}>
          <span className="truncate">{item.label}</span>
        </FacetedBadge>
      ))}
    </FacetedBadgeList>
  );
}

function FacetedBadgeList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="faceted-badge-list"
      className={cn("flex w-full flex-wrap items-center gap-1", className)}
      {...props}
    />
  );
}

interface FacetedBadgeProps extends React.ComponentProps<"span"> {
  asChild?: boolean;
}

function FacetedBadge({
  className,
  asChild = false,
  ...props
}: FacetedBadgeProps) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="faceted-badge"
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit max-w-full min-w-0 items-center justify-center gap-1 rounded-sm bg-input/60 px-1.5 text-xs font-medium whitespace-nowrap text-foreground [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function FacetedContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      data-slot="faceted-content"
      align="start"
      className={cn(
        "w-50 origin-(--radix-popover-content-transform-origin) p-0",
        className,
      )}
      {...props}
    >
      <Command className="p-0.5">{children}</Command>
    </PopoverContent>
  );
}

function FacetedInput({
  ref,
  ...props
}: React.ComponentProps<typeof CommandInput>) {
  return <CommandInput data-slot="faceted-input" ref={ref} {...props} />;
}

function FacetedList(props: React.ComponentProps<typeof CommandList>) {
  return <CommandList data-slot="faceted-list" {...props} />;
}

function FacetedEmpty(props: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty data-slot="faceted-empty" {...props} />;
}

function FacetedGroup(props: React.ComponentProps<typeof CommandGroup>) {
  return <CommandGroup data-slot="faceted-group" {...props} />;
}

function FacetedCommandItem({
  onPointerDownCapture,
  onMouseDown,
  ...props
}: React.ComponentProps<typeof CommandItem>) {
  return (
    <CommandItem
      onPointerDownCapture={composeEventHandlers(
        onPointerDownCapture,
        (event) => {
          // A focusable item steals the input on pointerdown.
          event.preventDefault();
        },
      )}
      onMouseDown={composeEventHandlers(onMouseDown, (event) => {
        // iOS Safari can emit a synthetic mousedown without a pointerdown.
        event.preventDefault();
      })}
      {...props}
    />
  );
}

interface FacetedItemProps extends React.ComponentProps<typeof CommandItem> {
  value: string;
}

function FacetedItem({ value, onSelect, ...props }: FacetedItemProps) {
  const store = useFacetedStore("FacetedItem");
  const isSelected = useFacetedStoreSelector(store, (state) => {
    const props = store.getProps();
    return getIsValueSelected(
      getSelection(state, props),
      props.multiple,
      value,
    );
  });

  return (
    <FacetedCommandItem
      data-slot="faceted-item"
      data-checked={isSelected || undefined}
      aria-checked={isSelected}
      onSelect={() => {
        if (onSelect) {
          onSelect(value);
          return;
        }
        store.selectItem(value);
      }}
      {...props}
    />
  );
}

function FacetedClear({
  className,
  children = "Clear",
  onSelect,
  ...props
}: React.ComponentProps<typeof CommandItem>) {
  const store = useFacetedStore("FacetedClear");
  const hasSelection = useFacetedStoreSelector(store, (state) =>
    getHasSelection(getSelection(state, store.getProps())),
  );

  if (!hasSelection) return null;

  return (
    <FacetedCommandItem
      data-slot="faceted-clear"
      className={cn(
        "justify-center text-center [&>svg:last-child]:hidden",
        className,
      )}
      onSelect={(value) => {
        onSelect?.(value);
        store.clear();
      }}
      {...props}
    >
      {children}
    </FacetedCommandItem>
  );
}

function FacetedSeparator(
  props: React.ComponentProps<typeof CommandSeparator>,
) {
  return (
    <CommandSeparator
      data-slot="faceted-separator"
      className="mx-0 my-0.5 w-full"
      {...props}
    />
  );
}

export {
  Faceted,
  FacetedBadge,
  FacetedBadgeList,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedSeparator,
  FacetedTrigger,
  FacetedValue,
};
