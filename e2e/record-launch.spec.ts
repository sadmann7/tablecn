import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OUTPUT = path.resolve("recordings/launch-demo.webm");

test("record one launch loop", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/launch");
  const stage = page.locator(".launch-stage");
  await page.evaluate(() => document.fonts.ready);

  // A click runs after the shortcut listener is attached. Hide the controls
  // first, then restart so the kept loop begins at the intro.
  await page.getByRole("button", { name: /to hide/ }).click();
  const cycleBeforeRestart = await stage.getAttribute("data-cycle");
  await page.keyboard.press("r");
  await expect(stage).not.toHaveAttribute(
    "data-cycle",
    cycleBeforeRestart ?? "",
  );

  const cycle = Number(await stage.getAttribute("data-cycle"));
  const duration = Number(await stage.getAttribute("data-duration"));
  await expect(stage).toHaveAttribute("data-cycle", String(cycle + 1), {
    timeout: duration + 10_000,
  });

  const video = page.video();
  await page.close();
  const rawPath = await video?.path();
  if (!rawPath) throw new Error("Playwright did not record a video");

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  const didTrim = await trimToLastLoop(rawPath, OUTPUT, duration);

  console.log(
    didTrim
      ? `Wrote ${OUTPUT}`
      : `Wrote ${OUTPUT}. ffmpeg is not installed, so the file still includes the moment before the intro.`,
  );
});

/** Keeps the last loop. The recording also contains loading and the restart. */
async function trimToLastLoop(
  rawPath: string,
  outputPath: string,
  durationMs: number,
) {
  try {
    const seconds = (durationMs / 1000).toFixed(3);
    // Re-encode so the cut lands on the intro, not the previous keyframe.
    await execFileAsync("ffmpeg", [
      "-y",
      "-sseof",
      `-${seconds}`,
      "-i",
      rawPath,
      "-t",
      seconds,
      "-an",
      "-c:v",
      "libvpx-vp9",
      "-b:v",
      "0",
      "-crf",
      "18",
      "-deadline",
      "good",
      "-cpu-used",
      "2",
      outputPath,
    ]);
    return true;
  } catch {
    await rename(rawPath, outputPath);
    return false;
  }
}
