import * as React from "react";

interface WindowSize {
  width: number;
  height: number;
}

interface UseWindowSizeProps {
  defaultWidth?: number;
  defaultHeight?: number;
}

export function useWindowSize({
  defaultWidth = 0,
  defaultHeight = 0,
}: UseWindowSizeProps = {}): WindowSize {
  const width = React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => defaultWidth,
  );
  const height = React.useSyncExternalStore(
    subscribe,
    () => window.innerHeight,
    () => defaultHeight,
  );

  return React.useMemo(() => ({ width, height }), [width, height]);
}

function subscribe(onStoreChange: () => void) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function onResize() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(onStoreChange, 150);
  }

  window.addEventListener("resize", onResize);
  return () => {
    window.removeEventListener("resize", onResize);
    clearTimeout(timeoutId);
  };
}
