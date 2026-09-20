"use client";

import { ActiveLink } from "@/components/active-link";
import { DocsLink } from "@/components/layouts/docs-link";
import { siteConfig } from "@/config/site";
import { SheetClose } from "@/registry/bases/radix/ui/sheet";

export function MobileNav() {
  return (
    <nav className="flex flex-col gap-1 px-1.5">
      {siteConfig.navLinks.map((navLink) => (
        <SheetClose key={navLink.href} asChild>
          <ActiveLink
            href={navLink.href}
            className="h-auto w-full justify-start px-0 py-2 text-base font-normal hover:bg-transparent dark:hover:bg-transparent"
          >
            {navLink.label}
          </ActiveLink>
        </SheetClose>
      ))}
      <SheetClose asChild>
        <DocsLink className="h-auto w-full justify-start px-0 py-2 text-base font-normal hover:bg-transparent dark:hover:bg-transparent" />
      </SheetClose>
    </nav>
  );
}
