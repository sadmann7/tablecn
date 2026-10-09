import { chromium, type CDPSession, type Page } from "@playwright/test";
/**
 * Records scroll performance on /data-grid-stress against a running server.
 *
 * Run against a production build on a real 120 Hz display (headed, not headless):
 *   pnpm build && pnpm start
 *   pnpm profile:scroll <label>
 *
 * Writes a Chrome trace per scenario to recordings/perf/<label>/ (open in the
 * DevTools Performance panel) and prints frame stats. Use a different label per
 * change to compare before and after.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const GRID_SELECTOR = '[data-slot="grid"]';
const TRACE_CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "blink.user_timing",
  "v8.execute",
  "disabled-by-default-v8.cpu_profiler",
  "latencyInfo",
].join(",");

interface Scenario {
  name: string;
  run: (page: Page) => Promise<void>;
}

const scenarios: Scenario[] = [
  {
    // ~40 px per event at ~120 events/s, about 4,800 px/s
    name: "slow-wheel",
    run: (page) => wheel(page, { deltaY: 40, events: 360, intervalMs: 8 }),
  },
  {
    // Strong flick that decays, like a trackpad fling
    name: "fast-fling",
    run: async (page) => {
      for (let delta = 600; delta > 20; delta *= 0.97) {
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(8);
      }
    },
  },
  {
    // Scrollbar drag from top to bottom, driven by scrollTop so it does not depend on overlay scrollbars
    name: "scrollbar-drag",
    run: (page) =>
      page.evaluate(
        ({ selector, durationMs }) =>
          new Promise<void>((resolve) => {
            const grid = document.querySelector<HTMLElement>(selector);
            if (!grid) return resolve();
            const max = grid.scrollHeight - grid.clientHeight;
            const start = performance.now();
            const step = (now: number) => {
              const progress = Math.min((now - start) / durationMs, 1);
              grid.scrollTop = max * progress;
              if (progress < 1) requestAnimationFrame(step);
              else resolve();
            };
            requestAnimationFrame(step);
          }),
        { selector: GRID_SELECTOR, durationMs: 3000 },
      ),
  },
  {
    name: "horizontal-wheel",
    run: (page) => wheel(page, { deltaX: 60, events: 360, intervalMs: 8 }),
  },
];

async function wheel(
  page: Page,
  {
    deltaX = 0,
    deltaY = 0,
    events,
    intervalMs,
  }: { deltaX?: number; deltaY?: number; events: number; intervalMs: number },
) {
  for (let i = 0; i < events; i++) {
    await page.mouse.wheel(deltaX, deltaY);
    await page.waitForTimeout(intervalMs);
  }
}

interface FrameStats {
  frames: number;
  fps: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  droppedFrames: number;
  longAnimationFrames: number;
  loafScriptMs: number;
}

/** Collects rAF deltas and long animation frames until `stopFrameRecorder` is called. */
function startFrameRecorder() {
  const recorder = {
    deltas: [] as number[],
    loafs: [] as Array<{ duration: number; scriptMs: number }>,
    running: true,
  };
  let last = performance.now();
  const tick = (now: number) => {
    recorder.deltas.push(now - last);
    last = now;
    if (recorder.running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const scripts =
        (entry as PerformanceEntry & { scripts?: Array<{ duration: number }> })
          .scripts ?? [];
      recorder.loafs.push({
        duration: entry.duration,
        scriptMs: scripts.reduce((sum, script) => sum + script.duration, 0),
      });
    }
  });
  try {
    observer.observe({ type: "long-animation-frame", buffered: false });
  } catch {
    // Long animation frames are Chromium only
  }
  Object.assign(window, {
    __frameRecorder: recorder,
    __frameObserver: observer,
  });
}

function stopFrameRecorder() {
  const { __frameRecorder: recorder, __frameObserver: observer } =
    window as unknown as {
      __frameRecorder: {
        deltas: number[];
        loafs: Array<{ duration: number; scriptMs: number }>;
        running: boolean;
      };
      __frameObserver: PerformanceObserver;
    };
  recorder.running = false;
  observer.disconnect();
  // The first delta spans the gap before recording started
  return { deltas: recorder.deltas.slice(1), loafs: recorder.loafs };
}

function percentile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
  );
}

/** Median rAF interval while idle, which is the display's vsync interval. */
function measureVsync() {
  return new Promise<number>((resolve) => {
    const deltas: number[] = [];
    let last = performance.now();
    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (deltas.length < 120) requestAnimationFrame(tick);
      else resolve(deltas.slice(1).sort((a, b) => a - b)[59] ?? 0);
    };
    requestAnimationFrame(tick);
  });
}

function summarize(
  deltas: number[],
  loafs: Array<{ duration: number; scriptMs: number }>,
  vsync: number,
): FrameStats {
  const at = (q: number) => percentile(deltas, q);
  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  return {
    frames: deltas.length,
    fps: total > 0 ? (deltas.length * 1000) / total : 0,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    max: Math.max(0, ...deltas),
    // Frames missed beyond one vsync interval
    droppedFrames: deltas.reduce(
      (sum, delta) => sum + Math.max(0, Math.round(delta / vsync) - 1),
      0,
    ),
    longAnimationFrames: loafs.length,
    loafScriptMs: loafs.reduce((sum, loaf) => sum + loaf.scriptMs, 0),
  };
}

async function recordTrace(
  page: Page,
  cdp: CDPSession,
  outFile: string,
  run: () => Promise<void>,
) {
  const events: unknown[] = [];
  const onData = ({ value }: { value: unknown[] }) => events.push(...value);
  cdp.on("Tracing.dataCollected", onData);
  await cdp.send("Tracing.start", {
    traceConfig: { includedCategories: TRACE_CATEGORIES.split(",") },
    transferMode: "ReportEvents",
  });
  // Starting the CPU profiler stalls the page, so keep that out of the scenario
  await page.waitForTimeout(500);
  await run();
  const complete = new Promise<void>((resolve) =>
    cdp.once("Tracing.tracingComplete", () => resolve()),
  );
  await cdp.send("Tracing.end");
  await complete;
  cdp.off("Tracing.dataCollected", onData);
  await writeFile(outFile, JSON.stringify({ traceEvents: events }));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

async function resetScroll(page: Page) {
  await page.evaluate((selector) => {
    const grid = document.querySelector(selector);
    grid?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, GRID_SELECTOR);
  await page.waitForTimeout(500);
}

async function main() {
  const label =
    process.argv[2] ?? new Date().toISOString().replace(/[:.]/g, "-");
  const only = process.argv[3];
  const outDir = path.join("recordings", "perf", label);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const cdp = await page.context().newCDPSession(page);

  // tsx keeps function names via an `__name` helper that page.evaluate does not serialize
  await page.addInitScript("globalThis.__name = (fn) => fn");
  await page.goto(`${BASE_URL}/data-grid-stress`);
  const grid = page.locator(GRID_SELECTOR);
  await grid.waitFor();
  const box = await grid.boundingBox();
  if (!box) throw new Error("Grid has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // Let data generation and the first paint settle
  await page.waitForTimeout(2000);

  const vsync = await page.evaluate(measureVsync);
  console.log(`Display refresh: ${Math.round(1000 / vsync)} Hz`);

  const results: Record<string, FrameStats> = {};
  for (const scenario of scenarios) {
    if (only && scenario.name !== only) continue;

    // Frame stats come from an untraced run, since tracing adds overhead to every frame
    await resetScroll(page);
    await page.evaluate(startFrameRecorder);
    await scenario.run(page);
    // Let the deferred preview upgrade land inside the measurement
    await page.waitForTimeout(300);
    const { deltas, loafs } = await page.evaluate(stopFrameRecorder);
    results[scenario.name] = summarize(deltas, loafs, vsync);

    await resetScroll(page);
    await recordTrace(
      page,
      cdp,
      path.join(outDir, `${scenario.name}.json`),
      async () => {
        await scenario.run(page);
        await page.waitForTimeout(300);
      },
    );
  }

  await browser.close();

  console.table(
    Object.fromEntries(
      Object.entries(results).map(([name, stats]) => [
        name,
        Object.fromEntries(
          Object.entries(stats).map(([key, value]) => [key, round(value)]),
        ),
      ]),
    ),
  );
  await writeFile(
    path.join(outDir, "summary.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(`Traces and summary written to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
