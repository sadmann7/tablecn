"use client";

import type * as React from "react";

import {
  DirectionProvider as DirectionProviderPrimitive,
  type TextDirection,
  useDirection,
} from "@base-ui/react/direction-provider";

// Base UI names the prop `direction` where Radix names it `dir`; both are accepted
// so the component surface matches across bases.
function DirectionProvider({
  dir,
  direction,
  children,
}: React.ComponentProps<typeof DirectionProviderPrimitive> & {
  dir?: TextDirection;
}) {
  return (
    <DirectionProviderPrimitive direction={direction ?? dir}>
      {children}
    </DirectionProviderPrimitive>
  );
}

export { DirectionProvider, useDirection };
