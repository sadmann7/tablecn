import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  testIgnore: "**/record-launch.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  globalTimeout: isCI ? 10 * 60_000 : undefined,
  reporter: isCI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    locale: "en-US",
    trace: "on-first-retry",
  },
  webServer: {
    command: isCI
      ? "node_modules/.bin/next start"
      : "node_modules/.bin/next dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: isCI ? "pipe" : "ignore",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
