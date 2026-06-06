"use client";

import { Direction } from "radix-ui";
import type * as React from "react";

function DirectionProvider({
  dir,
  direction,
  children,
  ...props
}: React.ComponentProps<typeof Direction.Provider> & {
  direction?: React.ComponentProps<typeof Direction.Provider>["dir"];
}) {
  return (
    <Direction.Provider dir={direction ?? dir} {...props}>
      {children}
    </Direction.Provider>
  );
}

const useDirection = Direction.useDirection;

export { DirectionProvider, useDirection };
