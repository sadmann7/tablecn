"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { ActiveLink } from "@/components/active-link";

export function DocsLink({
  ...props
}: Omit<React.ComponentProps<typeof ActiveLink>, "href" | "target" | "rel">) {
  const segment = useSelectedLayoutSegment();
  const component = segment?.startsWith("data-grid")
    ? "data-grid"
    : "data-table";
  const href = `https://diceui.com/docs/components/radix/${component}`;

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
