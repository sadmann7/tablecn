"use client";

import { cn } from "cn";
import * as React from "react";
import {
  DropIndicator,
  GridList,
  GridListItem,
  useDragAndDrop,
  type DragAndDropHooks,
  type DroppableCollectionReorderEvent,
  type GridListItemProps,
  type GridListProps,
  type Key,
} from "react-aria-components";

import { Button } from "@/registry/bases/aria/ui/button";

const ROOT_NAME = "Sortable";
const CONTENT_NAME = "SortableContent";
const ITEM_NAME = "SortableItem";
const ITEM_HANDLE_NAME = "SortableItemHandle";

interface SortableRootContextValue {
  dragAndDropHooks: DragAndDropHooks;
}

const SortableRootContext =
  React.createContext<SortableRootContextValue | null>(null);

function useSortableContext(consumerName: string) {
  const context = React.useContext(SortableRootContext);
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``);
  }
  return context;
}

interface GetItemValue<T> {
  /**
   * Callback that returns a unique identifier for each sortable item. Required for array of objects.
   * @example getItemValue={(item) => item.id}
   */
  getItemValue: (item: T) => Key;
}

type SortableProps<T> = (T extends object
  ? GetItemValue<T>
  : Partial<GetItemValue<T>>) & {
  value: T[];
  onValueChange?: (items: T[]) => void;
  isDisabled?: boolean;
  children?: React.ReactNode;
};

function Sortable<T>(props: SortableProps<T>) {
  const {
    value,
    onValueChange,
    isDisabled,
    getItemValue: getItemValueProp,
    children,
  } = props;

  const getItemValue = (item: T): Key => {
    if (typeof item === "object" && !getItemValueProp) {
      throw new Error("`getItemValue` is required when using array of objects");
    }
    return getItemValueProp ? getItemValueProp(item) : (item as Key);
  };

  const { dragAndDropHooks } = useDragAndDrop({
    isDisabled,
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder: (event) => {
      const items = reorder(value, getItemValue, event);
      if (items) onValueChange?.(items);
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="outline-primary data-drop-target:outline-1"
      />
    ),
  });

  return (
    <SortableRootContext.Provider value={{ dragAndDropHooks }}>
      {children}
    </SortableRootContext.Provider>
  );
}

interface SortableContentProps<T> extends Omit<
  GridListProps<T>,
  "className" | "dragAndDropHooks"
> {
  className?: string;
}

function SortableContent<T extends object>(props: SortableContentProps<T>) {
  const { className, ...contentProps } = props;

  const context = useSortableContext(CONTENT_NAME);

  return (
    <GridList
      data-slot="sortable-content"
      dragAndDropHooks={context.dragAndDropHooks}
      disallowTypeAhead
      className={cn("outline-hidden", className)}
      {...contentProps}
    />
  );
}

interface SortableItemProps<T> extends Omit<
  GridListItemProps<T>,
  "className" | "id" | "value"
> {
  value: Key;
  className?: string;
}

function SortableItem<T extends object>(props: SortableItemProps<T>) {
  const { value, textValue, className, ...itemProps } = props;

  useSortableContext(ITEM_NAME);

  return (
    <GridListItem
      data-slot="sortable-item"
      data-value={value}
      id={value}
      textValue={textValue ?? String(value)}
      className={cn(
        "outline-hidden data-dragging:cursor-grabbing data-dragging:opacity-50 data-focus-visible:ring-1 data-focus-visible:ring-ring data-focus-visible:ring-offset-1 data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...itemProps}
    />
  );
}

function SortableItemHandle(props: React.ComponentProps<typeof Button>) {
  useSortableContext(ITEM_HANDLE_NAME);

  return <Button slot="drag" data-slot="sortable-item-handle" {...props} />;
}

function reorder<T>(
  value: T[],
  getItemValue: (item: T) => Key,
  event: DroppableCollectionReorderEvent,
) {
  const { keys, target } = event;
  const moved = value.filter((item) => keys.has(getItemValue(item)));
  const rest = value.filter((item) => !keys.has(getItemValue(item)));

  const targetIndex = rest.findIndex(
    (item) => getItemValue(item) === target.key,
  );
  if (targetIndex === -1) return null;

  const insertIndex =
    target.dropPosition === "after" ? targetIndex + 1 : targetIndex;

  return [...rest.slice(0, insertIndex), ...moved, ...rest.slice(insertIndex)];
}

export {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  type SortableProps,
};
