"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ChevronDown } from "lucide-react";
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
  getKeyboard,
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
import { getHexColor, getPlasmaColor } from "../lib/pixels";
import { DataGridDoomLoading } from "./data-grid-doom-skeleton";

// DOOM rendered through the data grid, one cell per sampled pixel.
// Native 320 defaults to gradient mode: 64,000 per-cell style writes cap out well under 10 fps, while one
// run-length-encoded linear-gradient per row keeps the whole screen under 200 writes a frame. An adaptive
// per-frame row budget keeps the frame rate up on large screens by refreshing the picture progressively.

const CELL_SIZE = 36;

const CONTROLS = [
  { label: "Move", keys: ["W A S D", "Arrows"] },
  { label: "Fire", keys: ["Click", "Ctrl"] },
  { label: "Use", keys: ["E", "Space"] },
  { label: "Run", keys: ["Shift"] },
  { label: "Weapons", keys: ["1–7"] },
  { label: "Menus", keys: ["Enter", "Esc"] },
  { label: "Fullscreen", keys: ["Alt + Enter"] },
] as const;

type PixelRow = { id: string } & Record<string, number | string>;

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
  // The stage and loading overlay paint first; the grid, tens of thousands of
  // cells at higher resolutions, mounts a tick later instead of blanking the page
  const [showGrid, setShowGrid] = React.useState(false);
  const [stats, setStats] = React.useState({ paints: 0, engine: 0 });
  const fullscreenRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [viewport, setViewport] = React.useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const chromeRef = React.useRef<HTMLDivElement>(null);
  const [chromeHeight, setChromeHeight] = React.useState(64);

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
    const chrome = chromeRef.current;
    if (!chrome) return;
    const observer = new ResizeObserver(() => {
      setChromeHeight(chrome.offsetHeight);
    });
    observer.observe(chrome);
    return () => {
      observer.disconnect();
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
        try {
          engine.step();
        } catch {
          // A trapped engine can't step again, so the title screen comes back on a new one
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
  }, [showGrid, width, height, mode, source, damage, auto]);

  const gridWidth = width * CELL_SIZE + 2;
  const gridHeight = height * CELL_SIZE + 2;
  const fit = isFullscreen
    ? Math.min(viewport.width / gridWidth, viewport.height / gridHeight)
    : Math.min(
        1,
        (viewport.width - 32) / gridWidth,
        // The nav (3.5rem and its border), the page's padding and gap, and the toolbar and attribution below
        (viewport.height - 57 - 32 - 12 - chromeHeight) / gridHeight,
      );
  // Cells land on whole device pixels: fractional ones leave anti-aliased seams that read as grid lines
  const pixelRatio = window.devicePixelRatio || 1;
  const zoom =
    Math.max(1, Math.floor(CELL_SIZE * fit * pixelRatio) / pixelRatio) /
    CELL_SIZE;

  const stageWidth = Math.round(gridWidth * zoom);

  return (
    <div className="container flex min-h-[calc(100dvh-3.5rem-1px)] flex-col items-center justify-center gap-3 py-4">
      <div
        ref={fullscreenRef}
        className={
          isFullscreen
            ? "flex items-center justify-center bg-black"
            : "overflow-hidden rounded-lg ring-1 ring-border"
        }
        onPointerDownCapture={onPointerFire}
        onPointerUpCapture={onPointerFire}
      >
        <div className="relative">
          <div
            // Grid lines cost a border per cell and darken the picture.
            // Gradient mode paints the picture on the row element, underneath the theme's opaque cells
            className={`bg-black **:data-[slot=data-grid-cell]:border-0 **:data-[slot=data-grid-header]:h-0 **:data-[slot=data-grid-header]:overflow-hidden **:data-[slot=data-grid-header]:border-0 **:data-[slot=data-grid-row]:border-0 **:[[role=grid]]:border-0${
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
        ref={chromeRef}
        className="flex flex-col gap-2 text-xs text-muted-foreground"
        style={{ width: stageWidth }}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* Not modal: a modal menu sets pointer-events on <body>, restyling every pixel cell */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                aria-label="Resolution"
                disabled={!showGrid || !isReady}
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
                size="sm"
                variant="outline"
                disabled={!isReady}
                onClick={(event) => {
                  setIsPlaying((playing) => !playing);
                  event.currentTarget.blur();
                }}
              >
                {isPlaying ? "Stop" : "Play"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!isReady}
                title="Alt+Enter (Option+Enter on macOS)"
                onClick={(event) => {
                  event.currentTarget.blur();
                  void onFullscreen();
                }}
              >
                Fullscreen
              </Button>
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-4">
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
              (GPL-2.0), WebAssembly build via{" "}
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
    </div>
  );
}
