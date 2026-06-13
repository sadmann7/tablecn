"use client";

import { ActiveLink } from "@/components/active-link";
import { DocsLink } from "@/components/layouts/docs-link";
import { SheetClose } from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";

export function MobileNav() {
  return (
    <nav className="flex flex-col p-2">
      {siteConfig.navLinks.map((navLink) => (
        <SheetClose key={navLink.href} asChild>
          <ActiveLink
            href={navLink.href}
            className="w-full justify-start rounded-md font-normal"
          >
            {navLink.label}
          </ActiveLink>
        </SheetClose>
      ))}
      <SheetClose asChild>
        <DocsLink className="w-full justify-start rounded-md font-normal" />
      </SheetClose>
    </nav>
  );
}
