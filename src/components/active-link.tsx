"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/registry/bases/radix/ui/button";

export function ActiveLink({
  href,
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  const segment = useSelectedLayoutSegment();

  const hrefSegment =
    typeof href === "string" ? href.split("/").filter(Boolean)[0] : null;

  const isActive = hrefSegment ? segment === hrefSegment : segment === null;

  return (
    <Button variant="ghost" asChild>
      <Link
        data-state={isActive ? "active" : "inactive"}
        href={href}
        className={cn(
          "font-normal text-foreground/60 data-[state=active]:text-accent-foreground",
          className,
        )}
        {...props}
      />
    </Button>
  );
}
