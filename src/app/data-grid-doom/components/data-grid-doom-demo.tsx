"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "cn";
import {
  ChevronDown,
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

import {
  CHEAT_PATTERN,
  type DoomEngine,
  EXTRA_KEY_CODES,
  getDoomKeyCode,
  getHexColor,
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
// DOOM paints at a steady 30fps instead of up to 35, leaving the main thread room for
// its audio. A few ms of slack so every 2nd frame at 60Hz (or 4th at 120Hz) qualifies
const FRAME_INTERVAL_MS = 1000 / 30 - 4;
const MUTED_STORAGE_KEY = "data-grid-doom-muted";

// Only loaded in the browser, so the platform is known up front
const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const FULLSCREEN_KEYS = IS_MAC ? "⌥ + Enter" : "Alt + Enter";

const CONTROLS = [
  { label: "Move", keys: ["W A S D", "Arrows"] },
  { label: "Fire", keys: ["Click", IS_MAC ? "⌃" : "Ctrl"] },
  { label: "Use", keys: ["E", "Space"] },
  { label: "Run", keys: ["Shift"] },
  { label: "Weapons", keys: ["1–7"] },
  { label: "Menus", keys: ["Enter", "Esc"] },
  { label: "Fullscreen", keys: [FULLSCREEN_KEYS] },
] as const;

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
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [viewport, setViewport] = React.useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const footerRef = React.useRef<HTMLDivElement>(null);
  const [chromeHeight, setChromeHeight] = React.useState(48);

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

  // Reapplied once the engine is ready, including a fresh one after a crash
  React.useEffect(() => {
    if (!isReady || source !== "doom") return;
    void loadDoom().then((engine) => {
      engine.setMuted(isMuted);
    });
  }, [isReady, isMuted, source]);

  const onFullscreen = React.useCallback(async () => {
    setIsPlaying(true);
    await fullscreenRef.current?.requestFullscreen();
    // DOOM needs Esc for menus: where supported, holding Esc exits fullscreen instead
    await getKeyboard()
      ?.lock(["Escape"])
      // Rejects where locking isn't allowed, and Esc exits as usual
      .catch(() => {});
  }, []);

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

  // Left click triggers; caught before the grid so it doesn't select cells
  const onPointerTrigger = React.useCallback(
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
      if (event.altKey && event.key === "Enter") return;
      const pressed = event.type === "keydown";
      // Holding Esc is the way out of fullscreen; its auto-repeat would toggle DOOM's menu
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
    // Gradient mode paints whole pictures, since one split across display frames
    // shows as tearing. Only when frames run slow does it cap the rows per frame,
    // carrying the rest over, so the picture refreshes progressively instead
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
    // Fewer bits per channel as cells shrink: banding stops being visible while
    // longer same-color runs keep the gradient rows cheap. 4 bits tops: 3 bits
    // bought ~2fps at native but banded visibly
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
        // Probe the display's refresh period while the page is still idle;
        // once painting starts, every frame is heavy and would poison it
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

  const gridWidth = width * CELL_SIZE + 2;
  const gridHeight = height * CELL_SIZE + 2;
  const fit = isFullscreen
    ? Math.min(viewport.width / gridWidth, viewport.height / gridHeight)
    : Math.min(
        1,
        (viewport.width - 32) / gridWidth,
        // The nav, the page's padding, and the toolbar and credit rows with their gaps
        (viewport.height - 57 - 32 - 24 - chromeHeight) / gridHeight,
      );
  // Whole device pixels per cell: fractional ones leave seams that read as grid lines
  const pixelRatio = window.devicePixelRatio || 1;
  const zoom =
    Math.max(1, Math.floor(CELL_SIZE * fit * pixelRatio) / pixelRatio) /
    CELL_SIZE;

  const stageWidth = Math.round(gridWidth * zoom);

  return (
    <div className="container flex min-h-[calc(100dvh-3.5rem-1px)] flex-col items-center justify-center gap-3 py-4">
      <div
        ref={toolbarRef}
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        style={{ width: stageWidth }}
      >
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
                window.location.search = `?res=${value}${modeParam ? `&mode=${modeParam}` : ""}`;
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
        {source === "doom" && (
          <span className="flex items-center gap-1.5">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={isPlaying ? "Stop" : "Play"}
              title={isPlaying ? "Stop" : "Play"}
              disabled={!isReady}
              onClick={(event) => {
                setIsPlaying((playing) => !playing);
                event.currentTarget.blur();
              }}
            >
              {isPlaying ? <Pause /> : <Play />}
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={isMuted ? "Unmute" : "Mute"}
              title={isMuted ? "Unmute" : "Mute"}
              onClick={(event) => {
                event.currentTarget.blur();
                const muted = !isMuted;
                setIsMuted(muted);
                try {
                  localStorage.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0");
                } catch {
                  // Storage can be off (private mode); muting still works until reload
                }
              }}
            >
              {isMuted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Fullscreen"
              title={`Fullscreen (${FULLSCREEN_KEYS})`}
              disabled={!isReady}
              onClick={(event) => {
                event.currentTarget.blur();
                void onFullscreen();
              }}
            >
              <Maximize />
            </Button>
          </span>
        )}
      </div>
      <div
        ref={fullscreenRef}
        // Fixed classes: swapping them would restyle every cell below
        className="flex items-center justify-center overflow-hidden rounded-lg ring-1 ring-border [&:fullscreen]:rounded-none [&:fullscreen]:bg-black [&:fullscreen]:ring-0"
        onPointerDownCapture={onPointerTrigger}
        onPointerUpCapture={onPointerTrigger}
      >
        <div
          className="relative overflow-hidden"
          style={{ width: gridWidth * zoom, height: gridHeight * zoom }}
        >
          <div
            // No grid lines. Gradient mode paints on the rows, so its cells are hidden:
            // transparent cells would still be painted, which Safari is slow at
            className={cn(
              "bg-black **:data-[slot=data-grid-cell]:border-0 **:data-[slot=data-grid-header]:h-0 **:data-[slot=data-grid-header]:overflow-hidden **:data-[slot=data-grid-header]:border-0 **:data-[slot=data-grid-row]:border-0 **:[[role=grid]]:border-0",
              mode === "gradient" && "**:data-[slot=data-grid-cell]:invisible",
            )}
            style={{
              width: gridWidth,
              height: gridHeight,
              // Scaled with a transform, because changing zoom would lay out every cell again
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {shouldShowGrid && (
              <DataGrid {...dataGridProps} table={table} height={gridHeight} />
            )}
          </div>
          {source === "doom" && !isPlaying && (
            <button
              type="button"
              className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-background/80 p-6 backdrop-blur-sm focus:outline-none disabled:cursor-default"
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
                <span className="flex flex-col items-center gap-5">
                  <span className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-semibold tracking-tight">
                      Click to play
                    </span>
                    <span className="text-sm text-balance text-muted-foreground">
                      {(width * height).toLocaleString("en-US")} data grid
                      cells, one for every pixel
                    </span>
                  </span>
                  <span className="grid grid-cols-[auto_auto] items-center gap-x-6 gap-y-2 text-sm">
                    {CONTROLS.map((control) => (
                      <React.Fragment key={control.label}>
                        <span className="text-start text-muted-foreground">
                          {control.label}
                        </span>
                        <KbdGroup>
                          {control.keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </KbdGroup>
                      </React.Fragment>
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
            (GPL-2.0,{" "}
            <a
              href="https://github.com/sadmann7/tablecn/tree/main/public/doom"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              source
            </a>
            ), WebAssembly build via{" "}
            <a
              href="https://github.com/cloudflare/doom-wasm"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              cloudflare/doom-wasm
            </a>
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
