import { expect, type Locator, type Page, test } from "@playwright/test";

const COLUMN_LABELS = [
  "Title",
  "Status",
  "Priority",
  "Est. Hours",
  "Created At",
] as const;

test("plain filters load from a column param and limit the rows", async ({
  page,
}) => {
  await page.goto("/?status=todo,done");
  await expect(
    page.getByRole("button", { name: /Status Todo Done/ }),
  ).toBeVisible();

  const rows = dataRows(page);
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();

  for (let index = 0; index < count; index++) {
    await expect(cell(rows.nth(index), 3)).toHaveText(/^(todo|done)$/);
  }
});

test("advanced filters load operators, dates, and a bad param on its own", async ({
  page,
}) => {
  await page.goto(
    "/?filterMode=advanced&status=not.in.todo&estimatedHours=gte.2&estimatedHours=LTE.8&title=ilike.the&createdAt=2026-01-01,2026-12-31&priority=bogus.xyz",
  );
  await page.getByRole("button", { name: /^Filter/ }).click();

  const menu = page.getByRole("dialog", { name: "Filters" });
  await expect(
    menu.getByRole("combobox").filter({ hasText: "Contains" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("textbox", { name: "Title filter value" }),
  ).toHaveValue("the");
  await expect(
    menu.getByRole("combobox").filter({ hasText: "Has none of" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("combobox").filter({ hasText: "Has any of" }),
  ).toBeVisible();
  await expect(
    menu
      .getByRole("combobox")
      .filter({ hasText: "Is greater than or equal to" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("combobox").filter({ hasText: "Is less than or equal to" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("spinbutton", { name: "Est. Hours filter value" }).nth(0),
  ).toHaveValue("2");
  await expect(
    menu.getByRole("spinbutton", { name: "Est. Hours filter value" }).nth(1),
  ).toHaveValue("8");
  await expect(
    menu.getByRole("combobox").filter({ hasText: "Is between" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Created At date filter" }),
  ).toContainText("Jan 1, 2026");
  await expect(
    menu.getByRole("button", { name: "Priority filter values" }),
  ).toContainText("bogus.xyz");
});

test("joinOperator=or is the join shown between filters", async ({ page }) => {
  await page.goto(
    "/?filterMode=advanced&status=todo&priority=high&joinOperator=or",
  );
  await page.getByRole("button", { name: /^Filter/ }).click();

  await expect(
    page.getByRole("combobox", { name: "Select join operator" }),
  ).toHaveText("or");

  const rows = dataRows(page);
  await expect(rows.first()).toBeVisible();
  const statuses = await rows.evaluateAll((elements) =>
    elements.map(
      (row) => row.querySelectorAll("td")[3]?.textContent?.trim() ?? "",
    ),
  );
  expect(statuses.some((status) => status !== "todo")).toBe(true);
});

test("a calendar date range and an open number bound show on the toolbar", async ({
  page,
}) => {
  await page.goto("/?createdAt=2020-01-01,2020-01-31");
  await expect(
    page.getByRole("button", {
      name: /Created At January 1, 2020 - January 31, 2020/,
    }),
  ).toBeVisible();
  await expect(page.getByText("No results.")).toBeVisible();

  await page.goto("/?estimatedHours=,3");
  await expect(
    page.getByRole("button", { name: /Est\. Hours\s*\d+ - 3 hr/ }),
  ).toBeVisible();

  const rows = dataRows(page);
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  for (let index = 0; index < count; index++) {
    const hours = Number(await cell(rows.nth(index), 5).innerText());
    expect(hours).toBeLessThanOrEqual(3);
  }
});

test("filters loaded from the URL keep the param order", async ({ page }) => {
  await page.goto(
    "/?filterMode=advanced&createdAt=2026-09-01,2026-10-31&estimatedHours=gte.2&status=not.in.todo&title=the",
  );
  await page.getByRole("button", { name: /^Filter/ }).click();

  await expect
    .poll(() => filterColumns(page))
    .toEqual(["Created At", "Est. Hours", "Status", "Title"]);
});

test("an edit writes params in filter order, in the short form", async ({
  page,
}) => {
  await page.goto("/?createdAt=2026-09-01,2026-10-31&title=the");
  await page
    .getByRole("button", { name: "Priority", exact: true })
    .first()
    .click();
  await page.getByRole("option", { name: /^High/ }).click();

  await expect
    .poll(() => decodeURIComponent(page.url()))
    .toContain("createdAt=2026-09-01,2026-10-31&title=the&priority=high");

  await page.goto(
    "/?filterMode=advanced&estimatedHours=gte.2&estimatedHours=LTE.8&title=ilike.the",
  );
  await page.getByRole("button", { name: /^Filter/ }).click();
  await page.getByRole("spinbutton").first().fill("1.5");

  await expect
    .poll(() => decodeURIComponent(page.url()))
    .toContain("estimatedHours=gte.1.5&estimatedHours=lte.8&title=the");
});

function dataRows(page: Page) {
  return page.getByRole("row").filter({
    has: page.getByRole("checkbox", { name: "Select row" }),
  });
}

function cell(row: Locator, index: number) {
  return row.getByRole("cell").nth(index);
}

async function filterColumns(page: Page) {
  const names = await page
    .locator("[data-slot=popover-content]")
    .getByRole("button")
    .allTextContents();

  return names
    .map((name) => name.trim())
    .filter((name) => COLUMN_LABELS.some((label) => label === name));
}
