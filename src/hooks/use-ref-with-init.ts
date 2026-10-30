import * as React from "react";

function useRefWithInit<T>(init: () => T): React.RefObject<T> {
  const [ref] = React.useState(() => ({ current: init() }));
  return ref;
}

export { useRefWithInit };
