"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import { cn } from "cn";
import * as React from "react";

import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/registry/bases/base/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

type FacetedValue<Multiple extends boolean> = Multiple extends true
  ? string[]
  : string;

interface FacetedOption {
  value: string;
  label: string;
}

const NO_ITEMS: FacetedOption[] = [];

interface FacetedState {
  value: string | string[] | undefined;
  open: boolean;
  multiple: boolean;
  items: FacetedOption[];
}

interface FacetedStore {
  subscribe: (callback: () => void) => () => void;
  getState: () => FacetedState;
  notify: () => void;
  setOpen: (open: boolean) => void;
  selectItem: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

interface FacetedController<Multiple extends boolean = boolean> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  value?: FacetedValue<Multiple>;
  onValueChange?: (value: FacetedValue<Multiple> | undefined) => void;
  multiple: Multiple;
}

function createFacetedStore<Multiple extends boolean>(
  propsRef: React.RefObject<FacetedController<Multiple>>,
  state: FacetedState,
): FacetedStore {
  const listeners = new Set<() => void>();
  const inputRef: React.RefObject<HTMLInputElement | null> = { current: null };

  const store: FacetedStore = {
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getState: () => state,
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
      const { value, onValueChange, multiple } = propsRef.current;

      if (multiple) {
        const currentValue: string[] = Array.isArray(value)
          ? (value as string[])
          : [];
        const nextValue = currentValue.includes(selectedValue)
          ? currentValue.filter((item) => item !== selectedValue)
          : [...currentValue, selectedValue];
        onValueChange?.(nextValue as FacetedValue<Multiple>);
        return;
      }

      onValueChange?.(
        (value === selectedValue ? undefined : selectedValue) as
          | FacetedValue<Multiple>
          | undefined,
      );
      store.setOpen(false);
    },
    inputRef,
  };

  return store;
}

function useStoreSelector<T>(
  store: FacetedStore,
  selector: (state: FacetedState) => T,
): T {
  const getSnapshot = () => selector(store.getState());
  return React.useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

function getIsValueSelected(state: FacetedState, value: string) {
  if (state.multiple) {
    return Array.isArray(state.value) && state.value.includes(value);
  }

  return state.value === value;
}

function getShouldRestoreInputFocus(event: React.FocusEvent<HTMLElement>) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, [contenteditable='true']")) return false;

  const content = event.currentTarget;
  if (target === content) return true;

  const list = content.querySelector("[data-slot=faceted-list]");
  if (list?.contains(target)) return true;

  // cmdk's root is focusable, so clicks on the popup padding land there.
  const command = content.querySelector("[data-slot=command]");
  return target === command;
}

const FacetedStoreContext = React.createContext<FacetedStore | null>(null);

function useFacetedStore(name: string) {
  const store = React.useContext(FacetedStoreContext);
  if (!store) {
    throw new Error(`\`${name}\` must be within Faceted`);
  }
  return store;
}

interface FacetedProps<Multiple extends boolean = false> extends Omit<
  React.ComponentProps<typeof Popover>,
  "onOpenChange"
> {
  value?: FacetedValue<Multiple>;
  onValueChange?: (value: FacetedValue<Multiple> | undefined) => void;
  onOpenChange?: (open: boolean) => void;
  items?: FacetedOption[];
  children?: React.ReactNode;
  multiple?: Multiple;
}

function Faceted<Multiple extends boolean = false>({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  value,
  onValueChange,
  items = NO_ITEMS,
  children,
  multiple = false as Multiple,
  ...props
}: FacetedProps<Multiple>) {
  const propsRef = React.useRef<FacetedController<Multiple>>({
    open: openProp,
    onOpenChange,
    value,
    onValueChange,
    multiple,
  });
  propsRef.current = {
    open: openProp,
    onOpenChange,
    value,
    onValueChange,
    multiple,
  };

  const storeRef = React.useRef<FacetedStore | null>(null);
  storeRef.current ??= createFacetedStore(propsRef, {
    value,
    open: openProp ?? defaultOpen,
    multiple,
    items: NO_ITEMS,
  });
  const store = storeRef.current;

  const state = store.getState();
  if (openProp !== undefined) state.open = openProp;
  state.value = value;
  state.multiple = multiple;
  state.items = items;

  useIsomorphicLayoutEffect(() => {
    store.notify();
  }, [store, openProp, value, multiple, items]);

  const open = useStoreSelector(store, (state) => state.open);

  return (
    <FacetedStoreContext.Provider value={store}>
      <Popover
        data-slot="faceted"
        open={open}
        onOpenChange={store.setOpen}
        {...props}
      >
        {children}
      </Popover>
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

interface FacetedValueProps {
  placeholder?: React.ReactNode;
  children?: React.ReactNode | ((selected: FacetedOption[]) => React.ReactNode);
}

function FacetedValue({
  placeholder = "Select options...",
  children,
}: FacetedValueProps) {
  const store = useFacetedStore("FacetedValue");
  const value = useStoreSelector(store, (state) => state.value);
  const items = useStoreSelector(store, (state) => state.items);
  const selected = getSelectedItems(value, items);

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

function FacetedBadge({
  className,
  render,
  ...props
}: useRender.ComponentProps<"span">) {
  return useRender({
    defaultTagName: "span",
    render,
    state: {
      slot: "faceted-badge",
    },
    props: mergeProps<"span">(
      {
        className: cn(
          "flex h-[calc(--spacing(5.25))] w-fit max-w-full min-w-0 items-center justify-center gap-1 rounded-sm bg-input/60 px-1.5 text-xs font-medium whitespace-nowrap text-foreground [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
          className,
        ),
      },
      props,
    ),
  });
}

function FacetedContent({
  className,
  children,
  onFocus,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const store = useFacetedStore("FacetedContent");

  return (
    <PopoverContent
      data-slot="faceted-content"
      align="start"
      className={cn("w-50 origin-(--transform-origin) p-0", className)}
      {...mergeProps<"div">(
        {
          onFocus(event) {
            if (!getShouldRestoreInputFocus(event)) return;
            store.inputRef.current?.focus();
          },
        },
        { onFocus },
      )}
      {...props}
    >
      <Command>{children}</Command>
    </PopoverContent>
  );
}

function FacetedInput({
  ref,
  ...props
}: React.ComponentProps<typeof CommandInput>) {
  const store = useFacetedStore("FacetedInput");
  const composedRef = useMergedRefs(ref, store.inputRef);

  return (
    <CommandInput data-slot="faceted-input" ref={composedRef} {...props} />
  );
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

interface FacetedItemProps extends React.ComponentProps<typeof CommandItem> {
  value: string;
}

function FacetedItem({
  value,
  onSelect,
  onPointerDownCapture,
  onMouseDown,
  ...props
}: FacetedItemProps) {
  const store = useFacetedStore("FacetedItem");
  const isSelected = useStoreSelector(store, (state) =>
    getIsValueSelected(state, value),
  );

  return (
    <CommandItem
      data-slot="faceted-item"
      data-checked={isSelected || undefined}
      aria-checked={isSelected}
      {...mergeProps<"div">(
        {
          onPointerDownCapture(event) {
            // A focusable item steals the input on pointerdown.
            event.preventDefault();
          },
          onMouseDown(event) {
            // iOS Safari can emit a synthetic mousedown without a pointerdown.
            event.preventDefault();
          },
        },
        { onPointerDownCapture, onMouseDown },
      )}
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

function FacetedSeparator(
  props: React.ComponentProps<typeof CommandSeparator>,
) {
  return <CommandSeparator data-slot="faceted-separator" {...props} />;
}

export {
  Faceted,
  FacetedBadge,
  FacetedBadgeList,
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
