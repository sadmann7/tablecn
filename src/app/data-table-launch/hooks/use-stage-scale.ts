import * as React from "react";

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
const BASE_FONT_SIZE = 16;

/**
 * Scales the root font size instead of transforming the stage. Everything is
 * sized in rem, so popovers that portal to the body scale with the table and
 * measure the real viewport.
 */
export function useStageScale() {
  const scale = React.useSyncExternalStore(
    subscribeToResize,
    getStageScale,
    getServerStageScale,
  );

  React.useEffect(() => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = `${BASE_FONT_SIZE * scale}px`;
    return () => {
      root.style.fontSize = previousFontSize;
    };
  }, [scale]);

  return scale;
}

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getStageScale() {
  return Math.min(
    window.innerWidth / STAGE_WIDTH,
    window.innerHeight / STAGE_HEIGHT,
  );
}

function getServerStageScale() {
  return 0.5;
}
