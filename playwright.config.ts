import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const port = Number(process.env.PORT) || 3000;
const baseURL = `http://localhost:${port}`;

// The /bases pages only render under `next dev`, so the a11y run asks for it in CI.
const isDevServer = !isCI || process.env.E2E_DEV_SERVER === "true";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  globalTimeout: isCI ? 10 * 60_000 : undefined,
  reporter: isCI ? [["list"], ["github"]] : "list",
  use: {
    baseURL,
    locale: "en-US",
    trace: "on-first-retry",
  },
  webServer: {
    command: isDevServer
      ? `node_modules/.bin/next dev --port ${port}`
      : `node_modules/.bin/next start --port ${port}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: isCI ? "pipe" : "ignore",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [
        "**/record-data-table-launch.spec.ts",
        "**/a11y.spec.ts",
        "**/voiceover.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "a11y",
      testMatch: "**/a11y.spec.ts",
      timeout: 60_000,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
