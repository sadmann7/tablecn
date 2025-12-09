"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActiveLinkProps extends React.ComponentProps<typeof Link> {}

export function ActiveLink({ href, className, ...props }: ActiveLinkProps) {
  const segment = useSelectedLayoutSegment();

  const hrefSegment =
    typeof href === "string" ? href.split("/").filter(Boolean)[0] : null;

  const isActive = hrefSegment ? segment === hrefSegment : segment === null;

  return (
    <Button variant="ghost" size="sm" asChild>
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
