import * as React from "react";

const UNINITIALIZED = {};

function useRefWithInit<T>(init: () => T): React.RefObject<T> {
  const ref = React.useRef<T | typeof UNINITIALIZED>(UNINITIALIZED);

  if (ref.current === UNINITIALIZED) {
    ref.current = init();
  }

  return ref as React.RefObject<T>;
}

export { useRefWithInit };
