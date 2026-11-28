import { AxeBuilder } from "@axe-core/playwright";
import {
  expect,
  type Locator,
  type Page,
  test,
  type TestInfo,
} from "@playwright/test";

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

    test("announces the result count after a search", async ({ page }) => {
      const status = page.getByRole("status").filter({ hasText: /results?$/ });
      await expect(status).toHaveText(/^[\d,]+ results?$/);

      await page.getByPlaceholder("Search tasks...").fill("zzzz");

      await expect(status).toHaveText("No results");
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
