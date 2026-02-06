import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/70 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        blue: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 [a&]:hover:bg-blue-200 dark:[a&]:hover:bg-blue-900/70",
        green:
          "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 [a&]:hover:bg-green-200 dark:[a&]:hover:bg-green-900/70",
        red: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 [a&]:hover:bg-red-200 dark:[a&]:hover:bg-red-900/70",
        yellow:
          "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 [a&]:hover:bg-yellow-200 dark:[a&]:hover:bg-yellow-900/70",
        purple:
          "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 [a&]:hover:bg-purple-200 dark:[a&]:hover:bg-purple-900/70",
        orange:
          "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 [a&]:hover:bg-orange-200 dark:[a&]:hover:bg-orange-900/70",
        pink: "border-transparent bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300 [a&]:hover:bg-pink-200 dark:[a&]:hover:bg-pink-900/70",
        indigo:
          "border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 [a&]:hover:bg-indigo-200 dark:[a&]:hover:bg-indigo-900/70",
        cyan: "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300 [a&]:hover:bg-cyan-200 dark:[a&]:hover:bg-cyan-900/70",
        amber:
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 [a&]:hover:bg-amber-200 dark:[a&]:hover:bg-amber-900/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
