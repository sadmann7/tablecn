import type { DoomWorkerRequest, DoomWorkerResponse } from "./doom.worker";

// Chocolate Doom built from cloudflare/doom-wasm (see /public/doom), with sound and music.
// It runs in a Web Worker (doom.worker.ts): the page gets frames and plays its audio
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
  /** Pauses or resumes a level; does nothing outside one. */
  setPaused: (paused: boolean) => void;
}

// Plays the samples the worker engine streams to it, on the audio thread. Reports
// what it has played so the worker stays a few buffers ahead
const AUDIO_WORKLET = `
class DoomAudio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.played = 0;
    this.calls = 0;
    this.link = null;
    this.port.onmessage = (event) => {
      this.link = event.data;
      this.link.onmessage = (message) => this.queue.push(message.data);
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    const length = out[0].length;
    let i = 0;
    while (i < length && this.queue.length > 0) {
      const chunk = this.queue[0];
      const size = chunk[0].length;
      const take = Math.min(length - i, size - this.offset);
      for (let c = 0; c < out.length; c++) {
        out[c].set((chunk[c] ?? chunk[0]).subarray(this.offset, this.offset + take), i);
      }
      i += take;
      this.offset += take;
      if (this.offset >= size) {
        this.queue.shift();
        this.offset = 0;
      }
    }
    this.played += length;
    if (this.link && ++this.calls % 4 === 0) {
      this.link.postMessage(this.played);
    }
    return true;
  }
}
registerProcessor("doom-audio", DoomAudio);
`;

const MIN_PRESS_MS = (2 * 1000) / 35;

let enginePromise: Promise<DoomEngine> | null = null;
// Removes the current instance's worker and audio so a fresh one can start
let engineCleanup: (() => void) | null = null;

function startEngine(): Promise<DoomEngine> {
  return new Promise<DoomEngine>((resolve, reject) => {
    const worker = new Worker(new URL("./doom.worker.ts", import.meta.url), {
      type: "module",
    });
    const audioContext = new AudioContext();
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    // Browsers start audio suspended until a user gesture
    const resumeAudio = () => {
      void audioContext.resume();
    };
    window.addEventListener("pointerdown", resumeAudio, true);
    window.addEventListener("keydown", resumeAudio, true);

    let settled = false;
    let engineDead = false;
    let frame = 0;
    let pixels: Uint8ClampedArray | null = null;
    const fail = (message: string) => {
      engineDead = true;
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    worker.addEventListener(
      "message",
      (event: MessageEvent<DoomWorkerResponse>) => {
        const message = event.data;
        if (message.type === "frame") {
          // The previous frame's buffer goes back for reuse
          if (pixels) {
            const request: DoomWorkerRequest = {
              type: "recycle",
              buffer: pixels.buffer as ArrayBuffer,
            };
            worker.postMessage(request, [pixels.buffer]);
          }
          pixels = new Uint8ClampedArray(message.buffer);
          frame = message.frame;
        } else if (message.type === "ready") {
          if (settled) return;
          settled = true;
          resolve(engine);
        } else {
          fail(message.message);
        }
      },
    );
    worker.addEventListener("error", (event) => {
      fail(event.message || "The DOOM worker failed");
    });

    let pressedAt = 0;
    let releaseTimer = 0;
    const postEvent = (event: [number, number, number, number]) => {
      const request: DoomWorkerRequest = { type: "event", event };
      worker.postMessage(request, []);
    };

    const engine: DoomEngine = {
      pixels: () => pixels,
      frame: () => frame,
      step: () => {
        if (engineDead) throw new Error("The DOOM engine crashed");
      },
      // DOOM event types: 0 key down, 1 key up, 2 mouse. Printable keys also carry
      // the typed character, which menus like the save-name prompt read
      key: (pressed, keyCode) => {
        const typed = keyCode >= 32 && keyCode < 127 ? keyCode : 0;
        postEvent([pressed ? 0 : 1, keyCode, keyCode, typed]);
      },
      // DOOM reads the buttons once per tic, so a quick click whose press and release
      // land in the same tic never fires: hold the press for at least two tics
      mouse: (buttons) => {
        const pressed = buttons & 1;
        if (pressed) {
          window.clearTimeout(releaseTimer);
          pressedAt = performance.now();
          postEvent([2, 1, 0, 0]);
          return;
        }
        const wait = pressedAt + MIN_PRESS_MS - performance.now();
        releaseTimer = window.setTimeout(
          () => {
            postEvent([2, 0, 0, 0]);
          },
          Math.max(0, wait),
        );
      },
      setMuted: (muted) => {
        gainNode.gain.value = muted ? 0 : 1;
      },
      setPaused: (paused) => {
        const request: DoomWorkerRequest = { type: "pause", paused };
        worker.postMessage(request, []);
      },
    };

    engineCleanup = () => {
      worker.terminate();
      void audioContext.close();
      window.removeEventListener("pointerdown", resumeAudio, true);
      window.removeEventListener("keydown", resumeAudio, true);
    };

    const setUp = async () => {
      const url = URL.createObjectURL(
        new Blob([AUDIO_WORKLET], { type: "text/javascript" }),
      );
      await audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(audioContext, "doom-audio", {
        numberOfInputs: 0,
        outputChannelCount: [2],
      });
      node.connect(gainNode);
      // The worklet and the worker talk directly, without the main thread
      const channel = new MessageChannel();
      node.port.postMessage(channel.port1, [channel.port1]);
      const request: DoomWorkerRequest = {
        type: "start",
        sampleRate: audioContext.sampleRate,
        audioPort: channel.port2,
      };
      worker.postMessage(request, [channel.port2]);
    };
    void setUp().catch((error: unknown) => {
      fail(String(error));
    });
  });
}

// One engine at a time, started on first use
export function loadDoom(): Promise<DoomEngine> {
  enginePromise ??= startEngine();
  return enginePromise;
}

// A trapped engine can't run again: a fresh worker starts from scratch
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
