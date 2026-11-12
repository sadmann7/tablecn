"use client";

import { cn } from "cn";
import * as React from "react";
import {
  Input,
  MenuItem,
  type MenuItemProps,
  MenuLoadMoreItem,
  SearchField,
} from "react-aria-components";

import { Button } from "@/registry/bases/aria/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from "@/registry/bases/aria/ui/command";
import { Popover, PopoverTrigger } from "@/registry/bases/aria/ui/popover";
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
  items: FacetedOption[];
  multiple: boolean;
}

interface FacetedController {
  isValueControlled: boolean;
  onValueChange?: (value: string | string[] | undefined) => void;
  setOpen: (open: boolean) => void;
}

interface FacetedStore {
  controller: FacetedController;
  setController: (controller: FacetedController) => void;
  subscribe: (callback: () => void) => () => void;
  getState: () => FacetedStoreState;
  notify: () => void;
  sync: (changes: Partial<FacetedStoreState>) => void;
  setOpen: (open: boolean) => void;
  selectItem: (value: string) => void;
  clear: () => void;
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

function createFacetedStore(state: FacetedStoreState): FacetedStore {
  const listeners = new Set<() => void>();

  function commitValue(nextValue: string | string[] | undefined) {
    store.controller.onValueChange?.(nextValue);
    if (
      !store.controller.isValueControlled &&
      !Object.is(state.value, nextValue)
    ) {
      state.value = nextValue;
      store.notify();
    }
  }

  const store: FacetedStore = {
    controller: {
      isValueControlled: false,
      setOpen: () => {},
    },
    setController: (controller) => {
      store.controller = controller;
    },
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
    sync: (changes) => {
      let hasChanged = false;
      for (const key of Object.keys(changes) as (keyof FacetedStoreState)[]) {
        if (Object.is(state[key], changes[key])) continue;
        Object.assign(state, { [key]: changes[key] });
        hasChanged = true;
      }
      if (hasChanged) store.notify();
    },
    setOpen: (open) => store.controller.setOpen(open),
    selectItem: (selectedValue) => {
      if (state.multiple) {
        const selected = Array.isArray(state.value) ? state.value : [];
        commitValue(
          selected.includes(selectedValue)
            ? selected.filter((item) => item !== selectedValue)
            : [...selected, selectedValue],
        );
        return;
      }

      commitValue(state.value === selectedValue ? undefined : selectedValue);
      store.setOpen(false);
    },
    clear: () => {
      commitValue(state.multiple ? [] : undefined);
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

interface FacetedProps<Multiple extends boolean = false> extends Omit<
  React.ComponentProps<typeof PopoverTrigger>,
  "isOpen" | "defaultOpen" | "onOpenChange"
> {
  open?: boolean;
  defaultOpen?: boolean;
  value?: FacetedSelectedValue<Multiple>;
  defaultValue?: FacetedSelectedValue<Multiple>;
  onValueChange?: (value: FacetedSelectedValue<Multiple> | undefined) => void;
  onOpenChange?: (open: boolean) => void;
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
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;

  const [store] = React.useState(() =>
    createFacetedStore({ value: value ?? defaultValue, items, multiple }),
  );

  React.useLayoutEffect(() => {
    store.setController({
      isValueControlled: value !== undefined,
      onValueChange(nextValue) {
        if (!getIsFacetedSelectedValue(nextValue, multiple)) return;
        onValueChange?.(nextValue);
      },
      setOpen(nextOpen) {
        onOpenChange?.(nextOpen);
        if (openProp === undefined) setInternalOpen(nextOpen);
      },
    });
  });

  const wasValueControlledRef = React.useRef(value !== undefined);

  React.useLayoutEffect(() => {
    const isValueControlled = value !== undefined;
    store.sync(
      isValueControlled || wasValueControlledRef.current
        ? { value, items, multiple }
        : { items, multiple },
    );
    wasValueControlledRef.current = isValueControlled;
  }, [store, value, items, multiple]);

  return (
    <FacetedStoreContext.Provider value={store}>
      <PopoverTrigger
        data-slot="faceted"
        isOpen={open}
        onOpenChange={store.setOpen}
        {...props}
      />
    </FacetedStoreContext.Provider>
  );
}

function FacetedTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="faceted-trigger"
      className={cn(
        "justify-between text-left has-[>[data-slot=faceted-value]]:transition-[color,background-color,border-color,box-shadow] has-[>[data-slot=faceted-value]>[data-slot=faceted-badge-list]]:pl-1",
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
  const value = useFacetedStoreSelector(store, (state) => state.value);
  const items = useFacetedStoreSelector(store, (state) => state.items);
  const multiple = useFacetedStoreSelector(store, (state) => state.multiple);
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
        <FacetedBadgeList className="min-w-0 flex-nowrap">
          {values.length > 2 ? (
            <FacetedBadge>
              <bdi>{values.length} selected</bdi>
            </FacetedBadge>
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

function FacetedBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="faceted-badge"
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit max-w-full min-w-0 items-center justify-center gap-1 rounded-sm bg-input/60 px-1.5 text-xs font-medium whitespace-nowrap text-foreground [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

const NO_FILTER = () => true;

interface FacetedContentProps
  extends
    Omit<React.ComponentProps<typeof Popover>, "children">,
    Pick<React.ComponentProps<typeof Command>, "filter"> {
  children?: React.ReactNode;
  shouldFilter?: boolean;
}

function FacetedContent({
  className,
  children,
  shouldFilter,
  filter,
  ...props
}: FacetedContentProps) {
  return (
    <Popover
      data-slot="faceted-content"
      placement="bottom start"
      className={cn("cn-menu-target cn-menu-translucent w-50 p-0", className)}
      {...props}
    >
      <Command
        filter={shouldFilter === false ? NO_FILTER : filter}
        className="p-0.5"
      >
        {children}
      </Command>
    </Popover>
  );
}

interface FacetedInputProps extends React.ComponentProps<typeof Input> {
  variant?: "default" | "line";
}

function FacetedInput({
  variant = "default",
  className,
  ...props
}: FacetedInputProps) {
  if (variant === "line") {
    return (
      <SearchField
        autoFocus
        aria-label={props.placeholder || "Search"}
        data-slot="faceted-input-wrapper"
        data-variant="line"
        className="-mx-0.5 -mt-0.5 mb-0.5 flex h-9 items-center gap-2 border-b px-3.5"
      >
        <IconPlaceholder
          lucide="SearchIcon"
          tabler="IconSearch"
          hugeicons="Search01Icon"
          phosphor="MagnifyingGlassIcon"
          remixicon="RiSearchLine"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <Input
          data-slot="faceted-input"
          className={cn(
            "h-full w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden",
            className,
          )}
          {...props}
        />
      </SearchField>
    );
  }

  return (
    <CommandInput data-slot="faceted-input" className={className} {...props} />
  );
}

function FacetedList(props: React.ComponentProps<typeof CommandList>) {
  const store = useFacetedStore("FacetedList");
  const value = useFacetedStoreSelector(store, (state) => state.value);
  const multiple = useFacetedStoreSelector(store, (state) => state.multiple);

  return (
    <CommandList
      data-slot="faceted-list"
      selectionMode={multiple ? "multiple" : "single"}
      selectedKeys={getSelectedValues(value)}
      escapeKeyBehavior="none"
      shouldCloseOnSelect={false}
      {...props}
    />
  );
}

function FacetedEmpty({ ...props }: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty data-slot="faceted-empty" {...props} />;
}

function FacetedLoading({
  className,
  isLoading = true,
  ...props
}: React.ComponentProps<typeof MenuLoadMoreItem>) {
  return (
    <MenuLoadMoreItem
      data-slot="faceted-loading"
      isLoading={isLoading}
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

interface FacetedCommandItemProps extends Omit<MenuItemProps, "className"> {
  className?: string;
}

function FacetedCommandItem({
  className,
  children,
  textValue,
  ...props
}: FacetedCommandItemProps) {
  return (
    <MenuItem
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-focused:bg-muted data-focused:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-focused:*:[svg]:text-foreground",
        className,
      )}
      textValue={
        textValue ?? (typeof children === "string" ? children : undefined)
      }
      {...props}
    >
      {children}
    </MenuItem>
  );
}

interface FacetedItemProps extends Omit<
  FacetedCommandItemProps,
  "id" | "value" | "onSelect"
> {
  value: string;
  keywords?: string[];
  onSelect?: (value: string) => void;
}

function FacetedItem({
  value,
  keywords,
  onSelect,
  ...props
}: FacetedItemProps) {
  const store = useFacetedStore("FacetedItem");

  return (
    <FacetedCommandItem
      data-slot="faceted-item"
      id={value}
      textValue={getFacetedItemTextValue(value, props.children, keywords)}
      onAction={() => {
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

// Search matches the value and keywords, as cmdk does, plus the visible label
function getFacetedItemTextValue(
  value: string,
  children: unknown,
  keywords: string[] = [],
) {
  const label = typeof children === "string" ? children : undefined;
  return [value, label, ...keywords].filter(Boolean).join(" ");
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
        <span className="font-mono text-xs group-data-selected/command-item:invisible">
          {children}
        </span>
      )}
      <IconPlaceholder
        lucide="Check"
        tabler="IconCheck"
        hugeicons="Tick02Icon"
        phosphor="CheckIcon"
        remixicon="RiCheckLine"
        className="invisible group-data-selected/command-item:visible"
      />
    </span>
  );
}

function FacetedClear({
  className,
  children = "Clear",
  onSelect,
  ...props
}: Omit<FacetedCommandItemProps, "onSelect"> & { onSelect?: () => void }) {
  const store = useFacetedStore("FacetedClear");
  const hasSelection = useFacetedStoreSelector(
    store,
    (state) => getSelectedValues(state.value).length > 0,
  );

  if (!hasSelection) return null;

  return (
    <>
      <FacetedSeparator />
      <FacetedGroup selectionMode="none">
        <FacetedCommandItem
          data-slot="faceted-clear"
          className={cn("justify-center text-center", className)}
          onAction={() => {
            onSelect?.();
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
