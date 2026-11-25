"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DATA_TABLE_EXAMPLES } from "@/lib/site";
import { Button } from "@/registry/bases/radix/ui/button";

function DataTableExamples() {
  const pathname = usePathname();

  return (
    <nav aria-label="Examples" className="flex flex-wrap items-center gap-1">
      <span className="me-1 text-xs text-muted-foreground">Examples</span>
      {DATA_TABLE_EXAMPLES.map((example) => {
        const isCurrent = pathname === example.href;

        return (
          <Button
            key={example.href}
            variant={isCurrent ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-xs font-normal"
            asChild
          >
            <Link
              href={example.href}
              aria-current={isCurrent ? "page" : undefined}
            >
              {example.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

export { DataTableExamples };
