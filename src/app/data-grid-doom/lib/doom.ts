// The engine is diekmann/wasm-fizzbuzz (vanilla DOOM compiled to wasm32 with the shareware WAD embedded), loaded at runtime and never bundled
const DOOM_WASM_URL = "https://diekmann.github.io/wasm-fizzbuzz/doom/doom.wasm";
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
  /** Mouse button bits (1 fires). The port ignores mouse movement, so there's no mouse turning. */
  mouse: (buttons: number) => void;
}

// The port has no file system, so saving or loading a game traps the engine.
// Their shortcuts (save, load, quicksave, quickload) never reach it; the menu entries still do.
const SAVE_LOAD_KEYS = new Set(["F2", "F3", "F6", "F9"]);

let enginePromise: Promise<DoomEngine> | null = null;

function noop() {}

// One engine at a time: DOOM keeps global state, so it can't be instantiated twice in the same memory
export function loadDoom(): Promise<DoomEngine> {
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

// A trapped engine can't run again, but a new instance gets fresh memory
export function resetDoom() {
  enginePromise = null;
}

// DOOM takes printable keys as lowercase ASCII and function keys from its own range
export function getDoomKeyCode(event: KeyboardEvent) {
  const named = DOOM_KEY_CODES[event.key];
  if (named !== undefined) return named;
  if (SAVE_LOAD_KEYS.has(event.key)) return null;
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
