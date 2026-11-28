import {
  voiceOverTest as test,
  type VoiceOverPlaywright,
} from "@guidepup/playwright";
import { expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";

test.use({ voiceOverStartOptions: { capture: true } });

test.afterEach(async ({ voiceOver }, testInfo) => {
  const log = await voiceOver.spokenPhraseLog();
  const file = testInfo.outputPath("spoken-phrase-log.json");
  await fs.writeFile(file, JSON.stringify(log, null, 2));
  await testInfo.attach("spoken-phrase-log", {
    path: file,
    contentType: "application/json",
  });
});

test.describe("data table", () => {
  test.beforeEach(async ({ page, voiceOver }) => {
    await page.goto("/bases/radix?view=table", { timeout: 120_000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 60_000,
    });
    await voiceOver.navigateToWebContent();
  });

  test("speaks one result count after typing a search", async ({
    page,
    voiceOver,
  }) => {
    const spoken = await listen(voiceOver, "search", () =>
      page
        .getByPlaceholder("Search tasks...")
        .pressSequentially("pixel", { delay: 150 }),
    );

    expectSpokenOnce(spoken, "7 results");
    expect(spoken).not.toMatch(/\b(?!7 )\d+ results?\b/);
  });

  test("speaks the page after moving to the next page", async ({
    page,
    voiceOver,
  }) => {
    const spoken = await listen(voiceOver, "next page", () =>
      page.getByRole("button", { name: "Go to next page" }).click(),
    );

    expectSpokenOnce(spoken, "100 results, page 2 of 10");
  });

  test("speaks the selection count once", async ({ page, voiceOver }) => {
    const spoken = await listen(voiceOver, "select row", () =>
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

  test("speaks a sort and a row selection once each", async ({
    page,
    voiceOver,
  }) => {
    const grid = page.getByRole("grid");
    await grid
      .getByRole("columnheader", { name: "Name" })
      .getByRole("button")
      .click();

    const sorted = await listen(voiceOver, "sort", () =>
      page.getByRole("menuitemcheckbox", { name: "Sort ascending" }).click(),
    );
    expectSpokenOnce(sorted, "Sorted by Name, ascending");

    const selected = await listen(voiceOver, "select row", () =>
      grid.getByRole("gridcell", { name: "Select row 1", exact: true }).click(),
    );
    expectSpokenOnce(selected, "Row 1 selected");
  });

  test("speaks an edit, its undo and its redo without the toast", async ({
    page,
    voiceOver,
  }) => {
    await bodyCell(page, 2, 2).click();

    const edited = await listen(voiceOver, "edit", async () => {
      await page.keyboard.press("Enter");
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("Edited");
      await page.keyboard.press("Enter");
    });
    expectSpokenOnce(edited, "Name updated");

    const undone = await listen(voiceOver, "undo", () =>
      page.keyboard.press("ControlOrMeta+z"),
    );
    expectSpokenOnce(undone, "Undo: Name updated");
    expect(undone).not.toContain("Action undone");
    await expect(toast(page)).toHaveText("Action undone");

    const redone = await listen(voiceOver, "redo", () =>
      page.keyboard.press("ControlOrMeta+Shift+z"),
    );
    expectSpokenOnce(redone, "Redo: Name updated");
    expect(redone).not.toContain("Action redone");
    await expect(toast(page)).toHaveText("Action redone");
  });

  test("speaks a paste once without the toast", async ({
    page,
    context,
    voiceOver,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await bodyCell(page, 2, 2).click();
    await page.evaluate(() =>
      navigator.clipboard.writeText("Ada Lovelace\t36\nGrace Hopper\t85"),
    );

    const pasted = await listen(voiceOver, "paste", () =>
      page.keyboard.press("ControlOrMeta+v"),
    );
    expectSpokenOnce(pasted, "4 cells pasted");
    await expect(toast(page)).toHaveText("4 cells pasted");
  });

  test("speaks the row and column when moving between cells", async ({
    page,
    voiceOver,
  }) => {
    await bodyCell(page, 2, 2).click();

    const down = await listen(voiceOver, "arrow down", () =>
      page.keyboard.press("ArrowDown"),
    );
    const downText = await bodyCell(page, 3, 2).innerText();
    expect(down).toContain(downText.trim());

    const right = await listen(voiceOver, "arrow right", () =>
      page.keyboard.press("ArrowRight"),
    );
    const rightText = await bodyCell(page, 3, 3).innerText();
    expect(right).toContain(rightText.trim());
  });
});

function bodyCell(page: Page, row: number, col: number) {
  return page.locator(
    `[role=grid] [role=row][aria-rowindex='${row}'] [role=gridcell][aria-colindex='${col}']`,
  );
}

function toast(page: Page) {
  return page.locator("[data-sonner-toast]").first();
}

async function listen(
  voiceOver: VoiceOverPlaywright,
  label: string,
  action: () => Promise<unknown>,
) {
  const { spokenPhrase } = await voiceOver.capture(action, { capture: true });
  console.log(`[voiceover] ${label}: ${JSON.stringify(spokenPhrase)}`);
  return spokenPhrase;
}

function expectSpokenOnce(spoken: string, message: string) {
  expect(spoken.split(message).length - 1, spoken).toBe(1);
}
