import { defineConfig, devices } from "@playwright/test";

const viewport = { width: 1920, height: 1080 };

/** Records the launch demo. Kept separate so `pnpm test:e2e` does not film it. */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/record-launch.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "recordings/.playwright",
  use: {
    baseURL: "http://localhost:3000",
    viewport,
    deviceScaleFactor: 1,
    video: { mode: "on", size: viewport },
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport,
        deviceScaleFactor: 1,
      },
    },
  ],
});
