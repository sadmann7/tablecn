"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

export function DocsLink() {
  const segment = useSelectedLayoutSegment();
  const href =
    segment === "data-grid"
      ? "https://diceui.com/docs/components/data-grid"
      : "https://diceui.com/docs/components/data-table";

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground/60 transition-colors hover:text-foreground"
    >
      Docs
    </Link>
  );
}
