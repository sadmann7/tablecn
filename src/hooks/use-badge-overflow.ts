import * as React from "react";

const badgeWidthCache = new Map<string, number>();

const DEFAULT_CONTAINER_PADDING = 16; // px-2 = 8px * 2
const DEFAULT_BADGE_GAP = 4; // gap-1 = 4px
const DEFAULT_OVERFLOW_BADGE_WIDTH = 40; // Approximate width of "+N" badge
// Badge chrome around the text: px-1.5 padding plus the 1px border on each side
const BADGE_CHROME_WIDTH = 12 + 2;
const BADGE_ICON_GAP = 4; // gap-1 between icon and text
const BADGE_FONT_SIZE = 12; // text-xs
const BADGE_FONT_WEIGHT = 500; // font-medium

let measureContext: CanvasRenderingContext2D | null = null;
let measureFont: string | null = null;

// Canvas text metrics never touch layout, unlike measuring a DOM node mid scroll
function measureTextWidth(text: string): number {
  if (!measureContext) {
    measureContext = document.createElement("canvas").getContext("2d");
  }
  if (!measureContext) return text.length * 7;

  if (!measureFont) {
    const fontFamily = getComputedStyle(document.body).fontFamily;
    measureFont = `${BADGE_FONT_WEIGHT} ${BADGE_FONT_SIZE}px ${fontFamily}`;
  }
  measureContext.font = measureFont;
  return measureContext.measureText(text).width;
}

interface MeasureBadgeWidthProps {
  label: string;
  cacheKey: string;
  iconSize?: number;
  maxWidth?: number;
}

function measureBadgeWidth({
  label,
  cacheKey,
  iconSize,
  maxWidth,
}: MeasureBadgeWidthProps): number {
  const cached = badgeWidthCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const textWidth = measureTextWidth(label);
  const width = Math.ceil(
    BADGE_CHROME_WIDTH +
      (iconSize ? iconSize + BADGE_ICON_GAP : 0) +
      (maxWidth ? Math.min(textWidth, maxWidth) : textWidth),
  );

  // Widths measured with a fallback font would stick around after the web font loads
  if (document.fonts?.status !== "loading") {
    badgeWidthCache.set(cacheKey, width);
  }
  return width;
}

interface GetBadgeListWidthProps<T> {
  items: T[];
  getLabel: (item: T) => string;
  cacheKeyPrefix?: string;
  iconSize?: number;
  maxWidth?: number;
  containerPadding?: number;
  badgeGap?: number;
}

export function getBadgeListWidth<T>({
  items,
  getLabel,
  cacheKeyPrefix = "",
  iconSize,
  maxWidth,
  containerPadding = DEFAULT_CONTAINER_PADDING,
  badgeGap = DEFAULT_BADGE_GAP,
}: GetBadgeListWidthProps<T>): number {
  if (items.length === 0) return 0;

  let width = containerPadding;
  for (const item of items) {
    const label = getLabel(item);
    width +=
      measureBadgeWidth({
        label,
        cacheKey: cacheKeyPrefix ? `${cacheKeyPrefix}:${label}` : label,
        iconSize,
        maxWidth,
      }) + badgeGap;
  }

  return width;
}

interface UseBadgeOverflowProps<T> extends GetBadgeListWidthProps<T> {
  /** Outer width of the badge container, including its padding. */
  containerWidth: number;
  lineCount: number;
  overflowBadgeWidth?: number;
}

interface UseBadgeOverflowReturn<T> {
  visibleItems: T[];
  hiddenCount: number;
  containerWidth: number;
}

export function getBadgeOverflow<T>({
  items,
  getLabel,
  containerWidth: outerWidth,
  lineCount,
  cacheKeyPrefix = "",
  containerPadding = DEFAULT_CONTAINER_PADDING,
  badgeGap = DEFAULT_BADGE_GAP,
  overflowBadgeWidth = DEFAULT_OVERFLOW_BADGE_WIDTH,
  iconSize,
  maxWidth,
}: UseBadgeOverflowProps<T>): UseBadgeOverflowReturn<T> {
  const containerWidth = Math.max(0, outerWidth - containerPadding);

  if (!containerWidth || items.length === 0) {
    return { visibleItems: items, hiddenCount: 0, containerWidth };
  }

  let currentLineWidth = 0;
  let currentLine = 1;
  const visible: T[] = [];

  for (const item of items) {
    const label = getLabel(item);
    const cacheKey = cacheKeyPrefix ? `${cacheKeyPrefix}:${label}` : label;
    const badgeWidth = measureBadgeWidth({
      label,
      cacheKey,
      iconSize,
      maxWidth,
    });
    const widthWithGap = badgeWidth + badgeGap;

    if (currentLineWidth + widthWithGap <= containerWidth) {
      currentLineWidth += widthWithGap;
      visible.push(item);
    } else if (currentLine < lineCount) {
      currentLine++;
      currentLineWidth = widthWithGap;
      visible.push(item);
    } else {
      if (
        currentLineWidth + overflowBadgeWidth > containerWidth &&
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
}

export function useBadgeOverflow<T>({
  items,
  getLabel,
  containerWidth,
  lineCount,
  cacheKeyPrefix,
  containerPadding,
  badgeGap,
  overflowBadgeWidth,
  iconSize,
  maxWidth,
}: UseBadgeOverflowProps<T>): UseBadgeOverflowReturn<T> {
  return React.useMemo(
    () =>
      getBadgeOverflow({
        items,
        getLabel,
        containerWidth,
        lineCount,
        cacheKeyPrefix,
        containerPadding,
        badgeGap,
        overflowBadgeWidth,
        iconSize,
        maxWidth,
      }),
    [
      items,
      getLabel,
      containerWidth,
      lineCount,
      cacheKeyPrefix,
      containerPadding,
      badgeGap,
      overflowBadgeWidth,
      iconSize,
      maxWidth,
    ],
  );
}

export function clearBadgeWidthCache(): void {
  badgeWidthCache.clear();
}
