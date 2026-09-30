"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import { cn } from "cn";
import * as React from "react";

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

type FacetedSelection<Multiple extends boolean> = Multiple extends true
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
}

interface FacetedStore {
  subscribe: (callback: () => void) => () => void;
  getState: () => FacetedState;
  getProps: () => FacetedController;
  notify: () => void;
  setOpen: (open: boolean) => void;
  selectItem: (value: string) => void;
  clear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

interface FacetedController {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  value?: string | string[];
  onValueChange?: (value: string | string[] | undefined) => void;
  valueControlled: boolean;
  multiple: boolean;
  items: FacetedOption[];
}

function getSelection(
  state: FacetedState,
  props: FacetedController,
): string | string[] | undefined {
  return props.valueControlled ? props.value : state.value;
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

function createFacetedStore(
  propsRef: React.RefObject<FacetedController>,
  state: FacetedState,
): FacetedStore {
  const listeners = new Set<() => void>();
  const inputRef: React.RefObject<HTMLInputElement | null> = { current: null };

  function commitValue(nextValue: string | string[] | undefined) {
    const props = propsRef.current;
    if (!props.valueControlled && !Object.is(state.value, nextValue)) {
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
  value?: FacetedSelection<Multiple>;
  defaultValue?: FacetedSelection<Multiple>;
  onValueChange?: (value: FacetedSelection<Multiple> | undefined) => void;
  onOpenChange?: (open: boolean) => void;
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
      onValueChange?.(nextValue as FacetedSelection<Multiple> | undefined);
    },
    valueControlled: "value" in props,
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
  const open = useStoreSelector(store, (state) => state.open);

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
  const value = useStoreSelector(store, (state) =>
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
      <Command className="p-0.5">{children}</Command>
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
  const isSelected = useStoreSelector(store, (state) => {
    const props = store.getProps();
    return getIsValueSelected(
      getSelection(state, props),
      props.multiple,
      value,
    );
  });

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

function FacetedClear({
  className,
  children = "Clear",
  onSelect,
  onPointerDownCapture,
  onMouseDown,
  ...props
}: React.ComponentProps<typeof CommandItem>) {
  const store = useFacetedStore("FacetedClear");
  const hasSelection = useStoreSelector(store, (state) =>
    getHasSelection(getSelection(state, store.getProps())),
  );
  if (!hasSelection) return null;

  return (
    <CommandItem
      data-slot="faceted-clear"
      className={cn(
        "justify-center text-center [&>svg:last-child]:hidden",
        className,
      )}
      {...mergeProps<"div">(
        {
          onPointerDownCapture(event) {
            event.preventDefault();
          },
          onMouseDown(event) {
            event.preventDefault();
          },
        },
        { onPointerDownCapture, onMouseDown },
      )}
      onSelect={(value) => {
        onSelect?.(value);
        store.clear();
      }}
      {...props}
    >
      {children}
    </CommandItem>
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
