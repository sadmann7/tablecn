"use client";

import type { ColumnDef } from "@tanstack/react-table";

import * as React from "react";

import type { DataGridFeatures } from "@/lib/data-grid-features";

import { useMounted } from "@/hooks/use-mounted";
import { DataGrid } from "@/registry/bases/radix/components/data-grid/data-grid";
import { useDataGrid } from "@/registry/bases/radix/hooks/use-data-grid";
import { Button } from "@/registry/bases/radix/ui/button";
import { Fps } from "@/registry/bases/radix/ui/fps";

// DOOM rendered through the data grid, one cell per sampled pixel.
// The engine is diekmann/wasm-fizzbuzz (vanilla DOOM compiled to wasm32 with the shareware WAD embedded), loaded at runtime and never bundled.
// Query params: res=40|64|80|106|128|160 (columns, 16:10), mode=data|dom, source=doom|plasma, damage (plasma only), auto=1 to expose measurements

const DOOM_WASM_URL = "https://diekmann.github.io/wasm-fizzbuzz/doom/doom.wasm";
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 400;
const CELL_SIZE = 36;
const RESOLUTIONS = [40, 64, 80, 106, 128, 160] as const;

type PixelRow = { id: string } & Record<string, number | string>;

interface DoomEngine {
  pixels: () => Uint8ClampedArray | null;
  frame: () => number;
  step: () => void;
  key: (pressed: boolean, doomKey: number) => void;
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
      step: () => exports.doom_loop_step(),
      key: (pressed, doomKey) =>
        exports.add_browser_event(pressed ? 0 : 1, doomKey),
      mouse: (buttons) => exports.add_browser_event(2, buttons),
    };
  })();
  return enginePromise;
}

// Modern bindings on top of DOOM's own (keyCode to DOOM key codes from doomdef.h)
const EXTRA_KEYS: Record<number, number> = {
  87: 173, // W: forward, like the up arrow
  83: 175, // S: back, like the down arrow
  65: 44, // A: strafe left, DOOM's ","
  68: 46, // D: strafe right, DOOM's "."
  69: 32, // E: use, like Space
  70: 157, // F: fire, like Ctrl (Ctrl with the arrow keys switches Spaces on macOS)
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
  /id(?:dqd|kfa|fa|spispopd|clip|choppers|dt|mypos|behold[vsiral]?|clev\d\d)$/;
const KEY_RSHIFT = 182;

// Browser keyCodes to DOOM's key codes (doomdef.h)
function toDoomKey(keyCode: number) {
  switch (keyCode) {
    case 8:
      return 127;
    case 17:
      return 157;
    case 18:
      return 184;
    case 37:
      return 172;
    case 38:
      return 173;
    case 39:
      return 174;
    case 40:
      return 175;
    default:
      if (keyCode >= 65 && keyCode <= 90) return keyCode + 32;
      if (keyCode >= 112 && keyCode <= 123) return keyCode + 75;
      return keyCode;
  }
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
  const res = Number(params.get("res") ?? 128);
  return {
    columns: (RESOLUTIONS as readonly number[]).includes(res) ? res : 128,
    mode: params.get("mode") === "data" ? "data" : "dom",
    source: params.get("source") === "plasma" ? "plasma" : "doom",
    damage: Number(params.get("damage") ?? 1),
    auto: params.get("auto") === "1",
  } as const;
}

export default function DataGridDoomPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  return (
    <>
      <Fps strategy="fixed" />
      <DoomGrid {...getParams()} />
    </>
  );
}

function DoomGrid({
  columns: width,
  mode,
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
  const frameRef = React.useRef(frame);
  frameRef.current = frame;
  const [status, setStatus] = React.useState(
    source === "doom" ? "Loading DOOM…" : "Plasma benchmark",
  );
  const [isPlaying, setIsPlaying] = React.useState(false);
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
        cell: ({ getValue }) => (
          <div
            data-pixel=""
            className="absolute inset-0"
            style={{ backgroundColor: toColor(getValue() as number) }}
          />
        ),
      })),
    [width],
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
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
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
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [source, onFullscreen]);

  // Left click fires; caught before the grid so it doesn't select cells
  const onPointerFire = React.useCallback(
    (event: React.PointerEvent) => {
      if (!isPlaying || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const buttons = event.type === "pointerdown" ? 1 : 0;
      void loadDoom().then((engine) => engine.mouse(buttons));
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
      engine.key(
        pressed,
        EXTRA_KEYS[event.keyCode] ?? toDoomKey(event.keyCode),
      );
      if (pressed && /^[a-z0-9]$/i.test(event.key)) {
        typed = (typed + event.key.toLowerCase()).slice(-12);
        const cheat = CHEAT_PATTERN.exec(typed)?.[0];
        if (cheat) {
          typed = "";
          // Any key outside the sequence resets DOOM's matcher, then the cheat goes in clean
          for (const key of [
            KEY_RSHIFT,
            ...cheat.split("").map((c) => c.charCodeAt(0)),
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
    let rafId = 0;
    let disposed = false;
    let engine: DoomEngine | null = null;
    let lastEngineFrame = -1;
    let tick = 0;
    let paints = 0;
    let engineFrames = 0;
    let pixels: HTMLElement[][] | null = null;
    const current = new Int32Array(width * height).fill(-1);
    // Cells whose color changed since the last paint, so direct writes skip the rest
    const dirty = new Uint8Array(width * height);
    const deltas: number[] = [];
    let last = 0;
    let measureStart = 0;
    let statsAt = performance.now();
    const stepX = SCREEN_WIDTH / width;
    const stepY = SCREEN_HEIGHT / height;
    const changedRows = Math.max(1, Math.round(height * damage));

    const collectPixels = () => {
      const result: HTMLElement[][] = [];
      for (const cell of document.querySelectorAll<HTMLElement>(
        '[role="grid"] [data-slot="data-grid-utility-cell"]',
      )) {
        const y = Number(cell.dataset.rowId?.slice(1));
        const x = Number(cell.dataset.columnId?.slice(1));
        const pixel = cell.querySelector<HTMLElement>("[data-pixel]");
        if (pixel) (result[y] ??= [])[x] = pixel;
      }
      return result;
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
              r += screen[i]!;
              g += screen[i + 1]!;
              b += screen[i + 2]!;
              n++;
            }
          }
          // 5 bits per channel, so tiny shifts in an average don't count as a changed pixel
          const rgb =
            (((r / n) & 0xf8) << 16) |
            (((g / n) & 0xf8) << 8) |
            ((b / n) & 0xf8);
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

    const paint = (changed: number[]) => {
      if (changed.length === 0) return;
      paints++;
      if (mode === "dom") {
        pixels ??= collectPixels();
        for (const y of changed) {
          const row = pixels[y];
          if (!row) continue;
          for (let x = 0; x < width; x++) {
            const index = y * width + x;
            if (!dirty[index]) continue;
            dirty[index] = 0;
            const pixel = row[x];
            if (pixel) pixel.style.backgroundColor = toColor(current[index]!);
          }
        }
        return;
      }
      const next = frameRef.current.slice();
      for (const y of changed) {
        const row: PixelRow = { id: `r${y}` };
        for (let x = 0; x < width; x++) {
          row[`c${x}`] = current[y * width + x]!;
        }
        next[y] = row;
      }
      setFrame(next);
    };

    const step = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(step);
      if (last) deltas.push(now - last);
      last = now;
      tick++;

      if (source === "doom") {
        if (!engine) return;
        engine.step();
        const engineFrame = engine.frame();
        if (engineFrame === lastEngineFrame) return;
        engineFrames += engineFrame - Math.max(lastEngineFrame, 0);
        lastEngineFrame = engineFrame;
      }
      paint(sample());

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
          setStatus("Running the attract demo. Press Play to take control.");
          start();
        })
        .catch((error: unknown) => {
          setStatus(`Couldn't load DOOM: ${String(error)}`);
        });
    } else {
      start();
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  }, [width, height, mode, source, damage, auto]);

  const gridWidth = width * CELL_SIZE + 2;
  const gridHeight = (height + 1) * CELL_SIZE + 2;
  const fit = isFullscreen
    ? Math.min(viewport.width / gridWidth, viewport.height / gridHeight)
    : Math.min(
        1,
        (viewport.width - 32) / gridWidth,
        (viewport.height - 140) / gridHeight,
      );
  // Whole-pixel cells: fractional ones leave anti-aliased seams that read as grid lines
  const zoom = Math.max(1, Math.floor(CELL_SIZE * fit)) / CELL_SIZE;

  return (
    <div className="container flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {width}×{height} cells · {mode} · {isPlaying ? "Playing" : status}
        </span>
        <span className="text-muted-foreground tabular-nums">
          grid {stats.paints} fps
          {source === "doom" ? ` · engine ${stats.engine} fps` : ""}
        </span>
        <span className="flex items-center gap-1">
          {RESOLUTIONS.map((res) => (
            <a
              key={res}
              href={`?res=${res}&mode=${mode}`}
              className={
                res === width
                  ? "rounded bg-accent px-1.5 py-0.5 font-medium"
                  : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
              }
            >
              {res}×{Math.round((res * SCREEN_HEIGHT) / SCREEN_WIDTH)}
            </a>
          ))}
        </span>
        {source === "doom" && (
          <Button
            size="sm"
            variant={isPlaying ? "secondary" : "default"}
            onClick={(event) => {
              setIsPlaying((playing) => !playing);
              event.currentTarget.blur();
            }}
          >
            {isPlaying ? "Stop playing" : "Play"}
          </Button>
        )}
        {source === "doom" && (
          <Button
            size="sm"
            variant="outline"
            title="Alt+Enter (Option+Enter on macOS)"
            onClick={(event) => {
              event.currentTarget.blur();
              void onFullscreen();
            }}
          >
            Fullscreen
          </Button>
        )}
        {isPlaying && (
          <span className="text-muted-foreground">
            WASD or arrows move (A and D strafe, arrows turn), F, Ctrl or click
            fires, E or Space uses, Enter and Esc for menus. Alt+Enter toggles
            fullscreen. ⌘ shortcuts still reach the browser.
          </span>
        )}
      </div>
      <div
        ref={fullscreenRef}
        className={
          isFullscreen ? "flex items-center justify-center bg-black" : undefined
        }
        onPointerDownCapture={onPointerFire}
        onPointerUpCapture={onPointerFire}
      >
        <div
          // Grid lines cost a border per cell and darken the picture
          className="[&_[data-slot=data-grid-cell]]:border-0 [&_[data-slot=data-grid-row]]:border-0 [&_[role=grid]]:border-0"
          style={{ zoom, width: gridWidth }}
        >
          <DataGrid {...dataGridProps} table={table} height={gridHeight} />
        </div>
      </div>
      {source === "doom" && (
        <p className="text-xs text-muted-foreground">
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
