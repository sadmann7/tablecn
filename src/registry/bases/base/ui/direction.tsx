"use client";

import {
  DirectionProvider,
  useDirection as useBaseDirection,
} from "@base-ui/react/direction-provider";

function useDirection(dir?: "ltr" | "rtl") {
  const contextDir = useBaseDirection();
  return dir ?? contextDir;
}

export { DirectionProvider, useDirection };
