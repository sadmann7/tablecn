"use client";

import { useTheme } from "next-themes";
import * as React from "react";

import { THEME_COLORS } from "@/lib/site";

export function ThemeColor() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;

    const metas = document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    for (const meta of metas) {
      meta.content = THEME_COLORS[resolvedTheme];
    }
  }, [resolvedTheme]);

  return null;
}
