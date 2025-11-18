import * as React from "react";

// Cache for badge width measurements (shared across all hook instances)
const badgeWidthCache = new Map<string, number>();

interface MeasureBadgeOptions {
  /**
   * Additional className to apply to the measurement element
   */
  className?: string;
  /**
   * Whether to include an icon placeholder in the measurement
   */
  includeIcon?: boolean;
  /**
   * Maximum width constraint for the badge content
   */
  maxWidth?: string;
}

/**
 * Measure the width of a badge using a temporary DOM element
 * Results are cached for performance
 */
function measureBadgeWidth(
  label: string,
  cacheKey: string,
  options?: MeasureBadgeOptions
): number {
  // Check cache first
  const cached = badgeWidthCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Create temporary measurement element
  const measureEl = document.createElement("div");
  measureEl.className = `inline-flex items-center rounded-md border px-1.5 text-xs font-semibold h-5 gap-1 shrink-0 absolute invisible pointer-events-none ${
    options?.className ?? ""
  }`;
  measureEl.style.whiteSpace = "nowrap";

  if (options?.includeIcon) {
    // Add icon placeholder (12px width + gap handled by gap-1 class)
    const icon = document.createElement("span");
    icon.className = "shrink-0";
    icon.style.width = "12px";
    icon.style.height = "12px";
    measureEl.appendChild(icon);
  }

  // Add text content
  if (options?.maxWidth) {
    const text = document.createElement("span");
    text.className = "truncate";
    text.style.maxWidth = options.maxWidth;
    text.textContent = label;
    measureEl.appendChild(text);
  } else {
    measureEl.textContent = label;
  }

  document.body.appendChild(measureEl);
  const width = measureEl.offsetWidth;
  document.body.removeChild(measureEl);

  // Cache the result
  badgeWidthCache.set(cacheKey, width);
  return width;
}

interface UseBadgeTruncationOptions<T> {
  /**
   * Array of items to display as badges
   */
  items: T[];
  /**
   * Function to get the display label from an item
   */
  getLabel: (item: T) => string;
  /**
   * Reference to the container element
   */
  containerRef: React.RefObject<HTMLElement | null>;
  /**
   * Number of lines available for badges
   */
  lineCount: number;
  /**
   * Optional cache key prefix for the measurements
   * Useful if you need separate caches for different badge types
   */
  cacheKeyPrefix?: string;
  /**
   * Optional measurement options
   */
  measureOptions?: MeasureBadgeOptions;
}

interface UseBadgeTruncationResult<T> {
  /**
   * Items that should be visible based on available space
   */
  visibleItems: T[];
  /**
   * Number of items that are hidden due to space constraints
   */
  hiddenCount: number;
  /**
   * Current container width in pixels
   */
  containerWidth: number;
}

/**
 * Hook to calculate badge truncation based on actual measurements
 *
 * This hook measures the actual width of badges and calculates how many
 * can fit in the available space across multiple lines. It uses a shared
 * cache for performance and a single ResizeObserver per container.
 *
 * @example
 * ```tsx
 * const { visibleItems, hiddenCount } = useBadgeTruncation({
 *   items: selectedValues,
 *   getLabel: (value) => options.find(opt => opt.value === value)?.label ?? value,
 *   containerRef,
 *   lineCount: getLineCount(rowHeight),
 * });
 * ```
 */
export function useBadgeTruncation<T>({
  items,
  getLabel,
  containerRef,
  lineCount,
  cacheKeyPrefix = "",
  measureOptions,
}: UseBadgeTruncationOptions<T>): UseBadgeTruncationResult<T> {
  const [containerWidth, setContainerWidth] = React.useState(0);

  // Measure container width on mount and when it resizes
  React.useEffect(() => {
    if (!containerRef.current) return;

    const measureWidth = () => {
      if (containerRef.current) {
        // Account for padding (2 * 8px = 16px for px-2)
        const width = containerRef.current.clientWidth - 16;
        setContainerWidth(width);
      }
    };

    measureWidth();

    // Use ResizeObserver only on the container
    const resizeObserver = new ResizeObserver(measureWidth);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Calculate visible items based on actual widths
  const result = React.useMemo(() => {
    if (!containerWidth || items.length === 0) {
      return { visibleItems: items, hiddenCount: 0, containerWidth };
    }

    const gapWidth = 4; // gap-1 = 4px
    const plusBadgeWidth = 40; // Approximate width of "+N" badge
    let currentLineWidth = 0;
    let currentLine = 1;
    const visible: T[] = [];

    for (const item of items) {
      const label = getLabel(item);
      const cacheKey = cacheKeyPrefix ? `${cacheKeyPrefix}:${label}` : label;
      const badgeWidth = measureBadgeWidth(label, cacheKey, measureOptions);
      const widthWithGap = badgeWidth + gapWidth;

      // Check if badge fits on current line
      if (currentLineWidth + widthWithGap <= containerWidth) {
        currentLineWidth += widthWithGap;
        visible.push(item);
      } else if (currentLine < lineCount) {
        // Move to next line
        currentLine++;
        currentLineWidth = widthWithGap;
        visible.push(item);
      } else {
        // No more space, need to show "+N" badge
        // If adding "+N" badge would overflow, remove last item to make room
        if (
          currentLineWidth + plusBadgeWidth > containerWidth &&
          visible.length > 0
        ) {
          visible.pop();
        }

        break;
      }
    }

    return {
      visibleItems: visible,
      hiddenCount: Math.max(0, items.length - visible.length),
      containerWidth,
    };
  }, [
    items,
    getLabel,
    containerWidth,
    lineCount,
    cacheKeyPrefix,
    measureOptions,
  ]);

  return result;
}

/**
 * Clear the badge width cache
 * Useful if you need to reset measurements (e.g., theme change)
 */
export function clearBadgeWidthCache(): void {
  badgeWidthCache.clear();
}
