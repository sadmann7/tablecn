# Data grid scroll performance notes

Goal: 120 fps scrolling on a 100k row x 100 column data grid (TanStack Table v9 + TanStack Virtual).
Reviewed branch: `sadman/data-grid-scroll-perf` at `98ba9b3`. Findings are from reading the code; nothing has been profiled yet.

Frame budget at 120 Hz is ~8.3 ms. The only way to hit it is to keep the work per frame proportional to the visible cells (~30 rows x ~15 columns), not to the row or column count.

## Already done on the branch

- `DataGridViewport` owns both virtualizers, so scroll frames no longer re-render the component calling `useDataGrid` (14bd2e1).
- Header memoized and subscribed to its own slice of table state.
- Rows subscribe to their own slice of the store via `Subscribe` + `selectRowState`.
- Unpinned columns virtualized horizontally; focused and editing columns stay mounted through a custom `rangeExtractor` (7f806a4).
- Cells mounted during a fast fling render `DataGridCellPreview` and upgrade through `useDeferredValue` once scrolling settles.
- Rows pinned to the rendered scroll offset during large jumps (scrollbar drags), so no blank space.
- Row overscan biased toward the scroll direction.
- `measureElement` removed; rows use their fixed height from `estimateSize`.
- 100k row stress demo at `/data-grid-stress`.

## Remaining suspects (in priority order)

All paths are under `src/registry/bases/{radix,base}/`.

1. **Full cells still mount at normal scroll speed.**
   `components/data-grid/data-grid.tsx`: a newly mounted cell renders as a preview only if the scroll moved more than `FAST_SCROLL_ROWS_PER_FRAME` (3) rows since the last commit. At 120 Hz that is ~13,000 px/s, so ordinary wheel and trackpad scrolling mounts the full `DataGridCell` tree (state, refs, callbacks, presence context) for every new row.
   Idea: since previews look identical to full cells, render previews for any cell mounted while `isScrolling` is true, and upgrade when scrolling settles.

2. **Forced layout during render on every scroll frame.**
   `DataGridViewport` computes `scrollPaddingStart` / `scrollPaddingEnd` from five `getBoundingClientRect()` calls, plus reads `headerRef.current.offsetHeight`, on every render.
   Idea: measure header and footer once with a `ResizeObserver` and keep the values in a ref or state that only changes on resize.

3. **`will-change-transform` on every row.**
   `components/data-grid/data-grid-row.tsx`: each row's `translateY` never changes after mount (rows are keyed by `row.id`), so the hint only creates ~40 extra compositor layers, each rasterized on mount.
   Idea: drop it from rows (keep it only on the `grid-rows` container while pinned). A/B test together with removing `[content-visibility:auto]`, which adds a per-row relevance check for no benefit at a fixed row height.

4. **Synchronous re-renders inside the scroll handler.**
   `rowVirtualizerOptions` only passes `overscan`, so both virtualizers keep the default `useFlushSync: true`.
   Idea: test `useFlushSync: false` on React 19; previews and the deferred value already absorb some lag.

## Smaller items

- `lib/data-grid-utils.ts` `getWindowedColumns`: the leading spacer is keyed `spacer-${windowItem.index}`, so it remounts whenever the column window shifts. Use a fixed key like `spacer-start`.
- ~~`getWindowedColumns` leading spacer key~~ Done: keyed `spacer-start`.
- ~~`selectRowState` / `getVisibleCells()` caching~~ Cleared: table-core 9.2.4 memoizes `row_getVisibleCells` on `[row.getAllCells(), columnPinning, columnVisibility]`.
- ~~Stress demo `COLUMN_COUNT = 50`~~ Done: 100.

## Baseline (2026-10-09, production build, 120 Hz display, 100k x 100)

`pnpm profile:scroll baseline` (`scripts/profile-data-grid-scroll.ts`), traces in `recordings/perf/baseline/`. Frame stats come from an untraced run.

| scenario | fps | p95 ms | p99 ms | max ms | dropped |
| --- | --- | --- | --- | --- | --- |
| slow-wheel | 120.1 | 9.1 | 9.3 | 16.7 | 1 |
| fast-fling | 118.2 | 9.2 | 9.4 | 33.3 | 4 |
| scrollbar-drag | 44.8 | 33.4 | 34.1 | 41.6 | 251 |
| horizontal-wheel | 119.2 | 8.7 | 9.3 | 49.9 | 5 |

Wheel, fling and horizontal scrolling already hold 120 fps. **Scrollbar drag is the outlier at ~45 fps, ~25 ms per frame, evenly spread (no long animation frames).**
Drag trace main thread over ~3 s: scripting ~1.6 s (scroll `EventDispatch`, React commit, `removeChild` / `setAttribute` / `appendChild` / `createElement`, ~100 ms TanStack `memoDeps`), `UpdateLayoutTree` 1.2 s (~5.5 ms/frame), Paint 0.64 s, Layout 0.33 s.
Every drag frame jumps past the whole window, so all rows unmount and remount. Suspects 2–4 and anything that cuts per-mount DOM/style cost (fewer nodes per preview cell, simpler selectors, recycling row elements by slot instead of keying by `row.id`) matter more than suspect 1 here.

## Profiling plan

Profile a production build (`pnpm build && pnpm start`) on real hardware with a 120 Hz display, not a dev build and not a headless cloud browser.

1. Open `/data-grid-stress`.
2. Record three scroll patterns in the Chrome DevTools Performance panel, or script them with Playwright + CDP tracing:
   - slow wheel / trackpad scroll
   - fast fling
   - scrollbar drag from top to bottom
   - plus horizontal scroll across all columns
3. For each, note dropped or long frames and the scripting / layout / paint split per frame, and the top functions in the bottom-up view.
4. Apply one change at a time from the list above and re-record, so each change has before and after numbers.

## Results (2026-10-09, after rebase onto `sadman/data-grid-refactor`)

Machine state swings results a lot (battery vs plugged, background load): the same build measured 45 fps and 28 fps on scrollbar drag an hour apart. Only compare runs made back to back.

| change | scrollbar drag, before → after (back to back) | verdict |
| --- | --- | --- |
| #2 viewport insets via ResizeObserver | 28 → 28 fps | neutral, kept (committed e943fde) |
| #3 drop `will-change-transform` + `content-visibility:auto` on rows (CSS A/B via `EXTRA_CSS`, 2 rounds) | 42–44 → 45.7 fps | small win |
| No row overscan while scroll jumping (2 rounds, alternating builds) | 47 → 63 fps | big win, no blank frames during drag |

Full run with both: slow-wheel 120, fast-fling 118.6, scrollbar-drag 60.6, horizontal 120 fps.
Rows during drag dropped from ~42 to ~30. DOM is already lean (~45 nodes per row, 14 cells with column windowing), so the next lever is per-mount cost: React commit + ~2k node creations + style recalc each drag frame. Candidates: `:has()` selectors on cell wrapper / badge (`has-data-[slot=checkbox]`, `has-data-[icon=…]`) that widen style invalidation on insert, the `**:data-[slot=grid-cell-content]` descendant variant, and rendering drag frames at most every other vsync.

## Selector experiment (STRIP_CSS, same build, 2 rounds, scrollbar drag)

| rules removed at runtime | fps |
| --- | --- |
| none (control) | 61–64 |
| all 68 `:has()` | 63–65, neutral |
| 61 `ltr:` / `rtl:` (`:lang()` lists) | 61–62, neutral |
| 82 `group-*` / `peer-*` | 60–65, neutral |
| 50 `*:` / `**:` variants (`:is(.x *)…`, no rightmost key, so checked against every element) | 71–73.5 |
| only the grid's 4 `**:data-[slot=grid-cell-content]:line-clamp-*` | 62–66, noise |
| the other 46 `*:` / `**:` rules (command, input-group, range, `**:inline`, …) | 69 |

Takeaway: style recalc cost scales with (elements inserted per frame) x (universal-bucket rules in the app's CSS). The second factor belongs to whatever app embeds the grid, so the grid's lever is the first one: fewer elements per cell. Candidate: flatten `DataGridCellPreview` (gridcell > preview div > content span) so previews mount one less element per cell.

## Flattened previews (fd97cd3)

Back to back, 2 rounds x 2 runs: scrollbar drag 61–62 → 64.7–65.4 fps; other scenarios unchanged (~118–120).
Preview vs settled full cells at the same offset are pixel-identical (only the scrollbar thumb and FPS meter differ). Two regressions caught by the pixel check and fixed: URLs need their own clipping box (unbroken text otherwise overflows into padding), and the badge list needs `content-start` when it is the full-height preview element.

Drag progress today: ~47 → ~65 fps. Frames now sit at ~2 vsyncs (p50 16.7 ms).
