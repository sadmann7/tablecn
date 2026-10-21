// The engine is cloudflare/doom-wasm (Chocolate Doom compiled with emscripten against
// SDL2 + SDL2_mixer, so sound effects and OPL music work), built into /public/doom.
// It renders into a hidden canvas; pixels() reads that canvas back per engine frame
const DOOM_BASE = "/doom/";
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 400;

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

// The modern re-releases' scheme on top of DOOM's own: WASD with A/D strafing
// and E to use, as in the official Unity and KEX ports and the GZDoom family.
// Fire stays on click and Ctrl, DOOM's own binding. Keyed by the physical key
// (KeyboardEvent.code), so WASD stays put on non-QWERTY layouts
export const EXTRA_KEY_CODES: Record<string, number> = {
  KeyW: 173, // Forward, like the up arrow
  KeyS: 175, // Back, like the down arrow
  KeyA: 44, // Strafe left, DOOM's ","
  KeyD: 46, // Strafe right, DOOM's "."
  KeyE: 32, // Use, like Space
};

// DOOM resets a cheat on any key outside its sequence, so remapped letters would break them.
// The page spots cheats itself and replays them as plain letters instead.
export const CHEAT_PATTERN =
  /id(?:dqd|kfa|fa|spispopd|clip|choppers|dt|mypos|behold[vsiral]?|clev\d\d)$/u;

export interface DoomEngine {
  pixels: () => Uint8ClampedArray | null;
  frame: () => number;
  step: () => void;
  key: (pressed: boolean, keyCode: number) => void;
  /** Mouse button bits (1 fires), forwarded to the engine canvas as mouse events. */
  mouse: (buttons: number) => void;
}

// The engine takes input as DOM events on its canvas, translated by SDL: each DOOM
// key code the page sends maps back to the event fields of the key that means it
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
// Tears down the current instance's page-side pieces so a fresh one can mount
let engineCleanup: (() => void) | null = null;

function noop() {}

// One engine at a time: the emscripten module holds global state, so it can't
// be instantiated twice in the same memory
export function loadDoom(): Promise<DoomEngine> {
  enginePromise ??= new Promise<DoomEngine>((resolve, reject) => {
    // SDL drives the hidden canvas; the page samples it and paints the grid
    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;left:-10000px;top:0;width:640px;height:400px;overflow:hidden;pointer-events:none";
    container.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    // The SDL keyboard hint below is resolved as a CSS selector
    canvas.id = "canvas";
    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
    container.append(canvas);
    document.body.append(container);

    // The engine paces itself on its own loop, so a wasm trap never surfaces
    // in a page call: spot it from the global error event and let step() throw,
    // which the page answers by resetting and loading a fresh engine
    let engineDead = false;
    const onEngineError = (event: ErrorEvent) => {
      const detail =
        event.error instanceof Error && event.error.stack
          ? event.error.stack
          : event.message;
      if (detail.includes("websockets-doom")) engineDead = true;
    };
    window.addEventListener("error", onEngineError);

    let frame = 0;
    let context: CanvasRenderingContext2D | null = null;
    let fallbackTicker = 0;
    let settled = false;
    // SDL mirrors the engine's window title into document.title
    const pageTitle = document.title;
    const onFirstFrame = () => {
      if (settled) return;
      settled = true;
      document.title = pageTitle;
      resolve(engine);
    };

    // The SDL software renderer presents each frame with putImageData: wrapping it
    // counts engine frames and signals readiness off the first drawn picture
    const originalGetContext = canvas.getContext.bind(
      canvas,
    ) as typeof canvas.getContext;
    canvas.getContext = ((type: string, options?: unknown) => {
      const result = originalGetContext(
        type as Parameters<typeof originalGetContext>[0],
        options as never,
      );
      if (type === "2d" && result && !context) {
        context = result as CanvasRenderingContext2D;
        const originalPutImageData = context.putImageData.bind(context);
        context.putImageData = ((
          ...args: Parameters<CanvasRenderingContext2D["putImageData"]>
        ) => {
          frame++;
          onFirstFrame();
          return originalPutImageData(...args);
        }) as CanvasRenderingContext2D["putImageData"];
      } else if (result && !context && !fallbackTicker) {
        // A WebGL renderer presents off-screen where it can't be wrapped: count
        // frames at DOOM's own 35Hz and read pixels back through drawImage
        fallbackTicker = window.setInterval(() => {
          frame++;
          onFirstFrame();
        }, 1000 / 35);
      }
      return result;
    }) as typeof canvas.getContext;

    // SDL registers its key handlers on the canvas (the hint below). They are
    // captured here and called directly instead of going through the DOM:
    // a dispatched event would first run the page's window-level capture
    // handler, which forwards keys here (recursion) and stops propagation
    // before the event could ever reach the canvas
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

    // Pixel readback, one copy per engine frame however the engine presents
    let readCanvas: HTMLCanvasElement | null = null;
    let readContext: CanvasRenderingContext2D | null = null;
    let sampledFrame = -1;
    let sampled: Uint8ClampedArray | null = null;
    const readPixels = () => {
      if (
        context &&
        canvas.width === SCREEN_WIDTH &&
        canvas.height === SCREEN_HEIGHT
      ) {
        return context.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).data;
      }
      if (!readContext) {
        readCanvas = document.createElement("canvas");
        readCanvas.width = SCREEN_WIDTH;
        readCanvas.height = SCREEN_HEIGHT;
        readContext = readCanvas.getContext("2d", {
          willReadFrequently: true,
        });
        if (!readContext) return null;
      }
      readContext.drawImage(canvas, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      return readContext.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).data;
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

    const engine: DoomEngine = {
      pixels: () => {
        if (frame === 0) return null;
        if (sampledFrame !== frame) {
          sampled = readPixels();
          sampledFrame = frame;
        }
        return sampled;
      },
      frame: () => frame,
      // The engine paces itself off requestAnimationFrame; nothing to pump,
      // but a crashed engine is reported here for the page to restart it
      step: () => {
        if (engineDead) throw new Error("The DOOM engine crashed");
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
    };

    const fail = (reason: unknown) => {
      if (settled) return;
      settled = true;
      if (fallbackTicker) window.clearInterval(fallbackTicker);
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
          // Keyboard capture stays on the hidden canvas: SDL would otherwise
          // listen on window, eating every keystroke on the page
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
        } catch (error) {
          fail(error);
        }
      },
    };
    (window as Window & { Module?: DoomModule }).Module = module;

    engineCleanup = () => {
      window.removeEventListener("error", onEngineError);
      if (fallbackTicker) window.clearInterval(fallbackTicker);
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

// A trapped engine can't run again, but a new instance gets fresh memory.
// The old canvas must leave the document too: SDL finds its keyboard target
// with a selector the dead canvas would still match
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
