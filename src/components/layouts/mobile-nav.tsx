"use client";

import { ActiveLink } from "@/components/active-link";
import { DocsLink } from "@/components/layouts/docs-link";
import { SheetClose } from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";

export function MobileNav() {
  return (
    <nav className="flex flex-col gap-1 px-1.5">
      {siteConfig.navLinks.map((navLink) => (
        <SheetClose key={navLink.href} asChild>
          <ActiveLink
            href={navLink.href}
            className="h-auto w-full justify-start px-0 py-2 font-normal text-base hover:bg-transparent dark:hover:bg-transparent"
          >
            {navLink.label}
          </ActiveLink>
        </SheetClose>
      ))}
      <SheetClose asChild>
        <DocsLink className="h-auto w-full justify-start px-0 py-2 font-normal text-base hover:bg-transparent dark:hover:bg-transparent" />
      </SheetClose>
    </nav>
  );
}
