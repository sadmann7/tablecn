"use client";

import type * as React from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "cn";

const MAIN_CONTENT_ID = "main-content";

function SkipNav(props: React.ComponentProps<"a">) {
  const {
    href = `#${MAIN_CONTENT_ID}`,
    children = "Skip to content",
    className,
    ...linkProps
  } = props;

  return (
    <a
      data-slot="skip-nav"
      {...mergeProps<"a">(
        {
          href,
          className: cn(
            "sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-100 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            className,
          ),
          onClick: (event) => {
            if (event.defaultPrevented) return;
            skipToTarget(event, href);
          },
        },
        linkProps,
      )}
    >
      {children}
    </a>
  );
}

function skipToTarget(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string,
) {
  const target = getTarget(href);
  if (!target) return;

  event.preventDefault();
  if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
    makeTemporarilyFocusable(target);
  }
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

function makeTemporarilyFocusable(target: HTMLElement) {
  const outline = target.style.outline;

  target.tabIndex = -1;
  target.style.outline = "none";
  target.addEventListener(
    "blur",
    () => {
      target.removeAttribute("tabindex");
      target.style.outline = outline;
    },
    { once: true },
  );
}

function getTarget(href: string) {
  if (!href.startsWith("#") || href.length < 2) return null;
  return document.getElementById(decodeURIComponent(href.slice(1)));
}

export { SkipNav, MAIN_CONTENT_ID };
