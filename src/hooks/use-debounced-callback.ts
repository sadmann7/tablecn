import { useStableCallback } from "@base-ui/utils/useStableCallback";
import { useTimeout } from "@base-ui/utils/useTimeout";
import * as React from "react";

export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number,
) {
  const onCallback = useStableCallback(callback);
  const timeout = useTimeout();

  return React.useMemo(() => {
    function debounced(...args: Parameters<T>) {
      timeout.start(delay, () => onCallback(...args));
    }

    return Object.assign(debounced, { cancel: timeout.clear });
  }, [delay, onCallback, timeout]);
}
