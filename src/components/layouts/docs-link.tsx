"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { ActiveLink } from "@/components/active-link";
import { DEFAULT_BASE } from "@/lib/constants";

interface DocsLinkProps extends Omit<
  React.ComponentProps<typeof ActiveLink>,
  "href" | "target" | "rel"
> {}

export function DocsLink({ ...props }: DocsLinkProps) {
  const segment = useSelectedLayoutSegment();
  const component = segment?.startsWith("data-grid")
    ? "data-grid"
    : "data-table";
  const href = `https://diceui.com/docs/components/${DEFAULT_BASE}/${component}`;

  return (
    <ActiveLink
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      Docs
    </ActiveLink>
  );
}
