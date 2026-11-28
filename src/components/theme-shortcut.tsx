"use client";

import { useValueAsRef } from "@base-ui/utils/useValueAsRef";
import { useTheme } from "next-themes";
import * as React from "react";

import { getIsEditableTarget } from "@/lib/utils";

export function ThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme();
  const resolvedThemeRef = useValueAsRef(resolvedTheme);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || !event.key) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== "d") return;
      if (getIsEditableTarget(event.target)) return;

      event.preventDefault();
      setTheme(resolvedThemeRef.current === "dark" ? "light" : "dark");
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [resolvedThemeRef, setTheme]);

  return null;
}
