import { voiceOverTest as test } from "@guidepup/playwright";
import { expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const QUIET_MS = 2500;
const MAX_LISTEN_MS = 15_000;

const LAST_PHRASE_SCRIPT = `tell application "VoiceOver"
with transaction
return content of last phrase
end transaction
end tell`;

test.describe("data table", () => {
  test.beforeEach(async ({ page, voiceOver }) => {
    await page.goto("/bases/radix?view=table", { timeout: 120_000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 60_000,
    });
    await voiceOver.navigateToWebContent();
  });

  test("speaks one result count after typing a search", async ({ page }) => {
    const spoken = await listen("search", () =>
      page
        .getByPlaceholder("Search tasks...")
        .pressSequentially("pixel", { delay: 150 }),
    );

    expectSpokenOnce(spoken, "7 results");
    expect(spoken).not.toMatch(/\b(?!7 )\d+ results?\b/);
  });

  test("speaks the page after moving to the next page", async ({ page }) => {
    const spoken = await listen("next page", () =>
      page.getByRole("button", { name: "Go to next page" }).click(),
    );

    expectSpokenOnce(spoken, "100 results, page 2 of 10");
  });

  test("speaks the selection count once", async ({ page }) => {
    const spoken = await listen("select row", () =>
      page.locator("tbody [role=checkbox]").first().click(),
    );

    expectSpokenOnce(spoken, "1 row selected");
  });
});

test.describe("data grid", () => {
  test.beforeEach(async ({ page, voiceOver }) => {
    await page.goto("/bases/radix?view=grid", { timeout: 120_000 });
    await expect(
      page.locator("[role=grid] [role=gridcell][aria-colindex]").first(),
    ).toBeVisible({ timeout: 60_000 });
    await voiceOver.navigateToWebContent();
  });

  test("speaks a sort and a row selection once each", async ({ page }) => {
    const grid = page.getByRole("grid");
    await grid
      .getByRole("columnheader", { name: "Name" })
      .getByRole("button")
      .click();

    const sorted = await listen("sort", () =>
      page.getByRole("menuitemcheckbox", { name: "Sort ascending" }).click(),
    );
    expectSpokenOnce(sorted, "Sorted by Name, ascending");

    const selected = await listen("select row", () =>
      grid.getByRole("gridcell", { name: "Select row 1", exact: true }).click(),
    );
    expectSpokenOnce(selected, "Row 1 selected");
  });

  test("speaks an edit, its undo and its redo without the toast", async ({
    page,
  }) => {
    await listen("focus cell", () => bodyCell(page, 2, 2).click());

    const edited = await listen("edit", async () => {
      await page.keyboard.press("Enter");
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("Edited");
      await page.keyboard.press("Enter");
    });
    expectSpokenOnce(edited, "Name updated");

    const undone = await listen("undo", async () => {
      await page.keyboard.press("ControlOrMeta+z");
      await expect(toast(page)).toHaveText("Action undone");
    });
    expectSpokenOnce(undone, "Undo: Name updated");
    expect(undone).not.toContain("Action undone");

    const redone = await listen("redo", async () => {
      await page.keyboard.press("ControlOrMeta+Shift+z");
      await expect(toast(page)).toHaveText("Action redone");
    });
    expectSpokenOnce(redone, "Redo: Name updated");
    expect(redone).not.toContain("Action redone");
  });

  test("speaks a paste once without the toast", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await listen("focus cell", () => bodyCell(page, 2, 2).click());
    await page.evaluate(() =>
      navigator.clipboard.writeText("Ada Lovelace\t36\nGrace Hopper\t85"),
    );

    const pasted = await listen("paste", async () => {
      await page.keyboard.press("ControlOrMeta+v");
      await expect(toast(page)).toHaveText("4 cells pasted");
    });
    expectSpokenOnce(pasted, "4 cells pasted");
  });

  test("speaks the cell when moving between cells", async ({ page }) => {
    await listen("focus cell", () => bodyCell(page, 2, 2).click());

    const down = await listen("arrow down", () =>
      page.keyboard.press("ArrowDown"),
    );
    await expect(bodyCell(page, 3, 2)).toBeFocused();
    expect(down).toContain(await cellText(page, 3, 2));

    const right = await listen("arrow right", () =>
      page.keyboard.press("ArrowRight"),
    );
    await expect(bodyCell(page, 3, 3)).toBeFocused();
    expect(right).toContain(await cellText(page, 3, 3));
  });
});

function bodyCell(page: Page, row: number, col: number) {
  return page.locator(
    `[role=grid] [role=row][aria-rowindex='${row}'] [role=gridcell][aria-colindex='${col}']`,
  );
}

async function cellText(page: Page, row: number, col: number) {
  return (await bodyCell(page, row, col).innerText()).trim();
}

function toast(page: Page) {
  return page.locator("[data-sonner-toast]").first();
}

// Guidepup polls after each action and sleeps while a long phrase is spoken,
// so it misses a short announcement that VoiceOver speaks right after focus moves.
async function listen(label: string, action: () => Promise<unknown>) {
  const phrases: string[] = [];
  let last = await readLastPhrase();
  const acting = new AbortController();
  let lastChange = Date.now();
  const startedAt = Date.now();

  const polling = (async () => {
    while (
      (!acting.signal.aborted || Date.now() - lastChange < QUIET_MS) &&
      Date.now() - startedAt < MAX_LISTEN_MS
    ) {
      const phrase = await readLastPhrase();
      if (phrase && phrase !== last) {
        phrases.push(phrase);
        last = phrase;
        lastChange = Date.now();
      }
    }
  })();

  try {
    await action();
  } finally {
    acting.abort();
    lastChange = Date.now();
    await polling;
  }

  const file = test.info().outputPath("spoken-phrase-log.jsonl");
  await fs.appendFile(file, `${JSON.stringify({ label, phrases })}\n`);
  console.log(`[voiceover] ${label}: ${JSON.stringify(phrases)}`);
  return phrases.join(" | ");
}

const execFileAsync = promisify(execFile);

async function readLastPhrase() {
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      LAST_PHRASE_SCRIPT,
    ]);
    return stdout
      .trim()
      .replace(/^missing value$/, "")
      .replace(/\s\s+/g, " ");
  } catch {
    return "";
  }
}

function expectSpokenOnce(spoken: string, message: string) {
  expect(spoken.split(message).length - 1, spoken).toBe(1);
}
