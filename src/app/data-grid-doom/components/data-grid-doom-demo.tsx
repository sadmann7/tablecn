"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "cn";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Grid3x3,
  Maximize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { Button } from "@/registry/bases/radix/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/registry/bases/radix/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/registry/bases/radix/ui/kbd";
import { Toggle } from "@/registry/bases/radix/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/registry/bases/radix/ui/tooltip";

import {
  CHEAT_PATTERN,
  type DoomEngine,
  EXTRA_KEY_CODES,
  getDoomKeyCode,
  getHexColor,
  getIsTypingCheat,
  getKeyboard,
  getPlasmaColor,
  KEY_RSHIFT,
  loadDoom,
  resetDoom,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from "../lib/doom";
import {
  type DoomParams,
  getResolutionLabel,
  RESOLUTIONS,
} from "../lib/params";
import { DataGridDoomLoading } from "./data-grid-doom-skeleton";

const CELL_SIZE = 36;
// Grid view sizes in on-screen pixels: the stage is scaled down, so they're divided by
// its zoom to stay visible at any resolution
const GRID_LINE_PX = 1;
const GRID_RING_PX = 2;
// The grid view needs one cell per pixel, so it's limited to these modes and sizes
const GRID_MAX_COLUMNS = 192;
// Paints DOOM at a steady 30fps rather than up to 35, so frames arrive evenly with time
// to spare. The few ms of slack let every 2nd frame at 60Hz, or 4th at 120Hz, qualify
const FRAME_INTERVAL_MS = 1000 / 30 - 4;
const MUTED_STORAGE_KEY = "data-grid-doom-muted";

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const FULLSCREEN_KEYS = IS_MAC ? "⌥ + Enter" : "Alt + Enter";

const PLAY_KEYS = "P";
const MUTE_KEYS = "M";
const PAGE_SHORTCUT_CODES = new Set(["KeyP", "KeyM"]);

interface StageLayoutOptions {
  width: number;
  height: number;
  viewport: { width: number; height: number };
  chromeHeight: number;
  isFullscreen: boolean;
}

function getStageLayout({
  width,
  height,
  viewport,
  chromeHeight,
  isFullscreen,
}: StageLayoutOptions) {
  const gridWidth = width * CELL_SIZE + 2;
  const gridHeight = height * CELL_SIZE + 2;
  const availableWidth = isFullscreen ? viewport.width : viewport.width - 32;
  // The nav, the page's padding, and the toolbar and credit rows with their gaps
  const availableHeight = isFullscreen
    ? viewport.height
    : viewport.height - 57 - 32 - 24 - chromeHeight;
  const fit = Math.min(
    isFullscreen ? Number.POSITIVE_INFINITY : 1,
    availableWidth / gridWidth,
    availableHeight / gridHeight,
  );
  // Whole device pixels per cell: fractional ones leave seams that read as grid lines
  const pixelRatio = window.devicePixelRatio || 1;
  const zoom =
    Math.max(1, Math.floor(CELL_SIZE * fit * pixelRatio) / pixelRatio) /
    CELL_SIZE;

  return { zoom, gridWidth, gridHeight };
}

// The span is the trigger so the tooltip still shows while the button is disabled
function ControlTooltip({
  label,
  keys,
  children,
}: {
  label: string;
  keys?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
        {keys ? <Kbd>{keys}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function getIsPageShortcut(event: KeyboardEvent) {
  return (
    PAGE_SHORTCUT_CODES.has(event.code) &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

type ControlKey =
  | string
  | { label: string; icon: React.ComponentType<React.ComponentProps<"svg">> };

const CONTROLS: { label: string; keys: ControlKey[] }[] = [
  {
    label: "Move",
    keys: [
      "W A S D",
      { label: "Up arrow", icon: ArrowUp },
      { label: "Down arrow", icon: ArrowDown },
    ],
  },
  {
    label: "Turn",
    keys: [
      { label: "Left arrow", icon: ArrowLeft },
      { label: "Right arrow", icon: ArrowRight },
    ],
  },
  { label: "Fire", keys: ["Click", "F", IS_MAC ? "⌃" : "Ctrl"] },
  { label: "Use", keys: ["E", "Space"] },
  { label: "Run", keys: ["Shift"] },
  { label: "Weapons", keys: ["1–7"] },
  { label: "Menus", keys: ["Enter", "Esc"] },
  { label: "Fullscreen", keys: [FULLSCREEN_KEYS] },
  { label: "Mute", keys: [MUTE_KEYS] },
];

interface PixelRow {
  id: string;
  [key: string]: number | string;
}

export function DataGridDoomDemo({
  columns: width,
  mode,
  modeParam,
  source,
  damage,
  auto,
  grid,
}: DoomParams) {
  const height = Math.round((width * SCREEN_HEIGHT) / SCREEN_WIDTH);
  const [frame, setFrame] = React.useState<PixelRow[]>(() =>
    Array.from({ length: height }, (_, y) => {
      const row: PixelRow = { id: `r${y}` };
      for (let x = 0; x < width; x++) row[`c${x}`] = 0;
      return row;
    }),
  );
  const [isReady, setIsReady] = React.useState(source !== "doom");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(() => {
    try {
      return localStorage.getItem(MUTED_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [shouldShowGrid, setShouldShowGrid] = React.useState(false);
  const [stats, setStats] = React.useState({ paints: 0, engine: 0 });
  const fullscreenRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLButtonElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [viewport, setViewport] = React.useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const footerRef = React.useRef<HTMLDivElement>(null);
  const [chromeHeight, setChromeHeight] = React.useState(48);
  const [isGridShown, setIsGridShown] = React.useState(grid);
  const canShowGrid = mode !== "gradient" && width <= GRID_MAX_COLUMNS;
  const showsGrid = isGridShown && canShowGrid;

  const { zoom, gridWidth, gridHeight } = getStageLayout({
    width,
    height,
    viewport,
    chromeHeight,
    isFullscreen,
  });

  const columns = React.useMemo<ColumnDef<DataGridFeatures, PixelRow>[]>(
    () =>
      Array.from({ length: width }, (_, x) => ({
        id: `c${x}`,
        accessorKey: `c${x}`,
        // A function header renders as is, keeping the collapsed header row empty
        header: () => null,
        size: CELL_SIZE,
        minSize: CELL_SIZE,
        maxSize: CELL_SIZE,
        // Direct writes color the grid's own cell, saving an element per pixel
        cell:
          mode === "data"
            ? ({ getValue }) => (
                <div
                  data-pixel=""
                  className="absolute inset-0"
                  style={{ backgroundColor: getHexColor(getValue() as number) }}
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

  React.useEffect(() => {
    let secondId = 0;
    const firstId = requestAnimationFrame(() => {
      secondId = requestAnimationFrame(() => {
        setShouldShowGrid(true);
      });
    });
    return () => {
      cancelAnimationFrame(firstId);
      cancelAnimationFrame(secondId);
    };
  }, []);

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

  React.useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const footer = footerRef.current;
    if (!toolbar || !footer) return;
    const observer = new ResizeObserver(() => {
      setChromeHeight(toolbar.offsetHeight + footer.offsetHeight);
    });
    observer.observe(toolbar);
    observer.observe(footer);
    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, isMuted ? "1" : "0");
    } catch {
      // Skips saving without localStorage, so the choice only lasts until reload
    }
  }, [isMuted]);

  React.useEffect(() => {
    if (!isPlaying && isReady)
      overlayRef.current?.focus({ preventScroll: true });
  }, [isPlaying, isReady]);

  React.useEffect(() => {
    if (!isReady || source !== "doom") return;
    void loadDoom().then((engine) => {
      engine.setMuted(isMuted);
    });
  }, [isReady, isMuted, source]);

  React.useEffect(() => {
    if (!isReady || source !== "doom") return;
    void loadDoom().then((engine) => {
      engine.setPaused(!isPlaying);
    });
  }, [isReady, isPlaying, source]);

  const onFullscreen = React.useCallback(async () => {
    setIsPlaying(true);
    await fullscreenRef.current?.requestFullscreen();
    // Keeps Esc for DOOM's menus, so holding it exits fullscreen where supported
    await getKeyboard()
      ?.lock(["Escape"])
      // Rejects where locking isn't allowed, and Esc exits as usual
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (source !== "doom") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat || !isReady) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void onFullscreen();
        return;
      }
      // Leaves play to the game's own key handler, since stopped the keys are free
      if (isPlaying || !getIsPageShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (event.code === "KeyM") setIsMuted((muted) => !muted);
      else if (isReady) setIsPlaying(true);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [source, isReady, isPlaying, onFullscreen]);

  // Triggers on left click, caught before the data grid so the click doesn't select cells.
  // In the grid view clicks select cells instead, and F or Ctrl fire
  const onPointerTrigger = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPlaying || showsGrid || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const buttons = event.type === "pointerdown" ? 1 : 0;
      void loadDoom().then((engine) => {
        engine.mouse(buttons);
      });
    },
    [isPlaying, showsGrid],
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
      if (event.altKey && event.key === "Enter") return;
      const pressed = event.type === "keydown";
      if (
        getIsPageShortcut(event) &&
        !engine.isMenuOrMapOpen() &&
        !getIsTypingCheat(typed + event.key.toLowerCase())
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (!pressed || event.repeat) return;
        if (event.code === "KeyM") setIsMuted((muted) => !muted);
        else setIsPlaying(false);
        return;
      }
      // Ignores Esc's auto-repeat, since holding it exits fullscreen and repeats would toggle DOOM's menu
      if (pressed && event.repeat && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const keyCode = EXTRA_KEY_CODES[event.code] ?? getDoomKeyCode(event);
      if (keyCode !== null) engine.key(pressed, keyCode);
      if (pressed && /^[a-z0-9]$/iu.test(event.key)) {
        typed = (typed + event.key.toLowerCase()).slice(-12);
        const cheat = CHEAT_PATTERN.exec(typed)?.[0];
        if (cheat) {
          typed = "";
          // An outside key resets DOOM's matcher, then the cheat goes in clean
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
    if (!shouldShowGrid) return;
    let rafId = 0;
    let disposed = false;
    let engine: DoomEngine | null = null;
    let lastEngineFrame = -1;
    let lastFrameAt = 0;
    let tick = 0;
    let paints = 0;
    let engineFrames = 0;
    let pixels: HTMLElement[][] | null = null;
    let rowElements: HTMLElement[] | null = null;
    // Paints whole pictures in gradient mode to avoid tearing, capping rows per frame
    // and carrying the rest over only when frames run slow
    const pendingRows = new Uint8Array(height);
    let pendingCount = 0;
    let rowBudget = height;
    let paintCursor = 0;
    let deltaEma = 0;
    let vsyncMs = 1000 / 60;
    // Percentages, so the stops survive any scale
    const stops = Array.from(
      { length: width + 1 },
      (_, x) => `${((x * 100) / width).toFixed(2)}%`,
    );
    const current = new Int32Array(width * height).fill(-1);
    // Changed cells only, so direct writes skip the rest
    const dirty = new Uint8Array(width * height);
    const deltas: number[] = [];
    let last = 0;
    let measureStart = 0;
    let statsAt = performance.now();
    // Uses fewer bits per channel at higher resolutions, where banding isn't visible and
    // longer same-color runs keep gradient rows cheap. Stops at 4, since 3 banded visibly
    const colorMask = width >= 160 ? 0xf0 : 0xf8;
    // Half a level, so channels round to the nearest level instead of always down,
    // which would darken the picture and crush dark tints
    const colorHalfStep = ((colorMask ^ 0xff) + 1) / 2;
    const quantize = (sum: number, n: number) =>
      Math.min(255, sum / n + colorHalfStep) & colorMask;
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

    // One scanline as a run-length encoded hard-stop gradient: DOOM's flat colors
    // leave long runs, so most rows need far fewer than `width` stops
    const buildRowGradient = (y: number) => {
      const offset = y * width;
      const parts: string[] = [];
      let runColor = current[offset] ?? -1;
      let runStart = 0;
      for (let x = 1; x <= width; x++) {
        dirty[offset + x - 1] = 0;
        const color = x < width ? (current[offset + x] ?? -1) : -1;
        if (color === runColor) continue;
        parts.push(`${getHexColor(runColor)} ${stops[runStart]} ${stops[x]}`);
        runColor = color;
        runStart = x;
      }
      return `linear-gradient(90deg,${parts.join(",")})`;
    };

    const sample = (): number[] => {
      const changed: number[] = [];
      if (source === "plasma") {
        const first = (tick * changedRows) % height;
        for (let i = 0; i < changedRows; i++) {
          const y = (first + i) % height;
          for (let x = 0; x < width; x++) {
            current[y * width + x] = getPlasmaColor(x, y, tick * 0.08);
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
          let r = 0;
          let g = 0;
          let b = 0;
          let n = 0;
          for (let sy = y0; sy < y1; sy++) {
            for (let sx = x0; sx < x1; sx++) {
              const i = (sy * SCREEN_WIDTH + sx) * 4;
              r += screen[i] ?? 0;
              g += screen[i + 1] ?? 0;
              b += screen[i + 2] ?? 0;
              n++;
            }
          }
          // Quantized, so tiny shifts in an average don't count as a change
          const rgb =
            (quantize(r, n) << 16) | (quantize(g, n) << 8) | quantize(b, n);
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
        if (pixel)
          pixel.style.backgroundColor = getHexColor(current[index] ?? -1);
      }
    };

    const paint = (changed: number[]) => {
      if (mode === "data") {
        if (changed.length === 0) return;
        paints++;
        const rows = changed.map((y) => {
          const row: PixelRow = { id: `r${y}` };
          for (let x = 0; x < width; x++) {
            row[`c${x}`] = current[y * width + x] ?? -1;
          }
          return row;
        });
        setFrame((previous) => {
          const next = previous.slice();
          for (const [index, y] of changed.entries()) {
            const row = rows[index];
            if (row) next[y] = row;
          }
          return next;
        });
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
      // Drain-only calls don't count, so this reads as complete frames a second
      if (changed.length > 0) paints++;
    };

    const step = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(step);
      if (last) {
        const delta = now - last;
        deltas.push(delta);
        // Hold ~30fps by painting fewer rows when frames run slow, and all of them
        // again once they're cheap. Smoothed and slow to grow, so it doesn't stutter
        if (mode !== "data") {
          deltaEma = deltaEma === 0 ? delta : deltaEma * 0.8 + delta * 0.2;
          // Relative to vsync too: at 30Hz (or Chrome's battery saver) every frame
          // takes ~33ms, so fixed 60Hz thresholds would only ever shrink
          if (deltaEma > Math.max(34, vsyncMs * 1.5)) {
            rowBudget = Math.max(16, (rowBudget * 7) >> 3);
          } else if (deltaEma < Math.max(30, vsyncMs * 1.25)) {
            rowBudget = Math.min(height, rowBudget + 2);
          }
        }
      }
      last = now;
      tick++;

      if (source === "doom") {
        if (!engine) return;
        try {
          engine.step();
        } catch {
          // A trapped engine can't step again, so restart on a new one
          engine = null;
          lastEngineFrame = -1;
          resetDoom();
          setIsPlaying(false);
          setIsReady(false);
          toast.error("DOOM crashed and restarted", {
            description: "The game is back at the title screen.",
          });
          void loadDoom().then((loaded) => {
            if (disposed) return;
            engine = loaded;
            setIsReady(true);
          });
          return;
        }
        const engineFrame = engine.frame();
        if (
          engineFrame === lastEngineFrame ||
          now - lastFrameAt < FRAME_INTERVAL_MS
        ) {
          // Frames between DOOM's tics, or ahead of the 30fps cadence, drain the carried-over rows
          if (mode !== "data") paint([]);
          return;
        }
        lastFrameAt = now;
        engineFrames += engineFrame - Math.max(lastEngineFrame, 0);
        lastEngineFrame = engineFrame;
        // A torn picture looks worse than a skipped frame, so finish the last one first.
        // Not in dom mode: it repaints so slowly that whole frames would be a slideshow
        if (mode === "gradient" && pendingCount > 0) {
          paint([]);
          return;
        }
      }
      const changed = sample();
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
        // Probes the display's refresh period while the page is still idle, since
        // once painting starts every frame is heavy and would skew it
        const probe: number[] = [];
        let probeLast = 0;
        const measureVsync = (now: number) => {
          if (disposed) return;
          if (probeLast) probe.push(now - probeLast);
          probeLast = now;
          if (probe.length < 12) {
            rafId = requestAnimationFrame(measureVsync);
            return;
          }
          probe.sort((a, b) => a - b);
          const median = probe[Math.floor(probe.length / 2)] ?? 1000 / 60;
          vsyncMs = Math.min(35, Math.max(3, median));
          measureStart = performance.now() + 1500;
          rafId = requestAnimationFrame(step);
          setTimeout(() => {
            deltas.length = 0;
          }, 1500);
        };
        rafId = requestAnimationFrame(measureVsync);
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
  }, [shouldShowGrid, width, height, mode, source, damage, auto]);

  const stageWidth = Math.round(gridWidth * zoom);

  return (
    <div className="container flex min-h-[calc(100dvh-3.5rem-1px)] flex-col items-center justify-center gap-3 py-4">
      <div
        ref={toolbarRef}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        style={{ width: stageWidth }}
      >
        <span className="flex items-center gap-1.5">
          <DropdownMenu
            // The portal sets pointer-events on body, restyling every pixel cell
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                aria-label="Resolution"
                disabled={!shouldShowGrid || !isReady}
              >
                {getResolutionLabel(width)}
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto">
              <DropdownMenuLabel>Resolution</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={String(width)}
                onValueChange={(value) => {
                  const search = new URLSearchParams({ res: value });
                  if (modeParam) search.set("mode", modeParam);
                  if (isGridShown) search.set("grid", "1");
                  window.location.search = search.toString();
                }}
              >
                {RESOLUTIONS.map((res) => (
                  <DropdownMenuRadioItem key={res} value={String(res)}>
                    {getResolutionLabel(res)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ControlTooltip
            label={
              canShowGrid
                ? showsGrid
                  ? "Hide grid"
                  : "Show grid"
                : `Grid shows up to ${getResolutionLabel(GRID_MAX_COLUMNS)}`
            }
          >
            <Toggle
              size="sm"
              variant="outline"
              aria-label="Show grid"
              className="px-0"
              pressed={showsGrid}
              disabled={!canShowGrid || !shouldShowGrid}
              onClick={(event) => event.currentTarget.blur()}
              onPressedChange={setIsGridShown}
            >
              <Grid3x3 />
            </Toggle>
          </ControlTooltip>
        </span>
        {source === "doom" && (
          <span className="flex items-center gap-1.5">
            <ControlTooltip
              label={isPlaying ? "Pause" : "Play"}
              keys={PLAY_KEYS}
            >
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={isPlaying ? "Pause" : "Play"}
                aria-keyshortcuts="P"
                disabled={!isReady}
                onClick={(event) => {
                  setIsPlaying((playing) => !playing);
                  event.currentTarget.blur();
                }}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
            </ControlTooltip>
            <ControlTooltip
              label={isMuted ? "Unmute" : "Mute"}
              keys={MUTE_KEYS}
            >
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={isMuted ? "Unmute" : "Mute"}
                aria-keyshortcuts="M"
                onClick={(event) => {
                  event.currentTarget.blur();
                  setIsMuted((muted) => !muted);
                }}
              >
                {isMuted ? <VolumeX /> : <Volume2 />}
              </Button>
            </ControlTooltip>
            <ControlTooltip label="Fullscreen" keys={FULLSCREEN_KEYS}>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label="Fullscreen"
                aria-keyshortcuts="Alt+Enter"
                disabled={!isReady}
                onClick={(event) => {
                  event.currentTarget.blur();
                  void onFullscreen();
                }}
              >
                <Maximize />
              </Button>
            </ControlTooltip>
          </span>
        )}
      </div>
      <div
        ref={fullscreenRef}
        // Swapping the classes would restyle every cell below
        className="flex items-center justify-center overflow-hidden rounded-lg ring-1 ring-border [&:fullscreen]:rounded-none [&:fullscreen]:bg-black [&:fullscreen]:ring-0"
        onPointerDownCapture={onPointerTrigger}
        onPointerUpCapture={onPointerTrigger}
      >
        <div
          className="relative overflow-hidden"
          style={{ width: gridWidth * zoom, height: gridHeight * zoom }}
        >
          <div
            // Hides grid lines, plus cells in gradient mode since painting them slows Safari.
            // The grid view brings them back, with selection and focus drawn over the game in
            // spreadsheet blue, which shows on dark and light pixels alike
            className={cn(
              "bg-black **:data-[slot=data-grid-header]:h-0 **:data-[slot=data-grid-header]:overflow-hidden **:data-[slot=data-grid-header]:border-0 **:[[role=grid]]:border-0",
              showsGrid
                ? "**:data-[slot=data-grid-cell]:border-e-(length:--doom-line) **:data-[slot=data-grid-cell-wrapper]:data-focused:before:absolute **:data-[slot=data-grid-cell-wrapper]:data-focused:before:inset-0 **:data-[slot=data-grid-cell-wrapper]:data-focused:before:z-10 **:data-[slot=data-grid-cell-wrapper]:data-focused:before:shadow-[inset_0_0_0_var(--doom-ring)_var(--color-blue-500)] **:data-[slot=data-grid-cell-wrapper]:data-[selected]:after:absolute **:data-[slot=data-grid-cell-wrapper]:data-[selected]:after:inset-0 **:data-[slot=data-grid-cell-wrapper]:data-[selected]:after:bg-blue-500/40 **:data-[slot=data-grid-row]:border-b-(length:--doom-line)"
                : "**:data-[slot=data-grid-cell]:border-0 **:data-[slot=data-grid-row]:border-0",
              mode === "gradient" && "**:data-[slot=data-grid-cell]:invisible",
            )}
            style={
              {
                width: gridWidth,
                height: gridHeight,
                // Scaled with a transform, because changing zoom would lay out every cell again
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
                "--doom-line": `${GRID_LINE_PX / zoom}px`,
                "--doom-ring": `${GRID_RING_PX / zoom}px`,
              } as React.CSSProperties
            }
          >
            {shouldShowGrid && (
              <DataGrid {...dataGridProps} table={table} height={gridHeight} />
            )}
          </div>
          {source === "doom" && !isPlaying && (
            <button
              type="button"
              // m-auto on the content centers it, and on a short stage scrolls it from the top
              className="group absolute inset-0 z-10 flex cursor-pointer overflow-auto bg-background/80 p-6 backdrop-blur-sm *:m-auto focus:outline-none disabled:cursor-default"
              ref={overlayRef}
              disabled={!isReady}
              onClick={() => setIsPlaying(true)}
            >
              {loadError ? (
                <span className="flex max-w-sm flex-col gap-1 text-center">
                  <span className="font-medium text-destructive">
                    Couldn&apos;t load DOOM
                  </span>
                  <span className="text-sm text-balance text-muted-foreground">
                    {loadError}
                  </span>
                </span>
              ) : isReady ? (
                <span className="flex w-72 flex-col rounded-xl border bg-background/70 text-sm shadow-lg transition-colors group-hover:border-foreground/20 group-focus-visible:border-foreground/20">
                  <span className="flex flex-col items-center gap-1 px-4 pt-4 pb-3.5">
                    <span className="text-xl font-semibold tracking-tight">
                      Click to play
                    </span>
                    <span className="text-xs text-balance text-muted-foreground tabular-nums">
                      {mode === "gradient"
                        ? `Rendered across ${height.toLocaleString("en-US")} data grid rows, over ${(width * height).toLocaleString("en-US")} cells`
                        : `Rendered across ${(width * height).toLocaleString("en-US")} data grid cells`}
                    </span>
                  </span>
                  <span className="flex flex-col border-t px-1.5 py-1.5">
                    {CONTROLS.map((control) => (
                      <span
                        key={control.label}
                        className="flex items-center justify-between gap-3 px-2.5 py-1"
                      >
                        <span className="text-muted-foreground">
                          {control.label}
                        </span>
                        <KbdGroup>
                          {control.keys.map((key) =>
                            typeof key === "string" ? (
                              <Kbd key={key}>{key}</Kbd>
                            ) : (
                              <Kbd key={key.label}>
                                <key.icon />
                                <span className="sr-only">{key.label}</span>
                              </Kbd>
                            ),
                          )}
                        </KbdGroup>
                      </span>
                    ))}
                  </span>
                </span>
              ) : (
                <DataGridDoomLoading />
              )}
            </button>
          )}
        </div>
      </div>
      <div
        ref={footerRef}
        className="flex items-start justify-between gap-4 text-xs text-muted-foreground"
        style={{ width: stageWidth }}
      >
        {source === "doom" ? (
          <p className="text-muted-foreground/80">
            DOOM © id Software ·{" "}
            <a
              href="https://www.chocolate-doom.org"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Chocolate Doom
            </a>{" "}
            (
            <a
              href="https://github.com/sadmann7/tablecn/tree/main/public/doom"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              GPL source
            </a>
            )
          </p>
        ) : (
          <span />
        )}
        <span className="shrink-0 tabular-nums">
          {mode} · grid {stats.paints} fps
          {source === "doom" ? ` · engine ${stats.engine} fps` : ""}
        </span>
      </div>
    </div>
  );
}
