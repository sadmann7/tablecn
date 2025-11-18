# useBadgeTruncation Hook

A reusable React hook for calculating badge truncation based on actual measurements.

## Overview

This hook measures the actual width of badges and calculates how many can fit in the available space across multiple lines. It uses a shared cache for performance and a single ResizeObserver per container.

## Location

`src/hooks/use-badge-truncation.ts`

## API

### Signature

```typescript
function useBadgeTruncation<T>(
  options: UseBadgeTruncationOptions<T>
): UseBadgeTruncationResult<T>
```

### Options

```typescript
interface UseBadgeTruncationOptions<T> {
  /** Array of items to display as badges */
  items: T[];
  
  /** Function to get the display label from an item */
  getLabel: (item: T) => string;
  
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLElement | null>;
  
  /** Number of lines available for badges */
  lineCount: number;
  
  /** Optional cache key prefix (useful for separate caches) */
  cacheKeyPrefix?: string;
  
  /** Optional measurement options */
  measureOptions?: MeasureBadgeOptions;
}

interface MeasureBadgeOptions {
  /** Additional className to apply */
  className?: string;
  
  /** Whether to include an icon placeholder */
  includeIcon?: boolean;
  
  /** Maximum width constraint for badge content */
  maxWidth?: string;
}
```

### Return Value

```typescript
interface UseBadgeTruncationResult<T> {
  /** Items that should be visible */
  visibleItems: T[];
  
  /** Number of items that are hidden */
  hiddenCount: number;
  
  /** Current container width in pixels */
  containerWidth: number;
}
```

## Usage Examples

### Basic Usage (Text Badges)

```typescript
function MyComponent() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const labels = ["Short", "Medium Label", "Very Long Label Name"];
  
  const { visibleItems, hiddenCount } = useBadgeTruncation({
    items: labels,
    getLabel: (label) => label,
    containerRef,
    lineCount: 2,
  });
  
  return (
    <div ref={containerRef}>
      {visibleItems.map((label) => (
        <Badge key={label}>{label}</Badge>
      ))}
      {hiddenCount > 0 && <Badge>+{hiddenCount}</Badge>}
    </div>
  );
}
```

### With Complex Objects

```typescript
interface Tag {
  id: string;
  name: string;
  color: string;
}

function TagList({ tags }: { tags: Tag[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const { visibleItems, hiddenCount } = useBadgeTruncation({
    items: tags,
    getLabel: (tag) => tag.name,
    containerRef,
    lineCount: 1,
  });
  
  return (
    <div ref={containerRef}>
      {visibleItems.map((tag) => (
        <Badge key={tag.id} style={{ backgroundColor: tag.color }}>
          {tag.name}
        </Badge>
      ))}
      {hiddenCount > 0 && <Badge variant="outline">+{hiddenCount}</Badge>}
    </div>
  );
}
```

### With Icons (Like FileCell)

```typescript
function FileList({ files }: { files: FileData[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const { visibleItems, hiddenCount } = useBadgeTruncation({
    items: files,
    getLabel: (file) => file.name,
    containerRef,
    lineCount: 2,
    cacheKeyPrefix: "file", // Separate cache namespace
    measureOptions: {
      includeIcon: true,      // Account for icon space
      maxWidth: "100px",      // Limit filename width
    },
  });
  
  return (
    <div ref={containerRef}>
      {visibleItems.map((file) => (
        <Badge key={file.id}>
          <FileIcon type={file.type} />
          <span className="truncate" style={{ maxWidth: "100px" }}>
            {file.name}
          </span>
        </Badge>
      ))}
      {hiddenCount > 0 && <Badge>+{hiddenCount}</Badge>}
    </div>
  );
}
```

### With Cache Namespace

When using the hook in multiple contexts with different styling:

```typescript
// Context 1: Small badges
const { visibleItems: visibleTags } = useBadgeTruncation({
  items: tags,
  getLabel: (tag) => tag.name,
  containerRef: tagContainerRef,
  lineCount: 1,
  cacheKeyPrefix: "small-tags",
  measureOptions: { className: "text-xs" },
});

// Context 2: Large badges
const { visibleItems: visibleCategories } = useBadgeTruncation({
  items: categories,
  getLabel: (cat) => cat.name,
  containerRef: categoryContainerRef,
  lineCount: 2,
  cacheKeyPrefix: "large-categories",
  measureOptions: { className: "text-sm font-bold" },
});
```

## How It Works

1. **Container Measurement**: Uses ResizeObserver to track container width changes
2. **Badge Measurement**: Creates temporary invisible DOM elements to measure actual badge widths
3. **Caching**: Stores measurements in a global cache (keyed by label + prefix)
4. **Layout Algorithm**: 
   - Iterates through items
   - Fits badges on current line if space available
   - Moves to next line when current line is full
   - Stops when all lines are full
   - Reserves space for "+N" badge if needed

## Performance

- **ResizeObserver**: One per container (not per badge)
- **Measurements**: O(1) per unique label (cached)
- **Algorithm**: O(n) where n = number of items
- **Memory**: O(m) where m = unique labels
- **Re-renders**: Only when container width or items change

## Utilities

### clearBadgeWidthCache()

Clears the global badge width cache. Useful when:
- Theme changes (font sizes may change)
- Dynamic styling changes
- Testing scenarios

```typescript
import { clearBadgeWidthCache } from "@/hooks/use-badge-truncation";

// Clear cache on theme change
function onThemeChange() {
  clearBadgeWidthCache();
}
```

## Implementation Notes

### Shared Cache

The cache is a module-level `Map` shared across all hook instances:

```typescript
const badgeWidthCache = new Map<string, number>();
```

**Pros:**
- Same label measured once across all components
- Excellent performance for repeated values
- Minimal memory usage

**Cons:**
- Cache persists for app lifetime
- No automatic invalidation on theme/style changes

**Solution:** Use `cacheKeyPrefix` to namespace different badge styles, or call `clearBadgeWidthCache()` when styling changes.

### Measurement Technique

Badges are measured by creating temporary DOM elements:

```typescript
const measureEl = document.createElement("div");
measureEl.className = "... badge classes ...";
measureEl.style.whiteSpace = "nowrap";
measureEl.textContent = label;

document.body.appendChild(measureEl);
const width = measureEl.offsetWidth;
document.body.removeChild(measureEl);
```

This ensures measurements match actual rendered badges exactly.

### Type Safety

The hook is fully generic:

```typescript
useBadgeTruncation<FileData>({ ... })  // Works with FileData
useBadgeTruncation<string>({ ... })    // Works with strings
useBadgeTruncation<Tag>({ ... })       // Works with Tag objects
```

TypeScript ensures type safety throughout.

## Testing

Example test cases:

```typescript
describe("useBadgeTruncation", () => {
  it("should show all items when they fit", () => {
    const { visibleItems, hiddenCount } = renderHook(() =>
      useBadgeTruncation({
        items: ["A", "B", "C"],
        getLabel: (x) => x,
        containerRef: { current: createContainer(300) },
        lineCount: 1,
      })
    );
    
    expect(visibleItems).toEqual(["A", "B", "C"]);
    expect(hiddenCount).toBe(0);
  });
  
  it("should truncate when items don't fit", () => {
    const { visibleItems, hiddenCount } = renderHook(() =>
      useBadgeTruncation({
        items: ["A", "B", "C", "D", "E"],
        getLabel: (x) => x,
        containerRef: { current: createContainer(100) },
        lineCount: 1,
      })
    );
    
    expect(visibleItems.length).toBeLessThan(5);
    expect(hiddenCount).toBeGreaterThan(0);
  });
});
```

## Future Enhancements

1. **Canvas Measurement**: Use `measureText()` for even faster measurements
2. **Intersection Observer**: Only measure when cells enter viewport
3. **LRU Cache**: Implement cache size limits
4. **Debounced Resize**: Optimize rapid resize events
5. **SSR Support**: Add server-side fallback (no DOM)
6. **Virtual Scrolling**: Integrate with virtual lists for huge datasets

