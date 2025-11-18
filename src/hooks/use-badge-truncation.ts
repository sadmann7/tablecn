import * as React from "react";

interface UseBadgeTruncationProps {
  /**
   * The number of items to display
   */
  itemCount: number;
  /**
   * Ref to the container element (usually DataGridCellWrapper)
   */
  containerRef: React.RefObject<HTMLElement | null>;
  /**
   * Width in pixels to reserve for the "+N" counter badge
   * @default 40
   */
  counterBadgeWidth?: number;
  /**
   * Gap between items in pixels
   * @default 4
   */
  gap?: number;
  /**
   * Cell padding in pixels (will be subtracted from available width)
   * @default 16
   */
  cellPadding?: number;
}

interface UseBadgeTruncationReturn {
  /**
   * Number of items that can be displayed
   */
  visibleCount: number;
  /**
   * Number of items that are hidden
   */
  hiddenCount: number;
  /**
   * Ref to attach to the measurement container
   */
  measurementRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Ref to attach to the display container
   */
  contentRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Map to store item element refs for width measurement
   */
  itemRefs: React.RefObject<Map<number, HTMLElement>>;
  /**
   * Current container size for use in inline styles
   */
  containerSize: { width: number; height: number };
}

export function useBadgeTruncation({
  itemCount,
  containerRef,
  counterBadgeWidth = 40,
  gap = 4,
  cellPadding = 16,
}: UseBadgeTruncationProps): UseBadgeTruncationReturn {
  const itemRefs = React.useRef<Map<number, HTMLElement>>(new Map());
  const contentRef = React.useRef<HTMLDivElement>(null);
  const measurementRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(0);
  const [containerSize, setContainerSize] = React.useState({
    width: 0,
    height: 0,
  });

  // Track container resize with optimization
  React.useEffect(() => {
    if (!containerRef.current) return;

    let rafId: number | null = null;
    let lastWidth = 0;
    let lastHeight = 0;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Skip if dimensions haven't changed (can happen during scroll)
        if (width === lastWidth && height === lastHeight) {
          return;
        }

        lastWidth = width;
        lastHeight = height;

        // Cancel any pending update
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        // Batch updates with RAF to avoid layout thrashing
        rafId = requestAnimationFrame(() => {
          setContainerSize({ width, height });
          rafId = null;
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Calculate how many items can fit based on actual measurements
  React.useLayoutEffect(() => {
    if (!containerRef.current || itemCount === 0) {
      setVisibleCount(itemCount);
      return;
    }

    const containerWidth =
      containerSize.width || containerRef.current.clientWidth;
    const containerHeight =
      containerSize.height || containerRef.current.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) {
      return;
    }

    const availableWidth = containerWidth - cellPadding;

    let totalHeight = 20; // height of one badge (h-5 = 20px)
    let currentLineWidth = 0;
    let count = 0;

    for (let i = 0; i < itemCount; i++) {
      const item = itemRefs.current.get(i);
      if (!item) continue;

      const itemWidth = item.offsetWidth;

      // Calculate width with gap
      const widthWithGap =
        currentLineWidth + (currentLineWidth > 0 ? gap : 0) + itemWidth;

      // Check if we need to reserve space for counter badge
      const isLastItem = i === itemCount - 1;
      const needsCounterSpace = !isLastItem;
      const widthWithCounter = needsCounterSpace
        ? widthWithGap + gap + counterBadgeWidth
        : widthWithGap;

      // Check if this item fits on the current line
      if (
        needsCounterSpace
          ? widthWithCounter > availableWidth
          : widthWithGap > availableWidth
      ) {
        // Would need to wrap to next line
        const nextLineHeight = totalHeight + 20 + gap;

        // Check if we have room for another line
        if (nextLineHeight > containerHeight) {
          // No room for another line, stop here
          break;
        }

        // Check if item + counter would fit on new line
        if (
          needsCounterSpace &&
          itemWidth + gap + counterBadgeWidth > availableWidth
        ) {
          // Even on a new line, can't fit item + counter
          break;
        }

        // Move to next line
        totalHeight = nextLineHeight;
        currentLineWidth = itemWidth;
      } else {
        // Fits on current line
        currentLineWidth = widthWithGap;
      }

      count = i + 1;
    }

    setVisibleCount(count);
  }, [
    itemCount,
    containerSize,
    containerRef,
    counterBadgeWidth,
    gap,
    cellPadding,
  ]);

  const hiddenCount = Math.max(0, itemCount - visibleCount);

  return {
    visibleCount,
    hiddenCount,
    measurementRef,
    contentRef,
    itemRefs,
    containerSize,
  };
}
