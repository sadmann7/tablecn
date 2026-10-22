// Chocolate Doom built from cloudflare/doom-wasm (see /public/doom), with sound and music.
// The page reads DOOM's own 8-bit frame straight from memory
const DOOM_BASE = "/doom/";
export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 200;

export const KEY_RSHIFT = 182;
const KEY_F1 = 187;

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

// The modern ports' WASD scheme on top of DOOM's own. Keyed by physical key, so it
// stays put on non-QWERTY layouts
export const EXTRA_KEY_CODES: Record<string, number> = {
  KeyW: 173, // Forward, like the up arrow
  KeyS: 175, // Back, like the down arrow
  KeyA: 44, // Strafe left, DOOM's ","
  KeyD: 46, // Strafe right, DOOM's "."
  KeyE: 32, // Use, like Space
};

// Remapped letters would break DOOM's cheat matcher, so the page spots cheats and replays them
export const CHEAT_PATTERN =
  /id(?:dqd|kfa|fa|spispopd|clip|choppers|dt|mypos|behold[vsiral]?|clev\d\d)$/u;

export interface DoomEngine {
  pixels: () => Uint8ClampedArray | null;
  frame: () => number;
  step: () => void;
  key: (pressed: boolean, keyCode: number) => void;
  /** Mouse button bits; 1 fires. */
  mouse: (buttons: number) => void;
  setMuted: (muted: boolean) => void;
}

// SDL reads input as DOM key events, so each DOOM key code maps back to its event fields
const KEY_EVENT_FIELDS: Record<
  number,
  [key: string, code: string, which: number]
> = {
  173: ["ArrowUp", "ArrowUp", 38],
  175: ["ArrowDown", "ArrowDown", 40],
  172: ["ArrowLeft", "ArrowLeft", 37],
  174: ["ArrowRight", "ArrowRight", 39],
  [KEY_RSHIFT]: ["Shift", "ShiftLeft", 16],
  157: ["Control", "ControlLeft", 17],
  184: ["Alt", "AltLeft", 18],
  27: ["Escape", "Escape", 27],
  13: ["Enter", "Enter", 13],
  9: ["Tab", "Tab", 9],
  127: ["Backspace", "Backspace", 8],
  32: [" ", "Space", 32],
  44: [",", "Comma", 188],
  46: [".", "Period", 190],
  45: ["-", "Minus", 189],
  61: ["=", "Equal", 187],
  47: ["/", "Slash", 191],
  59: [";", "Semicolon", 186],
  39: ["'", "Quote", 222],
  91: ["[", "BracketLeft", 219],
  93: ["]", "BracketRight", 221],
  96: ["`", "Backquote", 192],
};

function getKeyEventFields(doomCode: number) {
  const named = KEY_EVENT_FIELDS[doomCode];
  if (named) return named;
  // Letters arrive as lowercase ASCII, digits as their ASCII codes
  if (doomCode >= 97 && doomCode <= 122) {
    const letter = String.fromCodePoint(doomCode);
    return [letter, `Key${letter.toUpperCase()}`, doomCode - 32] as const;
  }
  if (doomCode >= 48 && doomCode <= 57) {
    const digit = String.fromCodePoint(doomCode);
    return [digit, `Digit${digit}`, doomCode] as const;
  }
  if (doomCode >= KEY_F1 && doomCode < KEY_F1 + 12) {
    const index = doomCode - KEY_F1 + 1;
    return [`F${index}`, `F${index}`, 111 + index] as const;
  }
  return null;
}

interface DoomModule {
  canvas: HTMLCanvasElement;
  HEAPU8?: Uint8Array;
  _doom_attach_page?: () => void;
  _doom_frame_count?: () => number;
  _doom_palette?: () => number;
  _doom_screen?: () => number;
  SDL2?: {
    audioContext?: AudioContext;
    audio?: { scriptProcessorNode?: AudioNode };
  };
  noInitialRun: boolean;
  preRun: (() => void)[];
  onRuntimeInitialized: () => void;
  onAbort?: (reason: unknown) => void;
  locateFile: (path: string) => string;
  print: (text: string) => void;
  printErr: (text: string) => void;
  callMain?: (args: string[]) => void;
  ENV?: Record<string, string>;
  FS?: {
    createPreloadedFile: (
      parent: string,
      name: string,
      url: string,
      canRead: boolean,
      canWrite: boolean,
    ) => void;
  };
}

let enginePromise: Promise<DoomEngine> | null = null;
// Removes the current instance's page-side pieces so a fresh one can mount
let engineCleanup: (() => void) | null = null;

function noop() {}

// One engine at a time: the emscripten module holds global state
export function loadDoom(): Promise<DoomEngine> {
  enginePromise ??= new Promise<DoomEngine>((resolve, reject) => {
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-10000px;top:0;width:${SCREEN_WIDTH}px;height:${SCREEN_HEIGHT}px;overflow:hidden;pointer-events:none`;
    container.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    // The SDL keyboard hint below is resolved as a CSS selector
    canvas.id = "canvas";
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    container.append(canvas);
    document.body.append(container);

    // The engine runs its own loop, so a wasm trap only shows up as a global error.
    // step() rethrows it, and the page restarts on a fresh engine
    let engineDead = false;
    const onEngineError = (event: ErrorEvent) => {
      const detail =
        event.error instanceof Error && event.error.stack
          ? event.error.stack
          : event.message;
      if (detail.includes("websockets-doom")) engineDead = true;
    };
    window.addEventListener("error", onEngineError);

    let settled = false;
    // SDL mirrors the engine's window title into document.title
    const pageTitle = document.title;

    // SDL's key handlers are captured and called directly: a dispatched event would hit
    // the page's window-level key forwarder first, recursing and never reaching the canvas
    const sdlKeyHandlers: Record<string, (event: KeyboardEvent) => void> = {};
    const originalAddEventListener = canvas.addEventListener.bind(
      canvas,
    ) as typeof canvas.addEventListener;
    canvas.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (
        (type === "keydown" || type === "keyup") &&
        typeof listener === "function"
      ) {
        sdlKeyHandlers[type] = listener as (event: KeyboardEvent) => void;
        return;
      }
      originalAddEventListener(type as never, listener, options);
    }) as typeof canvas.addEventListener;

    // DOOM's 8-bit frame through its current palette, converted once per new frame
    const rgba = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
    const rgba32 = new Uint32Array(rgba.buffer);
    const palette32 = new Uint32Array(256);
    let sampledFrame = -1;
    const readPixels = () => {
      const heap = module.HEAPU8;
      const screen = module._doom_screen?.();
      const palette = module._doom_palette?.();
      if (!heap || !screen || !palette) return null;
      for (let c = 0; c < 256; c++) {
        const p = palette + c * 4;
        palette32[c] =
          0xff000000 |
          ((heap[p + 2] ?? 0) << 16) |
          ((heap[p + 1] ?? 0) << 8) |
          (heap[p] ?? 0);
      }
      for (let i = 0; i < rgba32.length; i++) {
        rgba32[i] = palette32[heap[screen + i] ?? 0] ?? 0;
      }
      return rgba;
    };

    const dispatchKey = (pressed: boolean, doomCode: number) => {
      const handler = sdlKeyHandlers[pressed ? "keydown" : "keyup"];
      const fields = getKeyEventFields(doomCode);
      if (!handler || !fields) return;
      const [key, code, which] = fields;
      const event = new KeyboardEvent(pressed ? "keydown" : "keyup", {
        key,
        code,
        cancelable: true,
      });
      // The constructor ignores keyCode, but SDL's older key path still reads it
      for (const property of ["keyCode", "which"] as const) {
        Object.defineProperty(event, property, { value: which });
      }
      handler(event);
    };

    // SDL connects its audio straight to the speakers; routing it through a gain
    // node mutes it without pausing the music or queueing sound effects
    let isMuted = false;
    let gainNode: GainNode | null = null;
    const applyVolume = () => {
      if (!gainNode) {
        const audioContext = module.SDL2?.audioContext;
        const source = module.SDL2?.audio?.scriptProcessorNode;
        if (!audioContext || !source) return;
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        source.disconnect();
        source.connect(gainNode);
      }
      gainNode.gain.value = isMuted ? 0 : 1;
    };

    const engine: DoomEngine = {
      pixels: () => {
        const frame = module._doom_frame_count?.() ?? 0;
        if (frame === 0) return null;
        if (sampledFrame !== frame) {
          if (!readPixels()) return null;
          sampledFrame = frame;
        }
        return rgba;
      },
      frame: () => module._doom_frame_count?.() ?? 0,
      // The engine runs its own loop, scheduled ahead of the page's in every frame,
      // so a new frame is ready by the time the page samples. Reports a crash
      step: () => {
        if (engineDead) throw new Error("The DOOM engine crashed");
        // SDL opens its audio after startup, so keep trying until it exists
        if (!gainNode) applyVolume();
      },
      key: dispatchKey,
      mouse: (buttons) => {
        canvas.dispatchEvent(
          new MouseEvent(buttons & 1 ? "mousedown" : "mouseup", {
            button: 0,
            buttons: buttons & 1,
            cancelable: true,
          }),
        );
      },
      setMuted: (muted) => {
        isMuted = muted;
        applyVolume();
      },
    };

    const fail = (reason: unknown) => {
      if (settled) return;
      settled = true;
      reject(reason instanceof Error ? reason : new Error(String(reason)));
    };

    const module: DoomModule = {
      canvas,
      noInitialRun: true,
      locateFile: (path) => DOOM_BASE + path,
      print: noop,
      printErr: noop,
      onAbort: fail,
      preRun: [
        () => {
          // Keep SDL's keyboard on the hidden canvas, not window, which would eat every keystroke
          if (module.ENV)
            module.ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = "#canvas";
          module.FS?.createPreloadedFile(
            "",
            "doom1.wad",
            `${DOOM_BASE}doom1.wad`,
            true,
            true,
          );
          module.FS?.createPreloadedFile(
            "",
            "default.cfg",
            `${DOOM_BASE}default.cfg`,
            true,
            true,
          );
          module.FS?.createPreloadedFile(
            "",
            "extra.cfg",
            `${DOOM_BASE}extra.cfg`,
            true,
            true,
          );
        },
      ],
      onRuntimeInitialized: () => {
        try {
          module.callMain?.([
            "-iwad",
            "doom1.wad",
            "-window",
            "-nogui",
            "-config",
            "default.cfg",
            // Video and input settings live in Chocolate Doom's extra config
            "-extraconfig",
            "extra.cfg",
          ]);
          // The page reads frames from memory, so SDL can skip presenting them
          module._doom_attach_page?.();
        } catch (error) {
          fail(error);
          return;
        }
        if (settled) return;
        settled = true;
        document.title = pageTitle;
        resolve(engine);
      },
    };
    (window as Window & { Module?: DoomModule }).Module = module;

    engineCleanup = () => {
      window.removeEventListener("error", onEngineError);
      container.remove();
    };

    const script = document.createElement("script");
    script.src = `${DOOM_BASE}websockets-doom.js`;
    script.addEventListener("error", () => {
      fail(new Error(`Couldn't load ${script.src}`));
    });
    document.head.append(script);
  });
  return enginePromise;
}

// A trapped engine can't run again, but a new one gets fresh memory. The old canvas
// goes too, or SDL's keyboard selector would still match it
export function resetDoom() {
  engineCleanup?.();
  engineCleanup = null;
  enginePromise = null;
}

// DOOM takes printable keys as lowercase ASCII and function keys from its own range
export function getDoomKeyCode(event: KeyboardEvent) {
  const named = DOOM_KEY_CODES[event.key];
  if (named !== undefined) return named;
  if (event.key.length === 1) {
    return event.key.toLowerCase().codePointAt(0) ?? null;
  }
  const functionKey = /^F(?<index>1[0-2]|[1-9])$/u.exec(event.key);
  if (functionKey) return KEY_F1 + Number(functionKey.groups?.index) - 1;
  return null;
}

// Keyboard Lock API, Chromium only
export function getKeyboard() {
  return (
    navigator as Navigator & {
      keyboard?: {
        lock: (keys: string[]) => Promise<void>;
        unlock: () => void;
      };
    }
  ).keyboard;
}

export function getPlasmaColor(x: number, y: number, t: number) {
  const wave =
    Math.sin(x * 0.17 + t) +
    Math.sin(y * 0.13 + t * 1.3) +
    Math.sin((x + y) * 0.11 + t * 0.7) +
    Math.sin(Math.hypot(x - 40, y - 25) * 0.2 - t * 1.7);
  const paletteIndex = Math.floor(((wave + 4) / 8) * 255) & 255;
  const angle = (paletteIndex / 256) * Math.PI * 2;
  const r = Math.round(128 + 127 * Math.sin(angle));
  const g = Math.round(128 + 127 * Math.sin(angle + 2));
  const b = Math.round(128 + 127 * Math.sin(angle + 4));
  return (r << 16) | (g << 8) | b;
}

const hexColorCache = new Map<number, string>();

export function getHexColor(rgb: number) {
  let color = hexColorCache.get(rgb);
  if (color === undefined) {
    color = `#${rgb.toString(16).padStart(6, "0")}`;
    hexColorCache.set(rgb, color);
  }
  return color;
}
