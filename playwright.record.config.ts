import { defineConfig, devices } from "@playwright/test";

const viewport = { width: 1920, height: 1080 };
const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/record-launch.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "recordings/.playwright",
  use: {
    baseURL,
    viewport,
    deviceScaleFactor: 1,
    video: "off",
    launchOptions: { args: ["--enable-gpu"] },
  },
  webServer: {
    command:
      "node_modules/.bin/next build && node_modules/.bin/next start --port 3100",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 600_000,
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
