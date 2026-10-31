import * as React from "react";

export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number,
) {
  const callbackRef = React.useRef(callback);
  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const debounceTimerRef = React.useRef(0);

  React.useEffect(
    () => () => window.clearTimeout(debounceTimerRef.current),
    [],
  );

  return React.useMemo(() => {
    function cancel() {
      window.clearTimeout(debounceTimerRef.current);
    }

    function debounced(...args: Parameters<T>) {
      cancel();
      debounceTimerRef.current = window.setTimeout(
        () => callbackRef.current(...args),
        delay,
      );
    }

    debounced.cancel = cancel;
    return debounced;
  }, [delay]);
}
