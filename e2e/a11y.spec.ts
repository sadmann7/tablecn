import type { virtual } from "@guidepup/virtual-screen-reader";

import { AxeBuilder } from "@axe-core/playwright";
import {
  expect,
  type Locator,
  type Page,
  test,
  type TestInfo,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type ScreenReaderWindow = Window & { screenReader: typeof virtual };

const SCREEN_READER_SOURCE = fs.readFileSync(
  path.join(
    process.cwd(),
    "node_modules/@guidepup/virtual-screen-reader/lib/esm/index.browser.js",
  ),
  "utf8",
);

const ANNOUNCEMENT_SETTLE_MS = 1000;

const TABLE_BASES = ["radix", "base", "aria"] as const;
const GRID_BASES = ["radix", "base"] as const;

const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

const MAX_TABS = 80;

for (const base of TABLE_BASES) {
  test.describe(`${base} data table`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/bases/${base}?view=table`, {
        waitUntil: "networkidle",
      });
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("has no axe violations", async ({ page }, testInfo) => {
      await expectNoAxeViolations(page, testInfo);
    });

    test("sorts from the header menu with the keyboard", async ({ page }) => {
      const header = page.getByRole("columnheader", { name: "Title" });

      if (base === "aria") {
        await tabUntilFocused(page, page.locator("tbody tr:focus"));
        for (const key of ["ArrowUp", "ArrowRight", "ArrowRight"]) {
          await page.keyboard.press(key);
        }
      } else {
        await tabUntilFocused(page, header.locator("button:focus"));
      }
      await expect(header.getByRole("button", { name: "Title" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page
          .locator("[role=menu] [role^=menuitem]")
          .filter({ hasText: /^Asc$/ }),
      ).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(header).toHaveAttribute("aria-sort", "ascending");
      await expect(sortedHeaders(page)).toHaveCount(1);
    });

    test("stays silent while the page loads", async ({ page }) => {
      await page.goto(`/bases/${base}?view=table`, { waitUntil: "commit" });
      await page.waitForFunction(() => document.body.childElementCount > 0);
      await startScreenReader(page);

      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.waitForLoadState("networkidle");

      await expectSpokenAnnouncements(page, []);
    });

    test("speaks one result count after typing a search", async ({ page }) => {
      await startScreenReader(page);
      const search = page.getByPlaceholder("Search tasks...");

      await search.pressSequentially("pixel", { delay: 150 });
      await expectSpokenAnnouncements(page, ["polite: 7 results"]);

      await search.fill("zzzz");
      await expectSpokenAnnouncements(page, ["polite: No results"]);
    });

    test("speaks the page after moving to the next page", async ({ page }) => {
      await startScreenReader(page);

      await page.getByRole("button", { name: "Go to next page" }).click();

      await expectSpokenAnnouncements(page, [
        "polite: 100 results, page 2 of 10",
      ]);
    });

    test("announces the selection count", async ({ page }) => {
      const status = page
        .getByRole("status")
        .filter({ hasText: /rows? selected/ });
      await expect(status).toHaveText("0 rows selected.");

      await tabUntilFocused(
        page,
        page.locator(
          base === "aria" ? "tbody tr:focus" : "tbody [role=checkbox]:focus",
        ),
      );
      await page.keyboard.press("Space");

      await expect(status).toHaveText("1 row selected.");
    });
  });
}

for (const base of GRID_BASES) {
  test.describe(`${base} data grid`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/bases/${base}?view=grid`, { waitUntil: "networkidle" });
      await expect(
        page.locator("[role=grid] [role=gridcell][aria-colindex]").first(),
      ).toBeVisible();
    });

    test("has no axe violations", async ({ page }, testInfo) => {
      await expectNoAxeViolations(page, testInfo);
    });

    test("keeps the focused cell as the only tab stop", async ({ page }) => {
      const grid = page.getByRole("grid");
      await tabUntilFocused(
        page,
        grid.locator("[data-slot=data-grid-body] [role=gridcell]:focus"),
      );

      const extraTabStops = await grid.evaluate((element) =>
        Array.from(
          element.querySelectorAll<HTMLElement>(
            "[tabindex], a[href], button, input, select, textarea",
          ),
        )
          .filter(
            (candidate) =>
              candidate !== document.activeElement &&
              candidate.tabIndex >= 0 &&
              !candidate.matches(":disabled") &&
              // The add-row cell is the grid's own exit stop after Escape.
              !candidate.closest("[data-slot=data-grid-add-row]"),
          )
          .map(
            (candidate) =>
              `${candidate.tagName.toLowerCase()}[role=${candidate.getAttribute("role")}]`,
          ),
      );

      expect(extraTabStops).toEqual([]);
    });

    test("moves the focused cell with the arrow keys", async ({ page }) => {
      const grid = page.getByRole("grid");
      await tabUntilFocused(
        page,
        grid.locator("[data-slot=data-grid-body] [role=gridcell]:focus"),
      );

      const start = await focusedCellPosition(page);
      expect(start.row).toBeGreaterThan(0);
      expect(start.col).toBeGreaterThan(0);

      await page.keyboard.press("ArrowDown");
      await expect
        .poll(() => focusedCellPosition(page))
        .toEqual({ role: "gridcell", row: start.row + 1, col: start.col });

      await page.keyboard.press("ArrowRight");
      await expect
        .poll(() => focusedCellPosition(page))
        .toEqual({ role: "gridcell", row: start.row + 1, col: start.col + 1 });

      await page.keyboard.press("ArrowUp");
      await expect
        .poll(() => focusedCellPosition(page))
        .toEqual({ role: "gridcell", row: start.row, col: start.col + 1 });

      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => focusedCellPosition(page)).toEqual(start);
    });

    test("sorts from the header menu with the keyboard", async ({ page }) => {
      const grid = page.getByRole("grid");
      const header = grid.getByRole("columnheader", { name: "Name" });
      await tabUntilFocused(
        page,
        grid.locator("[data-slot=data-grid-body] [role=gridcell]:focus"),
      );

      await page.keyboard.press("ArrowUp");
      await expect(header.getByRole("button")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("menuitemcheckbox", { name: "Sort ascending" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(announcer(page)).toHaveText("Sorted by Name, ascending");
      await expect(header).toHaveAttribute("aria-sort", "ascending");
      await expect(sortedHeaders(page)).toHaveCount(1);
    });

    test("speaks each sort and selection change once", async ({ page }) => {
      const grid = page.getByRole("grid");
      await startScreenReader(page);

      await grid
        .getByRole("columnheader", { name: "Name" })
        .getByRole("button")
        .click();
      await page
        .getByRole("menuitemcheckbox", { name: "Sort ascending" })
        .click();
      await expectSpokenAnnouncements(page, [
        "polite: Sorted by Name, ascending",
      ]);

      await grid
        .getByRole("gridcell", { name: "Select row 1", exact: true })
        .click();
      await expectSpokenAnnouncements(page, ["polite: Row 1 selected"]);
    });

    test("speaks each search match count once", async ({ page }) => {
      await page.getByRole("gridcell").nth(1).click();
      await page.keyboard.press("ControlOrMeta+f");
      const search = page.getByRole("textbox", { name: "Find in table" });
      await startScreenReader(page);

      await search.fill("ab");
      await expect
        .poll(() => readSpokenPhrases(page))
        .toContain("polite: 1 of 44");
      await page.waitForTimeout(ANNOUNCEMENT_SETTLE_MS);
      expect(
        (await readSpokenPhrases(page)).filter(
          (phrase) => phrase === "polite: 1 of 44",
        ),
      ).toHaveLength(1);
    });

    test("speaks an edit, its undo and its redo", async ({ page }) => {
      const nameCell = page
        .getByRole("grid")
        .getByRole("row")
        .nth(1)
        .getByRole("gridcell")
        .nth(1);
      await nameCell.click();
      await startScreenReader(page);

      await page.keyboard.press("Enter");
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("Edited");
      await page.keyboard.press("Enter");
      await expectSpokenAnnouncements(page, ["polite: Name updated"]);

      await page.keyboard.press("ControlOrMeta+z");
      await expectSpokenAnnouncements(page, ["polite: Undo: Name updated"]);

      await page.keyboard.press("ControlOrMeta+Shift+z");
      await expectSpokenAnnouncements(page, ["polite: Redo: Name updated"]);
    });

    test("exposes row selection on the row, cells and checkboxes", async ({
      page,
    }) => {
      const grid = page.getByRole("grid");
      const headerRow = grid.getByRole("row").first();
      const firstRow = grid.getByRole("row").nth(1);

      await expect(firstRow).toMatchAriaSnapshot(`
        - row [selected=false]:
          - gridcell "Select row 1":
            - checkbox "Select row 1" [checked=false]
          - gridcell [selected=false]
      `);

      await grid
        .getByRole("gridcell", { name: "Select row 1", exact: true })
        .click();

      await expect(announcer(page)).toHaveText("Row 1 selected");
      await expect(firstRow).toMatchAriaSnapshot(`
        - row [selected]:
          - gridcell "Select row 1":
            - checkbox "Select row 1" [checked]
          - gridcell [selected]
      `);
      await expect(headerRow).toMatchAriaSnapshot(`
        - row:
          - columnheader "Select all":
            - checkbox "Select all" [checked=mixed]
      `);
    });
  });
}

function focusedCellPosition(page: Page) {
  return page.evaluate(() => {
    const cell = document.activeElement;
    return {
      role: cell?.getAttribute("role") ?? null,
      row: Number(cell?.closest("[role=row]")?.getAttribute("aria-rowindex")),
      col: Number(cell?.getAttribute("aria-colindex")),
    };
  });
}

function announcer(page: Page) {
  return page.locator("[data-live-announcer=polite]");
}

async function expectNoAxeViolations(page: Page, testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  await testInfo.attach("axe-violations", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
    })),
  ).toEqual([]);
}

async function startScreenReader(page: Page) {
  await page.evaluate(async (source) => {
    const url = URL.createObjectURL(
      new Blob([source], { type: "text/javascript" }),
    );
    const { virtual: screenReader } = await import(url);
    await screenReader.start({ container: document.body });
    (window as unknown as ScreenReaderWindow).screenReader = screenReader;
  }, SCREEN_READER_SOURCE);
}

function readSpokenPhrases(page: Page) {
  return page.evaluate(async () => {
    const { screenReader } = window as unknown as ScreenReaderWindow;
    const phrases = await screenReader.spokenPhraseLog();
    return phrases.filter((phrase) => /^(polite|assertive): /.test(phrase));
  });
}

async function expectSpokenAnnouncements(page: Page, expected: string[]) {
  await expect.poll(() => readSpokenPhrases(page)).toEqual(expected);
  await page.waitForTimeout(ANNOUNCEMENT_SETTLE_MS);
  expect(await readSpokenPhrases(page)).toEqual(expected);

  await page.evaluate(() =>
    (
      window as unknown as ScreenReaderWindow
    ).screenReader.clearSpokenPhraseLog(),
  );
}

function sortedHeaders(page: Page) {
  return page.locator(
    "[role=columnheader][aria-sort=ascending], [role=columnheader][aria-sort=descending], th[aria-sort=ascending], th[aria-sort=descending]",
  );
}

async function tabUntilFocused(page: Page, target: Locator) {
  await page.locator("body").click({ position: { x: 1, y: 1 } });

  for (let index = 0; index < MAX_TABS; index++) {
    await page.keyboard.press("Tab");
    if ((await target.count()) > 0) return;
  }

  throw new Error(`Tab never reached the target in ${MAX_TABS} presses.`);
}
