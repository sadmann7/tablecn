"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
