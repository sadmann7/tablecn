import { expect, test, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OUTPUT = path.resolve("recordings/launch-demo.webm");
const FRAMES = path.resolve("recordings/.frames");

interface CapturedFrame {
  file: string;
  timestamp: number;
}

interface PendingFrame {
  data: string;
  timestamp: number;
}

test("record one launch loop", async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto("/launch");
  const stage = page.locator(".launch-stage");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });

  // A click runs after the shortcut listener is attached. Hide the controls
  // first, then restart so the kept loop begins at the intro.
  await expect(async () => {
    const hide = page.getByRole("button", { name: /to hide/ });
    await hide.click({ timeout: 2_000 });
    await expect(hide).toBeHidden({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  const capture = await startCapture(page);
  await expect.poll(() => capture.latestTimestamp()).toBeGreaterThan(0);
  const cycleBeforeRestart = await stage.getAttribute("data-cycle");
  await page.keyboard.press("r");
  await expect(stage).not.toHaveAttribute(
    "data-cycle",
    cycleBeforeRestart ?? "",
  );
  const loopStart = capture.latestTimestamp();

  const cycle = Number(await stage.getAttribute("data-cycle"));
  const duration = Number(await stage.getAttribute("data-duration"));
  await expect(stage).toHaveAttribute("data-cycle", String(cycle + 1), {
    timeout: duration + 10_000,
  });
  const loopEnd = capture.latestTimestamp();
  const frames = await capture.stop();
  const loop = frames.filter(
    (frame) => frame.timestamp >= loopStart && frame.timestamp < loopEnd,
  );
  if (loop.length < 2) throw new Error("Screencast captured no loop frames");

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await encodeLoop(loop, OUTPUT, duration);
  await rm(FRAMES, { recursive: true, force: true });
  console.log(`Wrote ${OUTPUT}`);
});

/**
 * Playwright's built-in video is a low-bitrate VP8 screencast. Re-encoding it
 * cannot recover the dot grid, so this stores PNG frames and encodes once.
 */
async function startCapture(page: Page) {
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });

  const client = await page.context().newCDPSession(page);
  const pending: PendingFrame[] = [];
  let isStopped = false;

  client.on("Page.screencastFrame", (event) => {
    const frame = readScreencastFrame(event);
    if (!frame) return;

    // Ack before any copying. Decoding PNGs here stalls Chrome and the
    // recording freezes for a few frames at a time.
    void client.send("Page.screencastFrameAck", { sessionId: frame.sessionId });
    if (!isStopped) pending.push(frame);
  });

  await client.send("Page.startScreencast", {
    format: "png",
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1,
  });

  return {
    latestTimestamp: () => pending.at(-1)?.timestamp ?? 0,
    stop: async () => {
      isStopped = true;
      await client.send("Page.stopScreencast");
      await client.detach();

      const frames: CapturedFrame[] = [];
      for (const [index, frame] of pending.entries()) {
        const file = path.join(FRAMES, `${String(index).padStart(5, "0")}.png`);
        frames.push({ file, timestamp: frame.timestamp });
        await writeFile(file, Buffer.from(frame.data, "base64"));
      }
      return frames;
    },
  };
}

function readScreencastFrame(event: unknown) {
  if (typeof event !== "object" || event === null) return null;
  if (!("data" in event) || !("sessionId" in event) || !("metadata" in event)) {
    return null;
  }

  const { data, sessionId, metadata } = event;
  if (typeof data !== "string" || typeof sessionId !== "number") return null;
  if (typeof metadata !== "object" || metadata === null) return null;
  if (!("timestamp" in metadata) || typeof metadata.timestamp !== "number") {
    return null;
  }

  return { data, sessionId, timestamp: metadata.timestamp };
}

async function encodeLoop(
  frames: CapturedFrame[],
  outputPath: string,
  durationMs: number,
) {
  const listPath = path.join(FRAMES, "list.txt");
  await writeFile(listPath, concatList(frames));
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-an",
    "-vf",
    "fps=60",
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    "0",
    "-crf",
    "10",
    "-deadline",
    "good",
    "-cpu-used",
    "2",
    "-row-mt",
    "1",
    outputPath,
  ]);

  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    outputPath,
  ]);
  const actual = Number(stdout);
  const expected = durationMs / 1000;
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 1) {
    throw new Error(`Recording is ${actual}s, expected ${expected}s`);
  }
}

function concatList(frames: CapturedFrame[]) {
  const lines = ["ffconcat version 1.0"];

  for (const [index, frame] of frames.entries()) {
    const next = frames[index + 1];
    // Keep dropped frames on the real clock instead of skipping ahead.
    const duration = next
      ? Math.max(0.001, next.timestamp - frame.timestamp)
      : 1 / 30;
    lines.push(`file '${frame.file}'`, `duration ${duration.toFixed(6)}`);
  }

  const last = frames.at(-1);
  if (last) lines.push(`file '${last.file}'`);
  return lines.join("\n");
}
