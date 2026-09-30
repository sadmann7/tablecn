"use client";

import { type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";

import { toggleVariants } from "@/registry/bases/radix/ui/toggle";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
  }
>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: "horizontal",
});

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
  }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        "relative shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-20 focus-visible:z-20 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg data-[state=on]:z-10 data-[state=on]:focus:z-20 data-[state=on]:focus-visible:z-20 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:hover:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:hover:border-t group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:focus-visible:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:focus-visible:border-t group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:has-[+:focus-visible]:border-r-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:has-[+:focus-visible]:border-b-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:has-[+:hover]:border-r-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:has-[+:hover]:border-b-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:has-[+[data-state=on]]:border-r-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:has-[+[data-state=on]]:border-b-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:data-[state=on]:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:data-[state=on]:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
