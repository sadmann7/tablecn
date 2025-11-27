# Data Grid Render Performance Test

## Overview

This test suite helps you measure and analyze how many times the data grid components render when updating multiple cells - critical for AI autofill and bulk update features.

## Setup

The render test is available at:
- **URL**: `/render-test`
- **Component**: `src/components/data-grid/data-grid-render-test.tsx`
- **Page**: `src/app/render-test/page.tsx`

## Running the Test

1. Start your development server:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

2. Navigate to `http://localhost:3000/render-test`

3. Open your browser's DevTools Console (F12 or Cmd+Option+I on Mac)

4. Click any of the test buttons to simulate AI autofill scenarios

## Test Scenarios

### Basic Updates (Single Call)

These tests demonstrate updating cells using a single `onDataUpdate` call with batched updates:

- **Update 1 Cell**: Baseline test for a single cell update
- **Update 5 Cells**: Small batch update across multiple cells
- **Update 25 Cells**: Medium-sized AI autofill scenario
- **Update 100 Cells**: Large AI autofill scenario
- **Update 50 Cells (Multi-column)**: Updates across multiple columns and rows

### Batched vs Sequential Updates

**✓ Batched (Good)**: Single call with array of 10 updates
```typescript
table.options.meta.onDataUpdate([
  { rowIndex: 0, columnId: "name", value: "..." },
  { rowIndex: 1, columnId: "name", value: "..." },
  // ... more updates
]);
```

**✗ Sequential (Bad)**: Multiple calls in a loop
```typescript
for (let i = 0; i < 10; i++) {
  table.options.meta.onDataUpdate({
    rowIndex: i,
    columnId: "name",
    value: "..."
  });
}
```

## What to Look For

### In the UI

The render stats card shows:
- **Component Renders**: Total number of component re-renders
- **Cells Updated**: Number of cells that were updated
- **Update Time**: Time taken to process the update

### In the Console

The console logs provide detailed information:

1. **Color-coded sections** for each test:
   - 🟡 Yellow: Test start marker
   - 🟢 Green: Data change operations
   - 🔴 Red: Row/cell re-render notifications

2. **Render tracking**:
   - `[DataGridRenderTest]` - Main component renders
   - `[DataGridRow N]` - Individual row re-renders
   - `[DataGridCell N:columnId]` - Individual cell re-renders

## Performance Optimization

The data grid is optimized with:

### 1. React.memo for Components
- `DataGridRow` - Memoized with custom comparison
- `DataGridCell` - Memoized with value comparison

### 2. Batched Updates
The `onDataUpdate` function accepts arrays:
```typescript
// Multiple updates in a single call
onDataUpdate([
  { rowIndex: 0, columnId: "name", value: "Alice" },
  { rowIndex: 1, columnId: "age", value: 30 },
  // ...
]);
```

### 3. Selective Re-renders
Only rows and cells that actually changed should re-render. Check the console to verify:
- Rows with updated cells should re-render
- Rows without changes should NOT re-render
- Only affected cells should re-render

## Expected Behavior

### Good Performance Indicators

✅ Only updated rows re-render
✅ Batched updates complete in <50ms for 100 cells
✅ No unnecessary re-renders of unaffected components
✅ Memory stays stable across multiple updates

### Warning Signs

⚠️ All rows re-render on every update
⚠️ Multiple re-renders of the same cell
⚠️ Update time increases non-linearly with cell count
⚠️ Memory leaks or increasing render counts

## AI Autofill Best Practices

When implementing AI autofill:

1. **Batch Your Updates**: Always collect all AI-generated values and send them in a single `onDataUpdate` call

   ```typescript
   // ✓ Good
   const updates = aiResults.map((result, i) => ({
     rowIndex: i,
     columnId: "field",
     value: result
   }));
   onDataUpdate(updates);

   // ✗ Bad
   aiResults.forEach((result, i) => {
     onDataUpdate({ rowIndex: i, columnId: "field", value: result });
   });
   ```

2. **Consider Chunking**: For very large datasets (1000+ cells), consider updating in chunks:

   ```typescript
   const CHUNK_SIZE = 100;
   for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
     const chunk = updates.slice(i, i + CHUNK_SIZE);
     await onDataUpdate(chunk);
     await new Promise(resolve => setTimeout(resolve, 10)); // Brief pause
   }
   ```

3. **Stream Updates**: For real-time AI generation, accumulate updates and flush periodically:

   ```typescript
   const updateBuffer = [];
   const flushInterval = 200; // ms

   aiStream.on('data', (result) => {
     updateBuffer.push(result);
     if (updateBuffer.length >= 10) {
       flushUpdates();
     }
   });

   setInterval(flushUpdates, flushInterval);
   ```

## Debugging

Enable verbose logging by checking the browser console. The test includes:
- Automatic render counting for all components
- Performance timing for updates
- Color-coded log messages for easy scanning

## Comparison with Canvas-based Grids

Canvas-based grids (like AG Grid with virtual rendering) have different trade-offs:

**Canvas Pros:**
- Faster initial render for huge datasets (10k+ rows)
- Lower memory for visible viewport
- Consistent performance regardless of complexity

**Canvas Cons:**
- Less customizable (limited to canvas drawing)
- Accessibility challenges
- No native browser text selection
- Custom scrolling implementation needed

**DOM-based (This Grid) Pros:**
- Full HTML/CSS customization
- Native accessibility
- Browser features work (select, copy, etc.)
- React DevTools debugging

**DOM-based Cons:**
- More memory for virtualized components
- Re-render optimization critical for performance

## Next Steps

After testing:
1. Verify batched updates perform well for your use case
2. Check that only affected cells re-render
3. Monitor memory usage during bulk updates
4. Implement your AI autofill with batched updates
5. Consider implementing update streaming for real-time AI

## Troubleshooting

### All rows are re-rendering
- Check that `getRowId` is provided and returns stable IDs
- Verify data references aren't changing unnecessarily
- Ensure `onDataChange` creates a new array with stable objects

### Slow updates for large batches
- Consider chunking updates (see AI Autofill Best Practices)
- Profile with React DevTools Profiler
- Check for expensive cell rendering logic

### Memory leaks
- Ensure event listeners are cleaned up
- Check for circular references in data
- Monitor with browser DevTools Memory profiler

## Contributing

Found an optimization opportunity? Please:
1. Run the render test to establish baseline
2. Make your changes
3. Re-run tests to verify improvement
4. Document the optimization technique

