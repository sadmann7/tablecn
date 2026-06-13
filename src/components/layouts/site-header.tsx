import { LayoutGrid, Menu } from "lucide-react";
import Link from "next/link";
import { ActiveLink } from "@/components/active-link";
import { Icons } from "@/components/icons";
import { DocsLink } from "@/components/layouts/docs-link";
import { MobileNav } from "@/components/layouts/mobile-nav";
import { ModeToggle } from "@/components/layouts/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-border/40 border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
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
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link href="/">
            <LayoutGrid />
          </Link>
        </Button>
        <nav className="hidden w-full items-center text-sm md:flex">
          {siteConfig.navLinks.map((navLink) => (
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
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icons.gitHub className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
