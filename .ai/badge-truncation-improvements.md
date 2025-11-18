# Badge Truncation Improvements

## Problem
The previous truncation logic for multiselect and file cells was predictive and inaccurate:
- Used a simple heuristic: `maxVisibleBadgeCount = lineCount * 3`
- Assumed each line could fit exactly 3 badges regardless of actual badge widths
- Didn't account for varying text lengths or actual available space

## Solution Approach

Following Airtable's "View Projection" pattern and best practices for virtualized data grids:

### 1. **Measurement-Based Truncation**
- Replaced predictive logic with actual width measurements
- Created helper functions to measure badge widths using temporary DOM elements
- Accounts for real text width, padding, borders, and gaps

### 2. **Performance Optimizations**

#### Shared Cache
- Implemented a global `badgeWidthCache` Map that stores measurements across all cells
- Same label measured once and reused everywhere
- Significant performance boost for repeated values

#### Single ResizeObserver per Cell
- Only observe the container element (not individual badges)
- Since the grid is virtualized, only ~20-30 visible rows have observers
- Much more efficient than observers on every badge

#### Lazy Measurement
- Measurements only happen for visible (virtualized) rows
- Hidden rows don't trigger any measurement calculations
- Works naturally with TanStack Table's virtualization

#### Efficient DOM Operations
- Measurement elements are:
  - Created once per unique label
  - Positioned absolutely with `invisible` class (no layout impact)
  - Removed immediately after measurement
  - Cached to avoid re-measurement

### 3. **Smart Layout Algorithm**

```typescript
// For each badge:
1. Measure badge width (or use cache)
2. Try to fit on current line
3. If doesn't fit, move to next line (if available)
4. If no more lines, show "+N" badge
5. If "+N" badge doesn't fit, remove last badge to make room
```

This ensures:
- Maximum badge visibility within available space
- Proper multi-line wrapping based on row height
- Accurate "+N" counts

## Implementation Details

### MultiSelectCell
- Measures text-only badges
- Uses `.truncate` class names for styling consistency
- Handles labels of varying lengths

### FileCell
- Measures badges with icons (12px + gap)
- Accounts for file name truncation (max-width: 100px)
- Separate cache key namespace (`file:${fileName}`)

## Performance Characteristics

### Before
❌ Predictive: `lineCount * 3`
- Fixed 3 badges per line regardless of width
- Could show too few or overflow
- No consideration for actual space

### After
✅ Measured: Based on actual widths
- Shows maximum badges that actually fit
- Accurate truncation and "+N" counts
- Scales with column width changes

### Complexity
- **Time**: O(n) per cell where n = number of badges (stopped early when full)
- **Space**: O(m) where m = unique labels (cached measurements)
- **Re-renders**: Only when container width or badge list changes
- **DOM operations**: 1 per unique label (cached thereafter)

## Considerations

### ResizeObserver Count
- Only on visible containers (~20-30 with virtualization)
- Not a performance concern even with 1000+ rows in data
- Observers automatically cleaned up when cells unmount

### Cache Management
- Cache persists across renders (module-level Map)
- No cache invalidation needed (text measurements are static)
- Memory usage minimal (strings + numbers only)
- Could add cache size limit if needed (not necessary for typical use)

### Edge Cases Handled
1. Empty container width (returns all badges initially)
2. Single badge wider than container (shows 0 badges + "+N")
3. "+N" badge doesn't fit (removes last badge to make room)
4. Container resize (automatically recalculates via ResizeObserver)
5. Dynamic data changes (recalculates via useMemo dependencies)

## Testing Recommendations

1. **Varying Badge Counts**: Test with 1, 5, 10, 20+ badges
2. **Column Resizing**: Drag column narrower/wider and verify truncation updates
3. **Row Heights**: Test all row heights (short, medium, tall, extra-tall)
4. **Text Lengths**: Mix short ("US") and long ("United Kingdom") labels
5. **Performance**: Profile with 1000+ rows to verify virtualization works
6. **Theme Changes**: Verify measurements work in light/dark themes

## Future Enhancements (Optional)

1. **Canvas Measurement**: Use `measureText()` for even faster measurements (no DOM)
2. **Intersection Observer**: Only measure when cells enter viewport
3. **Cache Size Limit**: Implement LRU cache if memory becomes a concern
4. **Debounced Resize**: Debounce ResizeObserver callback for very rapid resizes
5. **SSR Support**: Add fallback for server-side rendering (no DOM)

## Migration Notes

- No breaking changes to API or props
- Existing cells automatically benefit from improvements
- Cache is transparent to consumers
- ResizeObserver is automatically cleaned up (no memory leaks)

