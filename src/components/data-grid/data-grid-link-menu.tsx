"use client";

import { TicketPlus } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { type Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataGridLinkMenu extends React.ComponentProps<typeof Button> {
  name: string;
  link: string;
}

export function DataGridLinkMenu({ name, link, className }: DataGridLinkMenu) {
  return (
    <Link
      className={buttonVariants({
        variant: "outline",
        size: "sm",
        className: cn("hidden h-8 font-normal lg:flex", className),
      })}
      href={link}
    >
      <TicketPlus className="text-muted-foreground" />
      {name}
    </Link>
  );
}
