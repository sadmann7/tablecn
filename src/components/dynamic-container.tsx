"use client";

/**
 * @see https://github.com/dubinc/dub/blob/main/packages/ui/src/animated-size-container.tsx
 */

import { motion, type TargetAndTransition } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface Dimensions extends TargetAndTransition {
  width: string | number;
  height: string | number;
}

interface DynamicContainerProps
  extends React.ComponentProps<typeof motion.div> {
  width?: boolean;
  height?: boolean;
  children?: React.ReactNode;
}

function DynamicContainer({
  width,
  height,
  transition = {
    type: "spring",
    duration: 0.3,
    stiffness: 100,
    damping: 15,
  },
  className,
  children,
  ...props
}: DynamicContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState<Dimensions>({
    width: "auto",
    height: "auto",
  });
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const node = containerRef?.current;
    if (!node) return;

    function updateDimensions([entry]: ResizeObserverEntry[]) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        setDimensions({
          width: width ? (entry?.contentRect?.width ?? "auto") : "auto",
          height: height ? (entry?.contentRect?.height ?? "auto") : "auto",
        });
      });
    }

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [width, height]);

  const containerStyle = React.useMemo(
    () => ({
      height: height ? "max-content" : "auto",
      width: width ? "max-content" : "auto",
    }),
    [height, width],
  );

  return (
    <motion.div
      animate={dimensions}
      transition={transition}
      className={cn("translate-z-0 transform overflow-hidden", className)}
      {...props}
    >
      <div ref={containerRef} style={containerStyle}>
        {children}
      </div>
    </motion.div>
  );
}

export { DynamicContainer };
