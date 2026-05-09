"use client";

import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DataTableDragHandleProps = Omit<
  React.ComponentProps<typeof Button>,
  "onClick"
> & {
  label?: string;
};

/**
 * Internal context provided by `<DataTable>` to each sortable row.
 *
 * Keeps the drag handle decoupled from the row implementation: the consumer
 * just renders `<DataTableDragHandle />` inside any cell and the listeners
 * are wired automatically.
 */
interface RowDragHandleContextValue {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
  /** Disabled when the row is not part of the sortable context. */
  enabled: boolean;
}

const RowDragHandleContext =
  React.createContext<RowDragHandleContextValue | null>(null);

/**
 * Renders a drag handle bound to the surrounding sortable row.
 *
 * Falls back to a static visual placeholder when used outside a DnD-enabled
 * `<DataTable>` (e.g. during SSR / first paint). This keeps the cell layout
 * stable across hydration — `@dnd-kit` only registers listeners on the client.
 */
function DataTableDragHandle({
  className,
  label = "Drag to reorder",
  children,
  ...props
}: DataTableDragHandleProps) {
  const ctx = React.useContext(RowDragHandleContext);

  if (!ctx?.enabled) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex size-7 items-center justify-center text-muted-foreground/40",
          className,
        )}
      >
        {children ?? <GripVertical className="size-4" />}
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      data-dragging={ctx.isDragging || undefined}
      className={cn(
        "size-7 cursor-grab text-muted-foreground hover:bg-muted/60 active:cursor-grabbing data-dragging:cursor-grabbing",
        className,
      )}
      {...ctx.attributes}
      {...ctx.listeners}
      {...props}
    >
      {children ?? <GripVertical className="size-4" />}
    </Button>
  );
}

export { DataTableDragHandle, RowDragHandleContext };
