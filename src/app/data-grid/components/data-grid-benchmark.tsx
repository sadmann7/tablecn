"use client";

import type { Table as TanStackTable } from "@tanstack/react-table";

import { Gauge, RotateCcw, Square } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { FilterValue, RowHeightValue } from "@/lib/data-grid-types";

import { getIsDataColumn } from "@/lib/data-grid-utils";
import { Button } from "@/registry/bases/radix/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/registry/bases/radix/ui/dialog";
import { ScrollArea, ScrollBar } from "@/registry/bases/radix/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/registry/bases/radix/ui/table";

import type { Person } from "../lib/seeds";

type PersonTable = TanStackTable<DataGridFeatures, Person>;

interface BenchmarkContext {
  table: PersonTable;
  grid: HTMLDivElement;
  signal: AbortSignal;
  measure: (update: () => void) => Promise<void>;
}

interface BenchmarkStep {
  name: string;
  run: (ctx: BenchmarkContext) => Promise<void>;
}

interface BenchmarkResult {
  name: string;
  durationMs: number;
  frames: number;
  fps: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longFrames: number;
  longTaskMs: number;
  maxUpdateMs: number | null;
}

const LONG_FRAME_MS = 50;

function nextFrame() {
  return new Promise<number>((resolve) => requestAnimationFrame(resolve));
}

async function animate(
  signal: AbortSignal,
  durationMs: number,
  // Returning `true` ends the animation early
  onFrame: (progress: number, frame: number) => boolean | void,
) {
  const start = performance.now();
  let frame = 0;
  while (!signal.aborted) {
    const progress = Math.min((performance.now() - start) / durationMs, 1);
    if (onFrame(progress, frame++) === true || progress >= 1) break;
    await nextFrame();
  }
}

async function pause(signal: AbortSignal, frames: number) {
  for (let i = 0; i < frames && !signal.aborted; i++) await nextFrame();
}

function getMaxScroll(grid: HTMLDivElement) {
  return {
    top: grid.scrollHeight - grid.clientHeight,
    left: grid.scrollWidth - grid.clientWidth,
  };
}

// Deterministic so runs are comparable
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

interface ViewportCell {
  rowId: string;
  columnId: string;
  value: unknown;
  nextValue: unknown;
}

function getViewportCells(table: PersonTable, grid: HTMLDivElement) {
  const rows = table.getRowModel().rows;
  const rowSize = table.getRowSize();
  const firstRow = Math.floor(grid.scrollTop / rowSize);
  const rowCount = Math.ceil(grid.clientHeight / rowSize);

  const columns = [];
  let left = 0;
  for (const column of table.getVisibleLeafColumns()) {
    if (left - grid.scrollLeft > grid.clientWidth) break;
    left += column.getSize();
    if (getIsDataColumn(column) && column.getCanEdit()) columns.push(column);
  }

  const cells: ViewportCell[] = [];
  for (let index = firstRow; index < firstRow + rowCount; index++) {
    const row = rows[index];
    const source = rows[(index + Math.floor(rows.length / 2)) % rows.length];
    if (!row || !source) continue;
    for (const column of columns) {
      cells.push({
        rowId: row.id,
        columnId: column.id,
        value: row.getValue(column.id),
        nextValue: source.getValue(column.id),
      });
    }
  }
  return cells;
}

// The benchmark's edits stay out of undo history
const BENCHMARK_UPDATE = { history: false } as const;

function restoreCells(table: PersonTable, cells: ViewportCell[]) {
  table.updateCells(
    cells.map(({ rowId, columnId, value }) => ({ rowId, columnId, value })),
    BENCHMARK_UPDATE,
  );
}

function filter(id: keyof Person, value: FilterValue) {
  return { id, value };
}

const BENCHMARK_STEPS: BenchmarkStep[] = [
  {
    name: "Wheel scroll",
    run: ({ grid, signal }) =>
      animate(signal, 2000, () => {
        grid.scrollTop += 120;
      }),
  },
  {
    name: "Fast fling",
    run: ({ grid, signal }) =>
      animate(signal, 1500, () => {
        grid.scrollTop += 1500;
      }),
  },
  {
    name: "Scrollbar drag",
    run: async ({ grid, signal }) => {
      await animate(signal, 2000, (progress) => {
        grid.scrollTop = getMaxScroll(grid).top * progress;
      });
      await animate(signal, 1000, (progress) => {
        grid.scrollTop = getMaxScroll(grid).top * (1 - progress);
      });
    },
  },
  {
    name: "Random jumps",
    run: ({ grid, signal }) => {
      const random = createRandom(1);
      return animate(signal, 1500, () => {
        grid.scrollTop = getMaxScroll(grid).top * random();
      });
    },
  },
  {
    name: "Horizontal scroll",
    run: ({ grid, signal }) =>
      animate(signal, 2000, (progress) => {
        const t = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
        grid.scrollLeft = getMaxScroll(grid).left * t;
      }),
  },
  {
    name: "Diagonal scroll",
    run: ({ grid, signal }) =>
      animate(signal, 1500, (progress) => {
        grid.scrollTop += 200;
        grid.scrollLeft =
          getMaxScroll(grid).left * Math.abs(Math.sin(progress * Math.PI * 2));
      }),
  },
  {
    name: "Sort",
    run: async ({ table, grid, signal, measure }) => {
      const sorts = [
        [{ id: "name", desc: false }],
        [{ id: "age", desc: true }],
        [{ id: "salary", desc: false }],
        [{ id: "startDate", desc: true }],
        [
          { id: "department", desc: false },
          { id: "name", desc: false },
        ],
        [{ id: "email", desc: true }],
      ];
      for (const sorting of sorts) {
        if (signal.aborted) return;
        await measure(() => table.setSorting(sorting));
        await animate(signal, 300, () => {
          grid.scrollTop += 400;
        });
      }
      await measure(() => table.setSorting([]));
    },
  },
  {
    name: "Filter",
    run: async ({ table, grid, signal, measure }) => {
      const filterSets = [
        [filter("department", { operator: "is", value: "Engineering" })],
        [filter("age", { operator: "greaterThan", value: 40 })],
        [filter("name", { operator: "contains", value: "an" })],
        [filter("skills", { operator: "isAnyOf", value: ["React", "SQL"] })],
        [
          filter("isActive", { operator: "isTrue" }),
          filter("status", { operator: "isNot", value: "Remote" }),
          filter("salary", {
            operator: "isBetween",
            value: 60000,
            endValue: 120000,
          }),
        ],
      ];
      for (const columnFilters of filterSets) {
        if (signal.aborted) return;
        await measure(() => table.setColumnFilters(columnFilters));
        await animate(signal, 300, () => {
          grid.scrollTop += 400;
        });
      }
      await measure(() => table.setColumnFilters([]));
    },
  },
  {
    name: "Sort, filter, and scroll",
    run: async ({ table, grid, signal, measure }) => {
      await measure(() => {
        table.setColumnFilters([
          filter("department", { operator: "isAnyOf", value: ["Sales", "HR"] }),
        ]);
        table.setSorting([{ id: "salary", desc: true }]);
      });
      await animate(signal, 1500, (progress) => {
        grid.scrollTop = getMaxScroll(grid).top * progress;
      });
      await measure(() => {
        table.setColumnFilters([]);
        table.setSorting([]);
      });
    },
  },
  {
    name: "Search",
    run: async ({ table, signal, measure }) => {
      table.openSearch();
      // Give the search index time to warm up, like a user moving to the input
      await pause(signal, 30);
      for (const query of ["j", "jo", "joh", "john", "jo", "ma", "mar", ""]) {
        if (signal.aborted) break;
        await measure(() => table.setSearchQuery(query));
      }
      table.closeSearch();
    },
  },
  {
    name: "Row height",
    run: async ({ table, grid, signal, measure }) => {
      const heights: RowHeightValue[] = [
        "medium",
        "tall",
        "extra-tall",
        "short",
      ];
      for (const rowHeight of heights) {
        if (signal.aborted) return;
        await measure(() => table.setRowHeight(rowHeight));
        await animate(signal, 400, () => {
          grid.scrollTop += 600;
        });
      }
    },
  },
  {
    name: "Edit viewport cells",
    run: async ({ table, grid, signal }) => {
      const cells = getViewportCells(table, grid);
      try {
        await animate(signal, Number.POSITIVE_INFINITY, (_, frame) => {
          const cell = cells[frame];
          if (!cell) return true;
          table.updateCells(
            { ...cell, value: cell.nextValue },
            BENCHMARK_UPDATE,
          );
        });
      } finally {
        restoreCells(table, cells);
      }
    },
  },
  {
    name: "Bulk edit viewport cells",
    run: async ({ table, grid, measure }) => {
      const cells = getViewportCells(table, grid);
      await measure(() =>
        table.updateCells(
          cells.map((cell) => ({ ...cell, value: cell.nextValue })),
          BENCHMARK_UPDATE,
        ),
      );
      await measure(() => restoreCells(table, cells));
    },
  },
  {
    name: "Select all and scroll",
    run: async ({ table, grid, signal, measure }) => {
      await measure(() => table.selectAllDataCells());
      await animate(signal, 1000, () => {
        grid.scrollTop += 800;
      });
      await measure(() => table.clearSelection());
    },
  },
];

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
  );
}

async function runStep(
  step: BenchmarkStep,
  table: PersonTable,
  grid: HTMLDivElement,
  signal: AbortSignal,
): Promise<BenchmarkResult> {
  const frameTimes: number[] = [];
  const updateTimes: number[] = [];
  let longTaskMs = 0;
  const sampler = { running: true };

  let observer: PerformanceObserver | undefined;
  if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTaskMs += entry.duration;
    });
    observer.observe({ type: "longtask" });
  }

  let last = await nextFrame();
  const start = last;
  const sampleFrames = async () => {
    while (sampler.running) {
      const now = await nextFrame();
      frameTimes.push(now - last);
      last = now;
    }
  };
  const sampling = sampleFrames();

  const measure = async (update: () => void) => {
    const updateStart = performance.now();
    update();
    // The second frame callback runs after the update has painted
    await nextFrame();
    await nextFrame();
    updateTimes.push(performance.now() - updateStart);
  };

  try {
    await step.run({ table, grid, signal, measure });
    await pause(signal, 2);
  } finally {
    sampler.running = false;
    await sampling;
    observer?.disconnect();
  }

  const durationMs = last - start;
  return {
    name: step.name,
    durationMs,
    frames: frameTimes.length,
    fps: durationMs > 0 ? (frameTimes.length * 1000) / durationMs : 0,
    p95FrameMs: percentile(frameTimes, 0.95),
    maxFrameMs: Math.max(0, ...frameTimes),
    longFrames: frameTimes.filter((time) => time > LONG_FRAME_MS).length,
    longTaskMs,
    maxUpdateMs: updateTimes.length > 0 ? Math.max(...updateTimes) : null,
  };
}

interface GridSnapshot {
  cellSelection: ReturnType<PersonTable["atoms"]["cellSelection"]["get"]>;
  activeElement: Element | null;
}

function getGridSnapshot(table: PersonTable): GridSnapshot {
  return {
    cellSelection: table.atoms.cellSelection.get(),
    activeElement: document.activeElement,
  };
}

// Search and edits focus cells along the way, so the selection and focus from before the run come back
function restoreGridSnapshot(
  table: PersonTable,
  grid: HTMLDivElement,
  snapshot: GridSnapshot,
) {
  table.setCellSelection(snapshot.cellSelection);
  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLElement &&
    grid.contains(activeElement) &&
    !grid.contains(snapshot.activeElement)
  ) {
    activeElement.blur();
  }
}

function resetGrid(table: PersonTable, grid: HTMLDivElement) {
  table.setSorting([]);
  table.setColumnFilters([]);
  table.closeSearch();
  table.clearSelection();
  table.setRowHeight("short");
  grid.scrollTop = 0;
  grid.scrollLeft = 0;
}

function getTotals(results: BenchmarkResult[]) {
  if (results.length === 0) return null;
  const frames = results.reduce((sum, result) => sum + result.frames, 0);
  const durationMs = results.reduce(
    (sum, result) => sum + result.durationMs,
    0,
  );
  const slowest = results.reduce((worst, result) =>
    result.maxFrameMs > worst.maxFrameMs ? result : worst,
  );
  return {
    fps: durationMs > 0 ? (frames * 1000) / durationMs : 0,
    maxFrameMs: slowest.maxFrameMs,
    slowestStep: slowest.name,
    longFrames: results.reduce((sum, result) => sum + result.longFrames, 0),
    longTaskMs: results.reduce((sum, result) => sum + result.longTaskMs, 0),
  };
}

interface DataGridBenchmarkProps {
  table: PersonTable;
  dataGridRef: React.RefObject<HTMLDivElement | null>;
}

export function DataGridBenchmark({
  table,
  dataGridRef,
}: DataGridBenchmarkProps) {
  const [results, setResults] = React.useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);
  const [isResultsOpen, setIsResultsOpen] = React.useState(false);
  const [rerunStep, setRerunStep] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  // Sonner ignores updates to a dismissed toast, so every run gets its own toast id
  const toastIdRef = React.useRef("");

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      toast.dismiss(toastIdRef.current);
    },
    [],
  );

  const onStop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const showProgress = React.useCallback(
    (title: string, description: string) => {
      // One toast updated in place keeps the grid visible while the run drives it
      toast.loading(title, {
        id: toastIdRef.current,
        description,
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: "Stop",
          onClick: (event) => {
            // The summary replaces this toast, which sonner ignores once it is dismissed
            event.preventDefault();
            onStop();
          },
        },
      });
    },
    [onStop],
  );

  const onRun = React.useCallback(async () => {
    const grid = dataGridRef.current;
    if (!grid || abortRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;
    toast.dismiss(toastIdRef.current);
    toastIdRef.current = `benchmark-${Date.now()}`;
    const runResults: BenchmarkResult[] = [];
    setResults([]);
    setRerunStep(null);
    setIsResultsOpen(false);
    setIsRunning(true);
    const snapshot = getGridSnapshot(table);
    resetGrid(table, grid);
    await pause(controller.signal, 5);

    try {
      for (const [index, step] of BENCHMARK_STEPS.entries()) {
        if (controller.signal.aborted) break;
        const previous = runResults.at(-1);
        showProgress(
          `Running ${step.name} · ${index + 1}/${BENCHMARK_STEPS.length}`,
          previous
            ? `${previous.name}: ${previous.fps.toFixed(0)} fps, ${formatMs(previous.maxFrameMs)} slowest frame`
            : "Scrolling, sorting, filtering and searching the grid",
        );
        const result = await runStep(step, table, grid, controller.signal);
        if (controller.signal.aborted) break;
        runResults.push(result);
        setResults([...runResults]);
      }
    } finally {
      resetGrid(table, grid);
      restoreGridSnapshot(table, grid, snapshot);
      abortRef.current = null;
      setIsRunning(false);
    }

    const totals = getTotals(runResults);
    if (!totals) {
      toast("Benchmark stopped", { id: toastIdRef.current, duration: 3000 });
      return;
    }

    toast(
      controller.signal.aborted
        ? `Benchmark stopped · ${runResults.length}/${BENCHMARK_STEPS.length}`
        : "Benchmark finished",
      {
        id: toastIdRef.current,
        description: (
          <div className="flex flex-col tabular-nums">
            <span>
              {totals.fps.toFixed(0)} fps · {formatMs(totals.maxFrameMs)}{" "}
              slowest frame · {totals.longFrames} janks
            </span>
            <span>Slowest step: {totals.slowestStep}</span>
          </div>
        ),
        duration: Number.POSITIVE_INFINITY,
        closeButton: true,
        action: {
          label: "View results",
          onClick: () => setIsResultsOpen(true),
        },
      },
    );
  }, [table, dataGridRef, showProgress]);

  const onRerunStep = React.useCallback(
    async (name: string) => {
      const grid = dataGridRef.current;
      const step = BENCHMARK_STEPS.find((item) => item.name === name);
      if (!grid || !step || abortRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;
      toastIdRef.current = `benchmark-${Date.now()}`;
      // The dialog would cover the grid and its paint would skew the frames
      setIsResultsOpen(false);
      setIsRunning(true);
      setRerunStep(name);
      const snapshot = getGridSnapshot(table);
      resetGrid(table, grid);
      await pause(controller.signal, 5);

      let result: BenchmarkResult | null = null;
      try {
        showProgress(
          `Rerunning ${name}`,
          "Results open again when it finishes",
        );
        result = await runStep(step, table, grid, controller.signal);
      } finally {
        resetGrid(table, grid);
        restoreGridSnapshot(table, grid, snapshot);
        abortRef.current = null;
        setIsRunning(false);
      }

      const nextResult = controller.signal.aborted ? null : result;
      if (nextResult) {
        setResults((prev) =>
          prev.map((item) => (item.name === name ? nextResult : item)),
        );
      }
      toast.dismiss(toastIdRef.current);
      setIsResultsOpen(true);
    },
    [table, dataGridRef, showProgress],
  );

  const totals = React.useMemo(() => getTotals(results), [results]);

  return (
    <>
      <Button
        variant="outline"
        onClick={isRunning ? onStop : () => void onRun()}
      >
        {isRunning ? (
          <Square className="text-muted-foreground" />
        ) : (
          <Gauge className="text-muted-foreground" />
        )}
        {isRunning ? "Stop" : "Benchmark"}
      </Button>
      <Dialog open={isResultsOpen} onOpenChange={setIsResultsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Benchmark results</DialogTitle>
            <DialogDescription>
              Frame times while the grid scrolls, sorts, filters, searches and
              edits {table.getCoreRowModel().rows.length.toLocaleString()} rows.
            </DialogDescription>
          </DialogHeader>
          {/* The table container's own overflow would capture the sticky header, so the scroll area scrolls both ways */}
          <ScrollArea className="rounded-md border *:data-[slot=scroll-area-viewport]:max-h-[min(60vh,32rem)] **:data-[slot=table-container]:overflow-visible">
            <Table className="text-xs tabular-nums">
              {/* Collapsed table borders scroll with the body, so the sticky header draws its divider as a shadow */}
              <TableHeader className="sticky top-0 z-10 bg-background [&_tr]:border-b-0">
                <TableRow className="hover:bg-transparent [&>th]:h-8 [&>th]:px-2 [&>th]:text-end [&>th]:font-normal [&>th]:text-muted-foreground [&>th]:shadow-[inset_0_-1px_0_var(--color-border)]">
                  <TableHead className="text-start!">Step</TableHead>
                  <TableHead>FPS</TableHead>
                  <TableHead title="95% of frames were at least this fast">
                    p95
                  </TableHead>
                  <TableHead title="Slowest frame">Max</TableHead>
                  <TableHead title={`Frames over ${LONG_FRAME_MS}ms`}>
                    Janks
                  </TableHead>
                  <TableHead title="Main thread time in long tasks">
                    Long tasks
                  </TableHead>
                  <TableHead title="Slowest update to paint">Update</TableHead>
                  <TableHead className="w-8">
                    <span className="sr-only">Rerun</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow
                    key={result.name}
                    data-state={
                      result.name === rerunStep ? "selected" : undefined
                    }
                    className="text-end hover:bg-transparent [&>td]:px-2 [&>td]:py-1"
                  >
                    <TableCell className="text-start">{result.name}</TableCell>
                    <TableCell className={getFpsClassName(result.fps)}>
                      {result.fps.toFixed(0)}
                    </TableCell>
                    <TableCell>{formatMs(result.p95FrameMs)}</TableCell>
                    <TableCell>{formatMs(result.maxFrameMs)}</TableCell>
                    <TableCell>{result.longFrames}</TableCell>
                    <TableCell>{formatMs(result.longTaskMs)}</TableCell>
                    <TableCell>
                      {result.maxUpdateMs === null
                        ? "-"
                        : formatMs(result.maxUpdateMs)}
                    </TableCell>
                    <TableCell>
                      <Button
                        aria-label={`Rerun ${result.name}`}
                        title={`Rerun ${result.name}`}
                        variant="ghost"
                        size="icon-xs"
                        disabled={isRunning}
                        onClick={() => void onRerunStep(result.name)}
                      >
                        <RotateCcw />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {totals ? (
                <TableFooter>
                  <TableRow className="text-end hover:bg-transparent [&>td]:px-2 [&>td]:py-1.5">
                    <TableCell className="text-start">Total</TableCell>
                    <TableCell className={getFpsClassName(totals.fps)}>
                      {totals.fps.toFixed(0)}
                    </TableCell>
                    <TableCell />
                    <TableCell>{formatMs(totals.maxFrameMs)}</TableCell>
                    <TableCell>{totals.longFrames}</TableCell>
                    <TableCell>{formatMs(totals.longTaskMs)}</TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatMs(value: number) {
  return `${value.toFixed(value < 10 ? 1 : 0)}ms`;
}

function getFpsClassName(fps: number) {
  if (fps >= 55) return "text-emerald-600 dark:text-emerald-400";
  if (fps >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
