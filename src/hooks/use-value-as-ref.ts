import * as React from "react";

import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";

function useValueAsRef<T>(value: T) {
  const ref = React.useRef<T>(value);

  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });

  return ref;
}

export { useValueAsRef };
