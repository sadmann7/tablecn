/// <reference lib="webworker" />

// Runs the engine off the main thread: DOOM's simulation, sound mixing and music
// synthesis happen here, so the page's painting can't delay them. Frames go to the
// page as RGBA buffers, and audio streams straight to an AudioWorklet on the page

const DOOM_BASE = "/doom/";
const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;
// Samples kept queued ahead of playback
const AUDIO_AHEAD_BUFFERS = 3;

interface WorkerModule {
  HEAPU8?: Uint8Array;
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
  callMain?: (args: string[]) => void;
  _doom_frame_count?: () => number;
  _doom_palette?: () => number;
  _doom_screen?: () => number;
  _doom_set_paused?: (on: number) => void;
  _doom_menu_or_map_open?: () => number;
  _doom_post_event?: (
    type: number,
    data1: number,
    data2: number,
    data3: number,
  ) => void;
  [key: string]: unknown;
}

export type DoomWorkerRequest =
  | { type: "start"; sampleRate: number; audioPort: MessagePort }
  | { type: "event"; event: [number, number, number, number] }
  | { type: "pause"; paused: boolean }
  | { type: "recycle"; buffer: ArrayBuffer };

export type DoomWorkerResponse =
  | { type: "ready" }
  | {
      type: "frame";
      frame: number;
      buffer: ArrayBuffer;
      menuOrMapOpen: boolean;
    }
  | { type: "error"; message: string };

const scope = self as DedicatedWorkerGlobalScope & {
  AudioContext?: unknown;
};

function post(message: DoomWorkerResponse, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer);
}

// SDL's emscripten audio driver only needs an AudioContext with a script processor.
// This one has no output of its own: the worker runs the processor's callback when
// the page's worklet needs more samples, and hands the samples over
interface ScriptProcessorStandIn {
  bufferSize: number;
  channels: number;
  onaudioprocess: ((event: { outputBuffer: unknown }) => void) | null;
  connect: () => void;
  disconnect: () => void;
}

let processor: ScriptProcessorStandIn | null = null;
let sampleRate = 48_000;

class WorkerAudioContext {
  sampleRate = sampleRate;
  state = "running";
  destination = {};
  currentTime = 0;
  createScriptProcessor(bufferSize: number, _inputs: number, channels: number) {
    processor = {
      bufferSize,
      channels,
      onaudioprocess: null,
      connect: () => {},
      disconnect: () => {},
    };
    return processor;
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

function startAudio(port: MessagePort) {
  let sent = 0;
  let played = 0;
  port.addEventListener("message", (event: MessageEvent<number>) => {
    played = event.data;
  });
  port.start();
  const pump = () => {
    if (!processor?.onaudioprocess) return;
    const { bufferSize, channels } = processor;
    while (sent - played < bufferSize * AUDIO_AHEAD_BUFFERS) {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(bufferSize),
      );
      processor.onaudioprocess({
        outputBuffer: {
          numberOfChannels: channels,
          length: bufferSize,
          sampleRate,
          getChannelData: (channel: number) => data[channel],
        },
      });
      port.postMessage(
        data,
        data.map((channel) => channel.buffer),
      );
      sent += bufferSize;
    }
  };
  setInterval(pump, 5);
}

function startFrames(module: WorkerModule) {
  const spare: ArrayBuffer[] = [];
  scope.addEventListener(
    "message",
    (event: MessageEvent<DoomWorkerRequest>) => {
      if (event.data.type === "recycle") spare.push(event.data.buffer);
    },
  );
  const palette32 = new Uint32Array(256);
  let lastFrame = 0;
  const check = () => {
    const frame = module._doom_frame_count?.() ?? 0;
    const heap = module.HEAPU8;
    const screen = module._doom_screen?.();
    const palette = module._doom_palette?.();
    if (frame === lastFrame || !heap || !screen || !palette) return;
    lastFrame = frame;
    for (let c = 0; c < 256; c++) {
      const p = palette + c * 4;
      palette32[c] =
        0xff000000 |
        ((heap[p + 2] ?? 0) << 16) |
        ((heap[p + 1] ?? 0) << 8) |
        (heap[p] ?? 0);
    }
    const buffer =
      spare.pop() ?? new ArrayBuffer(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
    const rgba32 = new Uint32Array(buffer);
    for (let i = 0; i < rgba32.length; i++) {
      rgba32[i] = palette32[heap[screen + i] ?? 0] ?? 0;
    }
    const menuOrMapOpen = Boolean(module._doom_menu_or_map_open?.());
    post({ type: "frame", frame, buffer, menuOrMapOpen }, [buffer]);
  };
  setInterval(check, 4);
}

async function start(rate: number, audioPort: MessagePort) {
  sampleRate = rate;
  scope.AudioContext = WorkerAudioContext;
  // Without it SDL hooks gesture listeners on `document`, which workers lack.
  // The page resumes its own audio on the first gesture
  if (!("userActivation" in navigator)) {
    Object.defineProperty(navigator, "userActivation", {
      value: { hasBeenActive: true, isActive: true },
    });
  }

  const module: WorkerModule = {
    noInitialRun: true,
    locateFile: (path: string) => DOOM_BASE + path,
    print: () => {},
    printErr: () => {},
    onAbort: (reason: unknown) => {
      post({ type: "error", message: String(reason) });
    },
    preRun: [
      () => {
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
          "-pageframes",
          "-config",
          "default.cfg",
          "-extraconfig",
          "extra.cfg",
        ]);
      } catch (error) {
        post({ type: "error", message: String(error) });
        return;
      }
      startAudio(audioPort);
      startFrames(module);
      post({ type: "ready" });
    },
  };

  scope.addEventListener(
    "message",
    (event: MessageEvent<DoomWorkerRequest>) => {
      if (event.data.type === "event") {
        const [type, data1, data2, data3] = event.data.event;
        module._doom_post_event?.(type, data1, data2, data3);
      } else if (event.data.type === "pause") {
        module._doom_set_paused?.(event.data.paused ? 1 : 0);
      }
    },
  );

  // Imports the engine, an ES module exporting its factory, as served rather than bundled
  const engineUrl = new URL(
    `${DOOM_BASE}websockets-doom.js`,
    self.location.origin,
  );
  const { default: createDoom } = (await import(
    /* turbopackIgnore: true */ /* webpackIgnore: true */ engineUrl.href
  )) as { default: (module: WorkerModule) => Promise<WorkerModule> };
  await createDoom(module);
}

scope.addEventListener(
  "message",
  (event: MessageEvent<DoomWorkerRequest>) => {
    if (event.data.type === "start") {
      void start(event.data.sampleRate, event.data.audioPort).catch(
        (error: unknown) => {
          post({ type: "error", message: String(error) });
        },
      );
    }
  },
  { once: true },
);

scope.addEventListener("error", (event) => {
  post({ type: "error", message: event.message });
});
