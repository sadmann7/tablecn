"use client";

import type { Table } from "@tanstack/react-table";

import { Gauge, Square } from "lucide-react";
import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";
import type { FilterValue, RowHeightValue } from "@/lib/data-grid-types";

import { Button } from "@/registry/bases/radix/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/radix/ui/popover";

import type { Person } from "../lib/seeds";

type PersonTable = Table<DataGridFeatures, Person>;

interface StressContext {
  table: PersonTable;
  grid: HTMLDivElement;
  signal: AbortSignal;
  /** Records how long an update took to reach the next painted frame. */
  measure: (update: () => void) => Promise<void>;
}

interface StressStep {
  name: string;
  run: (ctx: StressContext) => Promise<void>;
}

interface StressResult {
  name: string;
  durationMs: number;
  frames: number;
  fps: number;
  p95FrameMs: number;
  maxFrameMs: number;
  longFrames: number;
  longTaskMs: number;
  /** Slowest time from a state update to the next painted frame, for sort, filter and similar steps. */
  maxUpdateMs: number | null;
}

const LONG_FRAME_MS = 50;

function nextFrame() {
  return new Promise<number>((resolve) => requestAnimationFrame(resolve));
}

async function animate(
  signal: AbortSignal,
  durationMs: number,
  onFrame: (progress: number, frame: number) => void,
) {
  const start = performance.now();
  let frame = 0;
  while (!signal.aborted) {
    const progress = Math.min((performance.now() - start) / durationMs, 1);
    onFrame(progress, frame++);
    if (progress >= 1) break;
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

function filter(id: keyof Person, value: FilterValue) {
  return { id, value };
}

const STRESS_STEPS: StressStep[] = [
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
    name: "Sort + filter + scroll",
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
    name: "Select all + scroll",
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
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
}

async function runStep(
  step: StressStep,
  table: PersonTable,
  grid: HTMLDivElement,
  signal: AbortSignal,
): Promise<StressResult> {
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

function resetGrid(table: PersonTable, grid: HTMLDivElement) {
  table.setSorting([]);
  table.setColumnFilters([]);
  table.closeSearch();
  table.clearSelection();
  table.setRowHeight("short");
  grid.scrollTop = 0;
  grid.scrollLeft = 0;
}

interface DataGridStressTestProps {
  table: PersonTable;
  dataGridRef: React.RefObject<HTMLDivElement | null>;
}

export function DataGridStressTest({
  table,
  dataGridRef,
}: DataGridStressTestProps) {
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<StressResult[]>([]);
  const [currentStep, setCurrentStep] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const onRun = React.useCallback(async () => {
    const grid = dataGridRef.current;
    if (!grid || abortRef.current) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setResults([]);
    resetGrid(table, grid);
    await pause(controller.signal, 5);

    try {
      for (const step of STRESS_STEPS) {
        if (controller.signal.aborted) break;
        setCurrentStep(step.name);
        const result = await runStep(step, table, grid, controller.signal);
        if (controller.signal.aborted) break;
        setResults((prev) => [...prev, result]);
      }
    } finally {
      resetGrid(table, grid);
      abortRef.current = null;
      setCurrentStep(null);
    }
  }, [table, dataGridRef]);

  const onStop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Opening the popover starts a fresh run, so the button is a single click
  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) void onRun();
    },
    [onRun],
  );

  const isRunning = currentStep !== null;
  const totals = React.useMemo(() => {
    if (results.length === 0) return null;
    const frames = results.reduce((sum, result) => sum + result.frames, 0);
    const durationMs = results.reduce(
      (sum, result) => sum + result.durationMs,
      0,
    );
    return {
      fps: (frames * 1000) / durationMs,
      maxFrameMs: Math.max(...results.map((result) => result.maxFrameMs)),
      longFrames: results.reduce((sum, result) => sum + result.longFrames, 0),
      longTaskMs: results.reduce((sum, result) => sum + result.longTaskMs, 0),
    };
  }, [results]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Gauge className="text-muted-foreground" />
          {isRunning
            ? `Stress test ${results.length + 1}/${STRESS_STEPS.length}`
            : "Stress test"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(36rem,calc(100vw-2rem))] gap-3"
        // Keep the popover open while the run scrolls the grid
        onInteractOutside={(event) => {
          if (isRunning) event.preventDefault();
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Stress test</span>
            <span className="text-xs text-muted-foreground">
              {isRunning
                ? `Running ${currentStep} (${results.length + 1}/${STRESS_STEPS.length})`
                : "Scrolls, sorts, filters and searches the grid while measuring frames."}
            </span>
          </div>
          {isRunning ? (
            <Button size="sm" variant="outline" onClick={onStop}>
              <Square />
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={onRun}>
              <Gauge />
              Run again
            </Button>
          )}
        </div>
        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr className="border-b text-end [&>th]:px-1.5 [&>th]:py-1 [&>th]:font-normal">
                  <th className="text-start">Step</th>
                  <th>FPS</th>
                  <th>p95</th>
                  <th>Max</th>
                  <th title={`Frames over ${LONG_FRAME_MS}ms`}>Janks</th>
                  <th title="Main thread time in long tasks">Long tasks</th>
                  <th title="Slowest update to paint">Update</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr
                    key={result.name}
                    className="border-b text-end last:border-0 [&>td]:px-1.5 [&>td]:py-1"
                  >
                    <td className="text-start">{result.name}</td>
                    <td className={getFpsClassName(result.fps)}>
                      {result.fps.toFixed(0)}
                    </td>
                    <td>{formatMs(result.p95FrameMs)}</td>
                    <td>{formatMs(result.maxFrameMs)}</td>
                    <td>{result.longFrames}</td>
                    <td>{formatMs(result.longTaskMs)}</td>
                    <td>
                      {result.maxUpdateMs === null
                        ? "-"
                        : formatMs(result.maxUpdateMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && !isRunning ? (
                <tfoot className="font-medium">
                  <tr className="border-t text-end [&>td]:px-1.5 [&>td]:py-1">
                    <td className="text-start">Total</td>
                    <td className={getFpsClassName(totals.fps)}>
                      {totals.fps.toFixed(0)}
                    </td>
                    <td />
                    <td>{formatMs(totals.maxFrameMs)}</td>
                    <td>{totals.longFrames}</td>
                    <td>{formatMs(totals.longTaskMs)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
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
