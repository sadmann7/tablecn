"use client";

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
} from "@/registry/bases/radix/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/radix/ui/popover";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

type FacetedValue<Multiple extends boolean> = Multiple extends true
  ? string[]
  : string;

interface FacetedState {
  value: string | string[] | undefined;
  open: boolean;
  multiple: boolean;
}

interface FacetedStore {
  subscribe: (callback: () => void) => () => void;
  getState: () => FacetedState;
  setState: <K extends keyof FacetedState>(
    key: K,
    value: FacetedState[K],
  ) => void;
  notify: () => void;
  setOpen: (open: boolean) => void;
  selectItem: (value: string) => void;
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
  initialState: FacetedState,
): FacetedStore {
  const listeners = new Set<() => void>();
  const state = initialState;

  const store: FacetedStore = {
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getState: () => state,
    setState: (key, value) => {
      if (Object.is(state[key], value)) return;
      state[key] = value;
      store.notify();
    },
    notify: () => {
      for (const callback of listeners) {
        callback();
      }
    },
    setOpen: (open) => {
      const { open: openProp, onOpenChange } = propsRef.current;
      if (openProp === undefined) {
        store.setState("open", open);
      }
      onOpenChange?.(open);
    },
    selectItem: (selectedValue) => {
      const { value, onValueChange, multiple } = propsRef.current;
      if (!onValueChange) return;

      if (multiple) {
        const currentValue: string[] = Array.isArray(value)
          ? (value as string[])
          : [];
        const nextValue = currentValue.includes(selectedValue)
          ? currentValue.filter((item) => item !== selectedValue)
          : currentValue.concat(selectedValue);
        onValueChange(nextValue as FacetedValue<Multiple>);
      } else {
        onValueChange(
          value === selectedValue
            ? undefined
            : (selectedValue as FacetedValue<Multiple>),
        );
        requestAnimationFrame(() => store.setOpen(false));
      }
    },
  };

  return store;
}

function useStoreSelector<T>(
  store: FacetedStore,
  selector: (state: FacetedState) => T,
): T {
  return React.useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

function getIsValueSelected(state: FacetedState, value: string) {
  if (state.multiple) {
    return Array.isArray(state.value) && state.value.includes(value);
  }

  return state.value === value;
}

const FacetedStoreContext = React.createContext<FacetedStore | null>(null);

function useFacetedStore(name: string) {
  const store = React.useContext(FacetedStoreContext);
  if (!store) {
    throw new Error(`\`${name}\` must be within Faceted`);
  }
  return store;
}

interface FacetedProps<
  Multiple extends boolean = false,
> extends React.ComponentProps<typeof Popover> {
  value?: FacetedValue<Multiple>;
  onValueChange?: (value: FacetedValue<Multiple> | undefined) => void;
  children?: React.ReactNode;
  multiple?: Multiple;
}

function Faceted<Multiple extends boolean = false>({
  open: openProp,
  onOpenChange,
  value,
  onValueChange,
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
  const store =
    storeRef.current ??
    (storeRef.current = createFacetedStore(propsRef, {
      value,
      open: openProp ?? false,
      multiple,
    }));

  const state = store.getState();
  if (openProp !== undefined) {
    state.open = openProp;
  }
  state.value = value;
  state.multiple = multiple;

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

interface FacetedBadgeListProps extends React.ComponentProps<"div"> {
  options?: {
    label: string;
    value: string;
  }[];
  max?: number;
  placeholder?: string;
}

function FacetedBadgeList({
  options = [],
  max = 2,
  placeholder = "Select options...",
  className,
  ...props
}: FacetedBadgeListProps) {
  const store = useFacetedStore("FacetedBadgeList");
  const value = useStoreSelector(store, (state) => state.value);
  const values = Array.isArray(value) ? value : value ? [value] : [];

  function getLabel(optionValue: string) {
    const option = options.find((item) => item.value === optionValue);
    return option?.label ?? optionValue;
  }

  if (values.length === 0) {
    return (
      <div
        data-slot="faceted-badge-list"
        className={cn(
          "flex w-full items-center gap-1 text-muted-foreground",
          className,
        )}
        {...props}
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
      </div>
    );
  }

  return (
    <div
      data-slot="faceted-badge-list"
      className={cn("flex w-full flex-wrap items-center gap-1", className)}
      {...props}
    >
      {values.length > max ? (
        <FacetedBadge>{values.length} selected</FacetedBadge>
      ) : (
        values.map((optionValue) => (
          <FacetedBadge key={optionValue}>
            <span className="truncate">{getLabel(optionValue)}</span>
          </FacetedBadge>
        ))
      )}
    </div>
  );
}

function FacetedBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="faceted-badge"
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit max-w-full min-w-0 items-center justify-center rounded-sm bg-input/60 px-1.5 text-xs font-medium whitespace-nowrap text-foreground",
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
      <Command>{children}</Command>
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

function FacetedGroup({ ...props }: React.ComponentProps<typeof CommandGroup>) {
  return <CommandGroup data-slot="faceted-group" {...props} />;
}

interface FacetedItemProps extends React.ComponentProps<typeof CommandItem> {
  value: string;
}

function FacetedItem({ value, onSelect, ...props }: FacetedItemProps) {
  const store = useFacetedStore("FacetedItem");
  const isSelected = useStoreSelector(store, (state) =>
    getIsValueSelected(state, value),
  );

  return (
    <CommandItem
      data-slot="faceted-item"
      data-checked={isSelected || undefined}
      aria-checked={isSelected}
      onSelect={() => {
        if (onSelect) {
          onSelect(value);
        } else {
          store.selectItem(value);
        }
      }}
      {...props}
    />
  );
}

function FacetedSeparator({
  ...props
}: React.ComponentProps<typeof CommandSeparator>) {
  return <CommandSeparator data-slot="faceted-separator" {...props} />;
}

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
