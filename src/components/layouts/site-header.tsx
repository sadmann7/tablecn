import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { ActiveLink } from "@/components/active-link";
import { Icons } from "@/components/icons";
import { DocsLink } from "@/components/layouts/docs-link";
import { ModeToggle } from "@/components/layouts/mode-toggle";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-border/40 border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="container flex h-14 items-center">
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link href="/">
            <LayoutGrid />
          </Link>
        </Button>
        <nav className="flex w-full items-center text-sm">
          <ActiveLink href="/">Data Table</ActiveLink>
          <ActiveLink href="/data-grid">Data Grid</ActiveLink>
          <ActiveLink href="/data-grid-live">Data Grid Live</ActiveLink>
          <DocsLink />
        </nav>
        <nav className="flex flex-1 items-center md:justify-end">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link
              aria-label="GitHub repo"
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.gitHub className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <ModeToggle />
        </nav>
      </div>
    </header>
  );
}
