"use client";

import { Command as CommandPrimitive } from "cmdk";
import { cn } from "cn";
import { Slot } from "radix-ui";
import { composeEventHandlers } from "radix-ui/internal";
import * as React from "react";

import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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

function getIsValueSelected(
  value: string | string[] | undefined,
  multiple: boolean,
  itemValue: string,
) {
  if (multiple) return Array.isArray(value) && value.includes(itemValue);
  return value === itemValue;
}

const labelsCache = new WeakMap<FacetedOption[], Map<string, string>>();

function getLabels(items: FacetedOption[]) {
  let labels = labelsCache.get(items);
  if (!labels) {
    labels = new Map(items.map((item) => [item.value, item.label]));
    labelsCache.set(items, labels);
  }
  return labels;
}

function getSelectedValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function getSelectedItems(
  values: string[],
  items: FacetedOption[],
): FacetedOption[] {
  const labels = getLabels(items);

  return values.map((value) => ({
    label: labels.get(value) ?? value,
    value,
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

function Faceted<Multiple extends boolean = false>({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  value,
  defaultValue,
  onValueChange,
  items = NO_ITEMS,
  multiple = false as Multiple,
  ...props
}: FacetedProps<Multiple>) {
  const controller: FacetedController = {
    open: openProp,
    onOpenChange,
    value,
    onValueChange(nextValue) {
      if (!getIsFacetedSelectedValue(nextValue, multiple)) return;
      onValueChange?.(nextValue);
    },
    isControlled: value !== undefined,
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

  useIsomorphicLayoutEffect(() => {
    if (value !== undefined) store.notify();
  }, [store, value]);

  return (
    <FacetedStoreContext.Provider value={store}>
      <Popover
        data-slot="faceted"
        open={openProp ?? open}
        onOpenChange={store.setOpen}
        {...props}
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
      className={cn(
        "justify-between text-left has-[>[data-slot=faceted-value]]:transition-[color,background-color,border-color,box-shadow] has-[>[data-slot=faceted-value]>[data-slot=faceted-badge-list]]:ps-1",
        className,
      )}
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
  const { items, multiple } = store.getProps();
  const values = getSelectedValues(value);

  if (typeof children === "function") {
    return children(getSelectedItems(values, items));
  }
  if (children != null) return children;

  const selected =
    multiple && values.length > 2 ? [] : getSelectedItems(values, items);
  const [item] = selected;

  return (
    <span
      data-slot="faceted-value"
      className={cn(
        "flex w-full min-w-0 items-center gap-1",
        values.length === 0 && "text-muted-foreground",
      )}
    >
      {multiple && values.length > 0 ? (
        <FacetedBadgeList>
          {values.length > 2 ? (
            <FacetedBadge>{values.length} selected</FacetedBadge>
          ) : (
            selected.map((selectedItem) => (
              <FacetedBadge key={selectedItem.value}>
                <span className="truncate">{selectedItem.label}</span>
              </FacetedBadge>
            ))
          )}
        </FacetedBadgeList>
      ) : (
        <span className="truncate">{item ? item.label : placeholder}</span>
      )}
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

function FacetedBadgeList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="faceted-badge-list"
      className={cn(
        "flex w-max max-w-full flex-wrap items-center gap-1",
        className,
      )}
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

interface FacetedContentProps
  extends
    React.ComponentProps<typeof PopoverContent>,
    Pick<
      React.ComponentProps<typeof Command>,
      "shouldFilter" | "filter" | "loop"
    > {}

function FacetedContent({
  className,
  children,
  shouldFilter,
  filter,
  loop,
  ...props
}: FacetedContentProps) {
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
      <Command
        shouldFilter={shouldFilter}
        filter={filter}
        loop={loop}
        className="p-0.5"
      >
        {children}
      </Command>
    </PopoverContent>
  );
}

function FacetedInput({ ...props }: React.ComponentProps<typeof CommandInput>) {
  return <CommandInput data-slot="faceted-input" {...props} />;
}

function FacetedList({ ...props }: React.ComponentProps<typeof CommandList>) {
  return <CommandList data-slot="faceted-list" {...props} />;
}

function FacetedEmpty({ ...props }: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty data-slot="faceted-empty" {...props} />;
}

function FacetedLoading({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Loading>) {
  return (
    <CommandPrimitive.Loading
      data-slot="faceted-loading"
      className={cn(
        "py-6 text-center text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function FacetedGroup({ ...props }: React.ComponentProps<typeof CommandGroup>) {
  return <CommandGroup data-slot="faceted-group" {...props} />;
}

function FacetedCommandItem({
  className,
  onPointerDownCapture,
  onMouseDown,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground",
        className,
      )}
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

interface FacetedItemProps extends React.ComponentProps<
  typeof CommandPrimitive.Item
> {
  value: string;
}

function FacetedItem({ value, onSelect, ...props }: FacetedItemProps) {
  const store = useFacetedStore("FacetedItem");
  const isSelected = useFacetedStoreSelector(store, (state) => {
    const facetedProps = store.getProps();
    return getIsValueSelected(
      getSelection(state, facetedProps),
      facetedProps.multiple,
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

function FacetedItemIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="faceted-item-indicator"
      className={cn(
        "ml-auto grid place-items-center *:col-start-1 *:row-start-1",
        className,
      )}
      {...props}
    >
      {children != null && (
        <span className="font-mono text-xs group-data-checked/command-item:invisible">
          {children}
        </span>
      )}
      <IconPlaceholder
        lucide="Check"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="CheckIcon"
        remixicon="RiCheckLine"
        className="invisible group-data-checked/command-item:visible"
      />
    </span>
  );
}

function FacetedClear({
  className,
  children = "Clear",
  onSelect,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  const store = useFacetedStore("FacetedClear");
  const hasSelection = useFacetedStoreSelector(
    store,
    (state) =>
      getSelectedValues(getSelection(state, store.getProps())).length > 0,
  );

  if (!hasSelection) return null;

  return (
    <>
      <FacetedSeparator />
      <FacetedGroup>
        <FacetedCommandItem
          data-slot="faceted-clear"
          className={cn("justify-center text-center", className)}
          onSelect={(value) => {
            onSelect?.(value);
            store.clear();
          }}
          {...props}
        >
          {children}
        </FacetedCommandItem>
      </FacetedGroup>
    </>
  );
}

function FacetedSeparator({
  ...props
}: React.ComponentProps<typeof CommandSeparator>) {
  return (
    <CommandSeparator
      data-slot="faceted-separator"
      aria-hidden="true"
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
  FacetedItemIndicator,
  FacetedList,
  FacetedLoading,
  FacetedSeparator,
  FacetedTrigger,
  FacetedValue,
};
