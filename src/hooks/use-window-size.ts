import * as React from "react";

interface WindowSize {
  width: number;
  height: number;
}

interface UseWindowSizeProps {
  defaultWidth?: number;
  defaultHeight?: number;
}

export function useWindowSize(props: UseWindowSizeProps = {}): WindowSize {
  const { defaultWidth = 0, defaultHeight = 0 } = props;

  const [windowSize, setWindowSize] = React.useState<WindowSize>({
    width: defaultWidth,
    height: defaultHeight,
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Set initial size after mount to avoid hydration mismatch
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    let timeoutId: NodeJS.Timeout | null = null;

    function onResize() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150);
    }

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return windowSize;
}
