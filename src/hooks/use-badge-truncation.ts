import * as React from "react";

const badgeWidthCache = new Map<string, number>();

interface MeasureBadgeOptions {
  className?: string;
  iconSize?: number;
  maxWidth?: string;
}

function measureBadgeWidth(
  label: string,
  cacheKey: string,
  options?: MeasureBadgeOptions
): number {
  const cached = badgeWidthCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const measureEl = document.createElement("div");
  measureEl.className = `inline-flex items-center rounded-md border px-1.5 text-xs font-semibold h-5 gap-1 shrink-0 absolute invisible pointer-events-none ${
    options?.className ?? ""
  }`;
  measureEl.style.whiteSpace = "nowrap";

  if (options?.iconSize) {
    const icon = document.createElement("span");
    icon.className = "shrink-0";
    icon.style.width = `${options.iconSize}px`;
    icon.style.height = `${options.iconSize}px`;
    measureEl.appendChild(icon);
  }

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

  badgeWidthCache.set(cacheKey, width);
  return width;
}

interface UseBadgeTruncationOptions<T> {
  items: T[];
  getLabel: (item: T) => string;
  containerRef: React.RefObject<HTMLElement | null>;
  lineCount: number;
  cacheKeyPrefix?: string;
  measureOptions?: MeasureBadgeOptions;
}

interface UseBadgeTruncationResult<T> {
  visibleItems: T[];
  hiddenCount: number;
  containerWidth: number;
}

export function useBadgeTruncation<T>({
  items,
  getLabel,
  containerRef,
  lineCount,
  cacheKeyPrefix = "",
  measureOptions,
}: UseBadgeTruncationOptions<T>): UseBadgeTruncationResult<T> {
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    if (!containerRef.current) return;

    function measureWidth() {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth - 16;
        setContainerWidth(width);
      }
    }

    measureWidth();

    const resizeObserver = new ResizeObserver(measureWidth);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  const result = React.useMemo(() => {
    if (!containerWidth || items.length === 0) {
      return { visibleItems: items, hiddenCount: 0, containerWidth };
    }

    const gapWidth = 4;
    const plusBadgeWidth = 40;
    let currentLineWidth = 0;
    let currentLine = 1;
    const visible: T[] = [];

    for (const item of items) {
      const label = getLabel(item);
      const cacheKey = cacheKeyPrefix ? `${cacheKeyPrefix}:${label}` : label;
      const badgeWidth = measureBadgeWidth(label, cacheKey, measureOptions);
      const widthWithGap = badgeWidth + gapWidth;

      if (currentLineWidth + widthWithGap <= containerWidth) {
        currentLineWidth += widthWithGap;
        visible.push(item);
      } else if (currentLine < lineCount) {
        currentLine++;
        currentLineWidth = widthWithGap;
        visible.push(item);
      } else {
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

export function clearBadgeWidthCache(): void {
  badgeWidthCache.clear();
}
