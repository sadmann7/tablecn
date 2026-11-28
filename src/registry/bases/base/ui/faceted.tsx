"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { EMPTY_ARRAY, NOOP } from "@base-ui/utils/empty";
import { ReactStore, useStore } from "@base-ui/utils/store";
import { useControlled } from "@base-ui/utils/useControlled";
import { useIsoLayoutEffect } from "@base-ui/utils/useIsoLayoutEffect";
import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "cn";
import * as React from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from "@/registry/bases/base/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import { IconPlaceholder } from "@/registry/icons/icon-placeholder";

type FacetedSelectedValue<Multiple extends boolean> = Multiple extends true
  ? string[]
  : string;

interface FacetedOption {
  label: string;
  value: string;
}

interface FacetedState {
  value: string | string[] | undefined;
  items: FacetedOption[];
  multiple: boolean;
  label: string | undefined;
  announcement: string;
}

interface FacetedContext {
  isValueControlled: boolean;
  onValueChange: (value: string | string[] | undefined) => void;
  onOpenChange: (open: boolean) => void;
}

const facetedSelectors = {
  value: (state: FacetedState) => state.value,
  items: (state: FacetedState) => state.items,
  multiple: (state: FacetedState) => state.multiple,
  label: (state: FacetedState) => state.label,
  announcement: (state: FacetedState) => state.announcement,
  isSelected: (state: FacetedState, itemValue: string) =>
    getIsValueSelected(state.value, state.multiple, itemValue),
  hasSelection: (state: FacetedState) =>
    getSelectedValues(state.value).length > 0,
};

type FacetedStore = ReturnType<typeof createFacetedStore>;

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

function createFacetedStore(state: FacetedState) {
  const store = new ReactStore<
    FacetedState,
    FacetedContext,
    typeof facetedSelectors
  >(
    state,
    {
      isValueControlled: false,
      onValueChange: NOOP,
      onOpenChange: NOOP,
    },
    facetedSelectors,
  );

  function setContext(context: FacetedContext) {
    Object.assign(store.context, context);
  }

  function commitValue(nextValue: string | string[] | undefined) {
    store.context.onValueChange(nextValue);
    if (!store.context.isValueControlled) store.set("value", nextValue);
  }

  function setOpen(open: boolean) {
    store.set("announcement", "");
    store.context.onOpenChange(open);
  }

  function selectItem(selectedValue: string) {
    if (!store.state.multiple) {
      commitValue(
        store.state.value === selectedValue ? undefined : selectedValue,
      );
      setOpen(false);
      return;
    }

    const selected = Array.isArray(store.state.value) ? store.state.value : [];
    const isRemoving = selected.includes(selectedValue);
    commitValue(
      isRemoving
        ? selected.filter((item) => item !== selectedValue)
        : [...selected, selectedValue],
    );
    const itemLabel =
      getLabels(store.state.items).get(selectedValue) ?? selectedValue;
    store.set(
      "announcement",
      `${itemLabel} ${isRemoving ? "not selected" : "selected"}`,
    );
  }

  function clear() {
    commitValue(store.state.multiple ? [] : undefined);
  }

  return Object.assign(store, { setContext, setOpen, selectItem, clear });
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
  React.ComponentProps<typeof Popover>,
  "onOpenChange"
> {
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
  items = EMPTY_ARRAY,
  multiple = false as Multiple,
  ...props
}: FacetedProps<Multiple>) {
  const [open, setOpen] = useControlled({
    controlled: openProp,
    default: defaultOpen,
    name: "Faceted",
    state: "open",
  });

  const [store] = React.useState(() =>
    createFacetedStore({
      value: value ?? defaultValue,
      items,
      multiple,
      label: undefined,
      announcement: "",
    }),
  );

  const isValueControlled = value !== undefined;
  const wasValueControlledRef = React.useRef(isValueControlled);

  useIsoLayoutEffect(() => {
    store.setContext({
      isValueControlled,
      onValueChange(nextValue) {
        if (!getIsFacetedSelectedValue(nextValue, multiple)) return;
        onValueChange?.(nextValue);
      },
      onOpenChange(nextOpen) {
        onOpenChange?.(nextOpen);
        setOpen(nextOpen);
      },
    });
  });

  useIsoLayoutEffect(() => {
    // A controlled value that turns undefined clears the selection.
    if (isValueControlled || wasValueControlledRef.current) {
      store.set("value", value);
    }
    wasValueControlledRef.current = isValueControlled;
  }, [store, value, isValueControlled]);

  useIsoLayoutEffect(() => {
    store.update({ items, multiple });
  }, [store, items, multiple]);

  return (
    <FacetedStoreContext.Provider value={store}>
      <Popover
        data-slot="faceted"
        open={open}
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
  const value = useStore(store, facetedSelectors.value);
  const items = useStore(store, facetedSelectors.items);
  const multiple = useStore(store, facetedSelectors.multiple);
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
                <bdi className="truncate">{selectedItem.label}</bdi>
              </FacetedBadge>
            ))
          )}
        </FacetedBadgeList>
      ) : (
        <bdi className="truncate">{item ? item.label : placeholder}</bdi>
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
  const store = useFacetedStore("FacetedContent");
  const label = useStore(store, facetedSelectors.label);
  const announcement = useStore(store, facetedSelectors.announcement);

  return (
    <PopoverContent
      aria-label={label}
      data-slot="faceted-content"
      align="start"
      className={cn(
        "cn-menu-target cn-menu-translucent w-50 origin-(--transform-origin) p-0",
        className,
      )}

      {...props}
    >
      <Command
        shouldFilter={shouldFilter}
        filter={filter}
        loop={loop}
        label={label}
        className="p-0.5"
      >
        {children}
      </Command>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </PopoverContent>
  );
}

interface FacetedInputProps extends React.ComponentProps<
  typeof CommandPrimitive.Input
> {
  variant?: "default" | "line";
}

function FacetedInput({
  variant = "default",
  className,
  ref,
  ...props
}: FacetedInputProps) {
  const store = useFacetedStore("FacetedInput");
  const label = props["aria-label"] ?? props.placeholder;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const composedRef = useMergedRefs(ref, inputRef);

  React.useEffect(() => {
    const input = inputRef.current;
    const root = input?.closest("[cmdk-root]");
    if (!input || !root) return;

    // cmdk's own aria-activedescendant lags behind and targets the item wrapper.
    const onSync = () => {
      const id = root.querySelector(
        "[cmdk-item][aria-selected='true'] > [role='option']",
      )?.id;
      for (const element of [input, root.querySelector("[cmdk-list]")]) {
        if (!element) continue;
        if (!id) {
          element.removeAttribute("aria-activedescendant");
        } else if (element.getAttribute("aria-activedescendant") !== id) {
          element.setAttribute("aria-activedescendant", id);
        }
      }
    };

    onSync();
    const observer = new MutationObserver(onSync);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributeFilter: ["aria-selected", "aria-activedescendant"],
    });
    return () => observer.disconnect();
  }, []);

  useIsoLayoutEffect(() => {
    store.set("label", label);
    return () => store.set("label", undefined);
  }, [store, label]);

  if (variant === "line") {
    return (
      <div
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
        <CommandPrimitive.Input
          ref={composedRef}
          data-slot="faceted-input"
          className={cn(
            "h-full w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
      </div>
    );
  }

  return (
    <CommandInput
      ref={composedRef}
      data-slot="faceted-input"
      className={className}
      {...props}
    />
  );
}

function FacetedList({
  label: labelProp,
  ...props
}: React.ComponentProps<typeof CommandList>) {
  const store = useFacetedStore("FacetedList");
  const label = useStore(store, facetedSelectors.label);
  const multiple = useStore(store, facetedSelectors.multiple);

  return (
    <CommandList
      data-slot="faceted-list"
      aria-multiselectable={multiple || undefined}
      label={labelProp ?? label}
      {...props}
    />
  );
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

interface FacetedCommandItemProps extends React.ComponentProps<
  typeof CommandPrimitive.Item
> {
  selected?: boolean;
}

function FacetedCommandItem({
  selected,
  disabled,
  className,
  children,
  onPointerDownCapture,
  onMouseDown,
  onSelect,
  ...props
}: FacetedCommandItemProps) {
  const optionId = React.useId();

  return (
    <CommandPrimitive.Item
      disabled={disabled}
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground",
        className,
      )}
      {...mergeProps<"div">(
        {
          onPointerDownCapture(event) {
            // A focusable item steals the input on pointerdown.
            event.preventDefault();
            if (event.pointerType === "touch") return;
            event.currentTarget
              .closest("[cmdk-root]")
              ?.querySelector<HTMLInputElement>("[cmdk-input]")
              ?.focus();
          },
          onMouseDown(event) {
            // iOS Safari can emit a synthetic mousedown without a pointerdown.
            event.preventDefault();
          },
        },
        { onPointerDownCapture, onMouseDown },
      )}
      onSelect={onSelect}
      {...props}
      asChild
    >
      {/* cmdk marks the highlighted item with aria-selected, so the option is an inner element. */}
      <div role="none" aria-disabled={disabled || undefined}>
        <div
          role="option"
          id={optionId}
          aria-selected={selected}
          aria-disabled={disabled || undefined}
          className="justify-[inherit] flex min-w-0 flex-1 items-center gap-[inherit] group-data-selected/command-item:*:[svg]:text-foreground"
        >
          {children}
        </div>
      </div>
    </CommandPrimitive.Item>
  );
}

interface FacetedItemProps extends React.ComponentProps<
  typeof CommandPrimitive.Item
> {
  value: string;
}

function FacetedItem({ value, onSelect, ...props }: FacetedItemProps) {
  const store = useFacetedStore("FacetedItem");
  const isSelected = useStore(store, facetedSelectors.isSelected, value);

  return (
    <FacetedCommandItem
      data-slot="faceted-item"
      data-checked={isSelected || undefined}
      selected={isSelected}
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
          <span className="sr-only">, </span>
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
  const hasSelection = useStore(store, facetedSelectors.hasSelection);

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
