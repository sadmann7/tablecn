"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { ActiveLink } from "@/components/active-link";

export function DocsLink() {
  const segment = useSelectedLayoutSegment();
  const href = segment?.startsWith("data-grid")
    ? "https://diceui.com/docs/components/data-grid"
    : "https://diceui.com/docs/components/data-table";

  return (
    <ActiveLink href={href} target="_blank" rel="noopener noreferrer">
      Docs
    </ActiveLink>
  );
}
