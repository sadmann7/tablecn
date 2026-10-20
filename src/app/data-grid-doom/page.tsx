"use client";

import type { ColumnDef } from "@tanstack/react-table";

import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { useMounted } from "@/hooks/use-mounted";
import { useValueAsRef } from "@/hooks/use-value-as-ref";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { Button } from "@/registry/bases/radix/ui/button";

// DOOM rendered through the data grid, one cell per sampled pixel.
// The engine is diekmann/wasm-fizzbuzz (vanilla DOOM compiled to wasm32 with the shareware WAD embedded), loaded at runtime and never bundled.
// Query params: res=40|64|80|106|128|160|192|320 (columns, 16:10), mode=data|dom|gradient, source=doom|plasma, damage (plasma only), auto=1 to expose measurements
// Native 320 defaults to gradient mode: 64,000 per-cell style writes cap out well under 10 fps, while one
// run-length-encoded linear-gradient per row keeps the whole screen under 200 writes a frame. An adaptive
// per-frame row budget keeps the frame rate up on large screens by refreshing the picture progressively.

const DOOM_WASM_URL = "https://diekmann.github.io/wasm-fizzbuzz/doom/doom.wasm";
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 400;
const CELL_SIZE = 36;
const RESOLUTIONS = [40, 64, 80, 106, 128, 160, 192, 320] as const;
const NATIVE_RESOLUTION = 320;

type PixelRow = { id: string } & Record<string, number | string>;

interface DoomEngine {
  pixels: () => Uint8ClampedArray | null;
  frame: () => number;
  step: () => void;
  key: (pressed: boolean, keyCode: number) => void;
  /** Mouse button bits (1 fires). The port ignores mouse movement, so there's no mouse turning. */
  mouse: (buttons: number) => void;
}

let enginePromise: Promise<DoomEngine> | null = null;

function noop() {}

// One engine per page load: DOOM keeps global state, so it can't be instantiated twice in the same memory
function loadDoom(): Promise<DoomEngine> {
  enginePromise ??= (async () => {
    const memory = new WebAssembly.Memory({ initial: 108 });
    let screen: Uint8ClampedArray | null = null;
    let frame = 0;
    const { instance } = await WebAssembly.instantiateStreaming(
      fetch(DOOM_WASM_URL),
      {
        js: {
          js_console_log: noop,
          js_stdout: noop,
          js_stderr: noop,
          js_milliseconds_since_start: () => performance.now(),
          js_draw_screen: (pointer: number) => {
            screen = new Uint8ClampedArray(
              memory.buffer,
              pointer,
              SCREEN_WIDTH * SCREEN_HEIGHT * 4,
            );
            frame++;
          },
        },
        env: { memory },
      },
    );
    const exports = instance.exports as {
      main: () => void;
      doom_loop_step: () => void;
      add_browser_event: (type: number, key: number) => void;
    };
    exports.main();
    return {
      pixels: () => screen,
      frame: () => frame,
      step: () => {
        exports.doom_loop_step();
      },
      key: (pressed, keyCode) => {
        exports.add_browser_event(pressed ? 0 : 1, keyCode);
      },
      mouse: (buttons) => {
        exports.add_browser_event(2, buttons);
      },
    };
  })();
  return enginePromise;
}

// The modern re-releases' scheme on top of DOOM's own: WASD with A/D strafing
// and E to use, as in the official Unity and KEX ports and the GZDoom family.
// Fire stays on click and Ctrl, DOOM's own binding. Keyed by the physical key
// (KeyboardEvent.code), so WASD stays put on non-QWERTY layouts
const EXTRA_KEY_CODES: Record<string, number> = {
  KeyW: 173, // Forward, like the up arrow
  KeyS: 175, // Back, like the down arrow
  KeyA: 44, // Strafe left, DOOM's ","
  KeyD: 46, // Strafe right, DOOM's "."
  KeyE: 32, // Use, like Space
};

// Keyboard Lock API, Chromium only
function getKeyboard() {
  return (
    navigator as Navigator & {
      keyboard?: {
        lock: (keys: string[]) => Promise<void>;
        unlock: () => void;
      };
    }
  ).keyboard;
}

// DOOM resets a cheat on any key outside its sequence, so remapped letters would break them.
// The page spots cheats itself and replays them as plain letters instead.
const CHEAT_PATTERN =
  /id(?:dqd|kfa|fa|spispopd|clip|choppers|dt|mypos|behold[vsiral]?|clev\d\d)$/u;
const KEY_RSHIFT = 182;
const KEY_F1 = 187;

// KeyboardEvent.key names to DOOM's key codes (doomdef.h)
const DOOM_KEY_CODES: Record<string, number> = {
  Backspace: 127,
  Shift: KEY_RSHIFT,
  Control: 157,
  Alt: 184,
  ArrowLeft: 172,
  ArrowUp: 173,
  ArrowRight: 174,
  ArrowDown: 175,
  Escape: 27,
  Enter: 13,
  Tab: 9,
  " ": 32,
};

// DOOM takes printable keys as lowercase ASCII and function keys from its own range
function getDoomKeyCode(event: KeyboardEvent) {
  const named = DOOM_KEY_CODES[event.key];
  if (named !== undefined) return named;
  if (event.key.length === 1) {
    return event.key.toLowerCase().codePointAt(0) ?? null;
  }
  const functionKey = /^F(?<index>1[0-2]|[1-9])$/u.exec(event.key);
  if (functionKey) return KEY_F1 + Number(functionKey.groups?.index) - 1;
  return null;
}

function plasma(x: number, y: number, t: number) {
  const v =
    Math.sin(x * 0.17 + t) +
    Math.sin(y * 0.13 + t * 1.3) +
    Math.sin((x + y) * 0.11 + t * 0.7) +
    Math.sin(Math.hypot(x - 40, y - 25) * 0.2 - t * 1.7);
  const i = Math.floor(((v + 4) / 8) * 255) & 255;
  const r = Math.round(128 + 127 * Math.sin((i / 256) * Math.PI * 2));
  const g = Math.round(128 + 127 * Math.sin((i / 256) * Math.PI * 2 + 2));
  const b = Math.round(128 + 127 * Math.sin((i / 256) * Math.PI * 2 + 4));
  return (r << 16) | (g << 8) | b;
}

const colorCache = new Map<number, string>();
function toColor(rgb: number) {
  let color = colorCache.get(rgb);
  if (color === undefined) {
    color = `#${rgb.toString(16).padStart(6, "0")}`;
    colorCache.set(rgb, color);
  }
  return color;
}

function getParams() {
  const params = new URLSearchParams(window.location.search);
  const res = Number(params.get("res") ?? NATIVE_RESOLUTION);
  const columns = (RESOLUTIONS as readonly number[]).includes(res)
    ? res
    : NATIVE_RESOLUTION;
  const modeParam = params.get("mode");
  const mode =
    modeParam === "data" || modeParam === "dom" || modeParam === "gradient"
      ? modeParam
      : columns === NATIVE_RESOLUTION
        ? "gradient"
        : "dom";
  return {
    columns,
    mode,
    // Resolution links keep an explicit mode but let the per-resolution default apply otherwise
    modeParam: mode === modeParam ? modeParam : null,
    source: params.get("source") === "plasma" ? "plasma" : "doom",
    damage: Number(params.get("damage") ?? 1),
    auto: params.get("auto") === "1",
  } as const;
}

export default function DataGridDoomPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return <DoomGrid {...getParams()} />;
}

function DoomGrid({
  columns: width,
  mode,
  modeParam,
  source,
  damage,
  auto,
}: ReturnType<typeof getParams>) {
  const height = Math.round((width * SCREEN_HEIGHT) / SCREEN_WIDTH);
  const [frame, setFrame] = React.useState<PixelRow[]>(() =>
    Array.from({ length: height }, (_, y) => {
      const row: PixelRow = { id: `r${y}` };
      for (let x = 0; x < width; x++) row[`c${x}`] = 0;
      return row;
    }),
  );
  const frameRef = useValueAsRef(frame);
  const [isReady, setIsReady] = React.useState(source !== "doom");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  // The stage and loading overlay paint first; the grid, tens of thousands of
  // cells at higher resolutions, mounts a tick later instead of blanking the page
  const [showGrid, setShowGrid] = React.useState(false);
  React.useEffect(() => {
    // Double rAF so the stage gets one painted frame before the heavy mount
    let secondId = 0;
    const firstId = requestAnimationFrame(() => {
      secondId = requestAnimationFrame(() => {
        setShowGrid(true);
      });
    });
    return () => {
      cancelAnimationFrame(firstId);
      cancelAnimationFrame(secondId);
    };
  }, []);
  const [stats, setStats] = React.useState({ paints: 0, engine: 0 });

  const columns = React.useMemo<ColumnDef<DataGridFeatures, PixelRow>[]>(
    () =>
      Array.from({ length: width }, (_, x) => ({
        id: `c${x}`,
        accessorKey: `c${x}`,
        // A function header makes this a utility column, which renders `cell` as is
        header: () => null,
        size: CELL_SIZE,
        minSize: CELL_SIZE,
        maxSize: CELL_SIZE,
        // Direct writes color the grid's own cell element, so each pixel is one element less
        cell:
          mode === "data"
            ? ({ getValue }) => (
                <div
                  data-pixel=""
                  className="absolute inset-0"
                  style={{ backgroundColor: toColor(getValue() as number) }}
                />
              )
            : () => null,
      })),
    [width, mode],
  );

  const { table, ...dataGridProps } = useDataGrid({
    data: frame,
    columns,
    getRowId: (row) => row.id,
    readOnly: true,
  });

  const fullscreenRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [viewport, setViewport] = React.useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  React.useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    const onFullscreenChange = () => {
      const isActive = document.fullscreenElement === fullscreenRef.current;
      setIsFullscreen(isActive);
      if (!isActive) getKeyboard()?.unlock();
      onResize();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const onFullscreen = React.useCallback(async () => {
    setIsPlaying(true);
    await fullscreenRef.current?.requestFullscreen();
    // Browsers exit fullscreen on Esc, but DOOM needs it for menus: where supported, holding Esc exits instead
    await getKeyboard()
      ?.lock(["Escape"])
      .catch(() => {});
  }, []);

  // Alt+Enter (Option+Enter on macOS) toggles fullscreen, the classic PC game shortcut
  React.useEffect(() => {
    if (source !== "doom") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      if (document.fullscreenElement) void document.exitFullscreen();
      else void onFullscreen();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [source, onFullscreen]);

  // Left click fires; caught before the grid so it doesn't select cells
  const onPointerFire = React.useCallback(
    (event: React.PointerEvent) => {
      if (!isPlaying || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const buttons = event.type === "pointerdown" ? 1 : 0;
      void loadDoom().then((engine) => {
        engine.mouse(buttons);
      });
    },
    [isPlaying],
  );

  // Play mode takes the keyboard before the grid's own navigation sees it
  React.useEffect(() => {
    if (!isPlaying || source !== "doom") return;
    let engine: DoomEngine | null = null;
    void loadDoom().then((loaded) => {
      engine = loaded;
    });
    let typed = "";
    const onKey = (event: KeyboardEvent) => {
      if (!engine || event.metaKey) return;
      // Alt+Enter is the fullscreen shortcut, not game input
      if (event.altKey && event.key === "Enter") return;
      const pressed = event.type === "keydown";
      const keyCode = EXTRA_KEY_CODES[event.code] ?? getDoomKeyCode(event);
      if (keyCode !== null) engine.key(pressed, keyCode);
      if (pressed && /^[a-z0-9]$/iu.test(event.key)) {
        typed = (typed + event.key.toLowerCase()).slice(-12);
        const cheat = CHEAT_PATTERN.exec(typed)?.[0];
        if (cheat) {
          typed = "";
          // Any key outside the sequence resets DOOM's matcher, then the cheat goes in clean
          for (const key of [
            KEY_RSHIFT,
            ...cheat.split("").map((c) => c.codePointAt(0) ?? 0),
          ]) {
            engine.key(true, key);
            engine.key(false, key);
          }
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, [isPlaying, source]);

  React.useEffect(() => {
    if (!showGrid) return;
    let rafId = 0;
    let disposed = false;
    let engine: DoomEngine | null = null;
    let lastEngineFrame = -1;
    let tick = 0;
    let paints = 0;
    let engineFrames = 0;
    let pixels: HTMLElement[][] | null = null;
    let rowElements: HTMLElement[] | null = null;
    // Gradient mode paints at most `rowBudget` rows per frame, round-robin, carrying the
    // rest over: on screens where rastering every row would blow the frame budget, the
    // frame rate holds and the picture refreshes progressively instead
    const pendingRows = new Uint8Array(height);
    let pendingCount = 0;
    let rowBudget = height;
    // Raster-health cap on the per-frame budget, shrunk when frames run slow
    let budgetCap = height;
    let paintCursor = 0;
    let deltaEma = 0;
    let vsyncMs = 1000 / 60;
    // Gradient stop positions, precomputed: percentages survive zoom and fullscreen scaling
    const stops = Array.from(
      { length: width + 1 },
      (_, x) => `${((x * 100) / width).toFixed(2)}%`,
    );
    const current = new Int32Array(width * height).fill(-1);
    // Cells whose color changed since the last paint, so direct writes skip the rest
    const dirty = new Uint8Array(width * height);
    const deltas: number[] = [];
    let last = 0;
    let measureStart = 0;
    let statsAt = performance.now();
    // 4 bits per channel from 160 columns up, where cells are too small to show the banding and every write counts
    const colorMask = width >= 160 ? 0xf0 : 0xf8;
    const stepX = SCREEN_WIDTH / width;
    const stepY = SCREEN_HEIGHT / height;
    const changedRows = Math.max(1, Math.round(height * damage));

    const collectPixels = () => {
      const result: HTMLElement[][] = [];
      for (const cell of document.querySelectorAll<HTMLElement>(
        '[role="grid"] [data-slot="data-grid-cell-wrapper"]',
      )) {
        const y = Number(cell.dataset.rowId?.slice(1));
        const x = Number(cell.dataset.columnId?.slice(1));
        (result[y] ??= [])[x] = cell;
      }
      return result;
    };

    const collectRows = () => {
      const result: HTMLElement[] = [];
      for (const row of document.querySelectorAll<HTMLElement>(
        '[role="grid"] [data-slot="data-grid-row"]',
      )) {
        const index = Number(row.dataset.index);
        if (Number.isInteger(index)) result[index] = row;
      }
      return result;
    };

    // One scanline as a hard-stop gradient, run-length encoded: DOOM's flats and the
    // 4-bit color mask leave long runs, so most rows need far fewer than `width` stops
    const buildRowGradient = (y: number) => {
      const offset = y * width;
      const parts: string[] = [];
      let runColor = current[offset] ?? -1;
      let runStart = 0;
      for (let x = 1; x <= width; x++) {
        dirty[offset + x - 1] = 0;
        const color = x < width ? (current[offset + x] ?? -1) : -1;
        if (color === runColor) continue;
        parts.push(`${toColor(runColor)} ${stops[runStart]} ${stops[x]}`);
        runColor = color;
        runStart = x;
      }
      return `linear-gradient(90deg,${parts.join(",")})`;
    };

    // Samples the source into `current`, returning the rows that changed
    const sample = (): number[] => {
      const changed: number[] = [];
      if (source === "plasma") {
        const first = (tick * changedRows) % height;
        for (let i = 0; i < changedRows; i++) {
          const y = (first + i) % height;
          for (let x = 0; x < width; x++) {
            current[y * width + x] = plasma(x, y, tick * 0.08);
            dirty[y * width + x] = 1;
          }
          changed.push(y);
        }
        return changed;
      }
      const screen = engine?.pixels();
      if (!screen) return changed;
      for (let y = 0; y < height; y++) {
        const y0 = Math.floor(y * stepY);
        const y1 = Math.max(y0 + 1, Math.floor((y + 1) * stepY));
        let rowChanged = false;
        for (let x = 0; x < width; x++) {
          const x0 = Math.floor(x * stepX);
          const x1 = Math.max(x0 + 1, Math.floor((x + 1) * stepX));
          // Averages the block so thin details like menu text survive; the frame is 320x200 doubled, so every other pixel is enough
          let r = 0;
          let g = 0;
          let b = 0;
          let n = 0;
          for (let sy = y0; sy < y1; sy += 2) {
            for (let sx = x0; sx < x1; sx += 2) {
              const i = (sy * SCREEN_WIDTH + sx) * 4;
              r += screen[i] ?? 0;
              g += screen[i + 1] ?? 0;
              b += screen[i + 2] ?? 0;
              n++;
            }
          }
          // Rounding means tiny shifts in an average don't count as a changed pixel
          const rgb =
            (((r / n) & colorMask) << 16) |
            (((g / n) & colorMask) << 8) |
            ((b / n) & colorMask);
          const index = y * width + x;
          if (current[index] !== rgb) {
            current[index] = rgb;
            dirty[index] = 1;
            rowChanged = true;
          }
        }
        if (rowChanged) changed.push(y);
      }
      return changed;
    };

    const paintRow = (y: number) => {
      if (mode === "gradient") {
        rowElements ??= collectRows();
        const row = rowElements[y];
        if (row) row.style.backgroundImage = buildRowGradient(y);
        return;
      }
      pixels ??= collectPixels();
      const row = pixels[y];
      if (!row) return;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!dirty[index]) continue;
        dirty[index] = 0;
        const pixel = row[x];
        if (pixel) pixel.style.backgroundColor = toColor(current[index] ?? -1);
      }
    };

    const paint = (changed: number[]) => {
      if (mode === "data") {
        if (changed.length === 0) return;
        paints++;
        const next = frameRef.current.slice();
        for (const y of changed) {
          const row: PixelRow = { id: `r${y}` };
          for (let x = 0; x < width; x++) {
            row[`c${x}`] = current[y * width + x] ?? -1;
          }
          next[y] = row;
        }
        setFrame(next);
        return;
      }
      for (const y of changed) {
        if (!pendingRows[y]) {
          pendingRows[y] = 1;
          pendingCount++;
        }
      }
      let painted = 0;
      const cursor = paintCursor;
      for (let i = 0; i < height && painted < rowBudget; i++) {
        const y = (cursor + i) % height;
        if (!pendingRows[y]) continue;
        pendingRows[y] = 0;
        pendingCount--;
        paintRow(y);
        painted++;
        paintCursor = (y + 1) % height;
      }
      // Drain-only calls don't count, so the counter reads as complete frames a second
      if (changed.length > 0) paints++;
    };

    const step = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(step);
      if (last) {
        const delta = now - last;
        deltas.push(delta);
        // Hold ~30fps by painting fewer rows per frame when raster runs slow
        // (big windows, fullscreen); paint everything again once frames are cheap.
        // Smoothed, with slow growth, so a 120Hz display's cheap frames between
        // heavy ones don't swing the budget into a stutter
        if (mode !== "data") {
          deltaEma = deltaEma === 0 ? delta : deltaEma * 0.8 + delta * 0.2;
          // The shortest recent delta approximates the display's vsync period
          vsyncMs = Math.min(vsyncMs * 1.02, Math.max(2, delta));
          if (deltaEma > 34) budgetCap = Math.max(16, (budgetCap * 7) >> 3);
          else if (deltaEma < 24) budgetCap = Math.min(height, budgetCap + 2);
        }
      }
      last = now;
      tick++;

      if (source === "doom") {
        if (!engine) return;
        engine.step();
        const engineFrame = engine.frame();
        if (engineFrame === lastEngineFrame) {
          // The display runs faster than DOOM's 35Hz, so the frames in between
          // drain rows the budget carried over, keeping every batch small
          if (mode !== "data") paint([]);
          return;
        }
        engineFrames += engineFrame - Math.max(lastEngineFrame, 0);
        lastEngineFrame = engineFrame;
        // A torn picture looks worse than a skipped frame: while rows of the
        // last sampled frame are still pending, drain them and skip this one.
        // Only for gradient mode: dom mode repaints so slowly that coherent
        // frames would be a slideshow, and its visible scan is part of the show
        if (mode === "gradient" && pendingCount > 0) {
          paint([]);
          return;
        }
      }
      const changed = sample();
      if (mode !== "data" && changed.length > 0) {
        // Split each frame's rows across the display frames before the next
        // 35Hz engine frame, so every batch fits a vsync slot and the frame
        // still completes in time, bounded by the raster-health cap
        const idleSlots = Math.max(1, Math.floor(1000 / 35 / vsyncMs) - 1);
        rowBudget = Math.min(
          budgetCap,
          Math.max(16, Math.ceil(changed.length / idleSlots)),
        );
      }
      paint(changed);

      if (now - statsAt >= 1000) {
        setStats({
          paints: Math.round((paints * 1000) / (now - statsAt)),
          engine: Math.round((engineFrames * 1000) / (now - statsAt)),
        });
        paints = 0;
        engineFrames = 0;
        statsAt = now;
      }

      if (auto && measureStart && now - measureStart > 8000) {
        const sorted = [...deltas].sort((a, b) => a - b);
        const total = deltas.reduce((sum, d) => sum + d, 0);
        Object.assign(window, {
          __doomBench: {
            source,
            mode,
            size: `${width}x${height}`,
            fps: Math.round((deltas.length * 1000) / total),
            p95:
              Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) /
              10,
          },
        });
      }
    };

    const start = () => {
      // Let the grid mount and measure first
      setTimeout(() => {
        if (disposed) return;
        measureStart = performance.now() + 1500;
        rafId = requestAnimationFrame(step);
        setTimeout(() => {
          deltas.length = 0;
        }, 1500);
      }, 500);
    };

    if (source === "doom") {
      loadDoom()
        .then((loaded) => {
          engine = loaded;
          setIsReady(true);
          start();
        })
        .catch((error: unknown) => {
          setLoadError(String(error));
        });
    } else {
      start();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  }, [showGrid, width, height, mode, source, damage, auto, frameRef]);

  const gridWidth = width * CELL_SIZE + 2;
  const gridHeight = (height + 1) * CELL_SIZE + 2;
  const fit = isFullscreen
    ? Math.min(viewport.width / gridWidth, viewport.height / gridHeight)
    : Math.min(
        1,
        (viewport.width - 32) / gridWidth,
        // Leaves room for the nav above and the option bar and attribution below
        (viewport.height - 128) / gridHeight,
      );
  // Whole-pixel cells: fractional ones leave anti-aliased seams that read as grid lines
  const zoom = Math.max(1, Math.floor(CELL_SIZE * fit)) / CELL_SIZE;

  const stageWidth = Math.round(gridWidth * zoom);

  return (
    <div className="container flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-2 py-6">
      <div
        ref={fullscreenRef}
        className={
          isFullscreen ? "flex items-center justify-center bg-black" : undefined
        }
        onPointerDownCapture={onPointerFire}
        onPointerUpCapture={onPointerFire}
      >
        <div className="group relative">
          <div
            // Grid lines cost a border per cell and darken the picture.
            // Gradient mode paints the picture on the row element, underneath the theme's opaque cells
            className={`bg-black **:data-[slot=data-grid-cell]:border-0 **:data-[slot=data-grid-row]:border-0 **:[[role=grid]]:border-0${
              mode === "gradient"
                ? " **:data-[slot=data-grid-cell]:bg-transparent!"
                : ""
            }`}
            style={{ zoom, width: gridWidth, height: gridHeight }}
          >
            {showGrid && (
              <DataGrid {...dataGridProps} table={table} height={gridHeight} />
            )}
          </div>
          {source === "doom" && !isPlaying && (
            <button
              type="button"
              className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-3 bg-black/60 text-white focus:outline-none"
              onClick={() => {
                if (isReady) setIsPlaying(true);
              }}
            >
              {loadError ? (
                <span className="px-6 text-sm text-red-400">
                  Couldn&apos;t load DOOM: {loadError}
                </span>
              ) : (
                <>
                  <span className="text-xl font-semibold tracking-wide">
                    {isReady ? "Click to play" : "Loading DOOM…"}
                  </span>
                  {isReady && (
                    <span className="px-6 text-center text-xs text-white/70">
                      WASD or arrows move · click or Ctrl fires · E or Space
                      uses · Shift runs · 1–7 weapons · Enter and Esc for menus
                      · Alt+Enter fullscreen
                    </span>
                  )}
                </>
              )}
            </button>
          )}
          {source === "doom" && isPlaying && (
            <div className="absolute inset-e-2 top-2 z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="sm"
                variant="secondary"
                className="bg-black/60 text-white hover:bg-black/80"
                title="Alt+Enter (Option+Enter on macOS)"
                onClick={(event) => {
                  event.currentTarget.blur();
                  void onFullscreen();
                }}
              >
                Fullscreen
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="bg-black/60 text-white hover:bg-black/80"
                onClick={(event) => {
                  setIsPlaying(false);
                  event.currentTarget.blur();
                }}
              >
                Stop
              </Button>
            </div>
          )}
        </div>
      </div>
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground"
        style={{ width: stageWidth }}
      >
        <span className="flex items-center gap-0.5">
          {RESOLUTIONS.map((res) => (
            <a
              key={res}
              href={`?res=${res}${modeParam ? `&mode=${modeParam}` : ""}`}
              className={
                res === width
                  ? "rounded bg-accent px-1.5 py-0.5 font-medium text-foreground"
                  : "rounded px-1.5 py-0.5 hover:text-foreground"
              }
            >
              {res}×{Math.round((res * SCREEN_HEIGHT) / SCREEN_WIDTH)}
              {res === NATIVE_RESOLUTION ? " native" : ""}
            </a>
          ))}
        </span>
        <span className="tabular-nums">
          {mode} · grid {stats.paints} fps
          {source === "doom" ? ` · engine ${stats.engine} fps` : ""}
        </span>
      </div>
      {source === "doom" && (
        <p
          className="text-[11px] text-muted-foreground/80"
          style={{ width: stageWidth }}
        >
          DOOM © id Software.{" "}
          <a
            href="https://github.com/id-Software/DOOM"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Source code
          </a>{" "}
          released under GPL-2.0. WebAssembly port by{" "}
          <a
            href="https://github.com/diekmann/wasm-fizzbuzz/tree/main/doom"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            diekmann
          </a>
          , with the shareware episode, loaded at runtime from its GitHub Pages.
        </p>
      )}
    </div>
  );
}
