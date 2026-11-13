import { Menu } from "lucide-react";
import Link from "next/link";

import { ActiveLink } from "@/components/active-link";
import { Icons } from "@/components/icons";
import { DocsLink } from "@/components/layouts/docs-link";
import { MobileNav } from "@/components/layouts/mobile-nav";
import { ModeToggle } from "@/components/layouts/mode-toggle";
import { GITHUB_URL, NAV_LINKS, SITE_NAME } from "@/lib/site";
import { Button } from "@/registry/bases/radix/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/registry/bases/radix/ui/sheet";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="container flex h-14 items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 md:hidden"
              aria-label="Open menu"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 data-[side=left]:w-full data-[side=left]:sm:max-w-none"
          >
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-left text-sm">Menu</SheetTitle>
            </SheetHeader>
            <MobileNav />
          </SheetContent>
        </Sheet>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:me-2"
        >
          <Icons.logo className="size-5" />
          <span className="sr-only font-semibold lg:not-sr-only">
            {SITE_NAME}
          </span>
        </Link>
        <nav className="hidden w-full items-center text-sm md:flex">
          {NAV_LINKS.map((navLink) => (
            <ActiveLink key={navLink.href} href={navLink.href}>
              {navLink.label}
            </ActiveLink>
          ))}
          <DocsLink />
        </nav>
        <div className="flex flex-1 items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link
              aria-label="GitHub repo"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.gitHub />
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
