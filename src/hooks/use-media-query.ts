import * as React from "react";

export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const result = matchMedia(query);
      result.addEventListener("change", onStoreChange);
      return () => result.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}
