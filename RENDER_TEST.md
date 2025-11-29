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

### AI Autofill Simulation

**🤖 AI Autofill N Cells**: This is the **most realistic test** for AI agent scenarios. It simulates a complete AI workflow across **multiple columns** (name, email, department, age).

Available options:
- **AI Autofill 5 Cells**: Quick test for small-scale AI operations (~2 rows)
- **AI Autofill 25 Cells**: Medium-scale test for typical use cases (~7 rows)
- **AI Autofill 100 Cells**: Large-scale test for bulk AI operations (~25 rows)

Each simulation follows these phases:
1. **Phase 1 - Searching** (800ms): All cells show "🔍 Searching..." while waiting for AI
2. **Phase 2 - Generating (first batch)** (600ms): First half of cells show "✨ Generating..."
3. **Phase 3 - Generating (second batch)** (400ms): Remaining cells show "✨ Generating..."
4. **Phase 4 - Results streaming** (200ms per chunk): AI results populate in adaptive chunks
   - Generates realistic data per column type (names, emails, departments, ages)
   - Updates spread across multiple rows and columns

This mimics what happens when:
- User selects multiple cells across different rows and columns
- User triggers AI autofill for the selection
- Backend sends request to AI service
- AI streams responses back
- Frontend updates cells progressively across the grid

**Duration**: ~3-5 seconds with multiple state transitions per cell (4 updates per cell).
**Pattern**: Cells update in a scattered pattern across rows and columns, just like real AI selection.

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
✅ AI simulation shows smooth state transitions without jank
✅ FPS stays above 30 during continuous updates

### Warning Signs

⚠️ All rows re-render on every update
⚠️ Multiple re-renders of the same cell
⚠️ Update time increases non-linearly with cell count
⚠️ Memory leaks or increasing render counts
⚠️ Frame drops or stuttering during AI simulation
⚠️ Cells flashing or showing incorrect intermediate states

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

2. **Show Loading States**: Update cells to show loading states while AI is working

   ```typescript
   // Step 1: Show loading state
   const loadingUpdates = selectedCells.map(cell => ({
     ...cell,
     value: "🔍 Searching..."
   }));
   onDataUpdate(loadingUpdates);

   // Step 2: Call AI
   const aiResults = await fetchAIResults(selectedCells);

   // Step 3: Update with results
   const finalUpdates = aiResults.map((result, i) => ({
     rowIndex: selectedCells[i].rowIndex,
     columnId: selectedCells[i].columnId,
     value: result
   }));
   onDataUpdate(finalUpdates);
   ```

3. **Consider Chunking**: For very large datasets (1000+ cells), consider updating in chunks:

   ```typescript
   const CHUNK_SIZE = 100;
   for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
     const chunk = updates.slice(i, i + CHUNK_SIZE);
     await onDataUpdate(chunk);
     await new Promise(resolve => setTimeout(resolve, 10)); // Brief pause
   }
   ```

4. **Stream Updates**: For real-time AI generation, accumulate updates and flush periodically:

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

5. **Handle Errors Gracefully**: Show error states in cells when AI fails

   ```typescript
   try {
     const results = await fetchAIResults(cells);
     onDataUpdate(results);
   } catch (error) {
     const errorUpdates = cells.map(cell => ({
       ...cell,
       value: "⚠️ Error - click to retry"
     }));
     onDataUpdate(errorUpdates);
   }
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

