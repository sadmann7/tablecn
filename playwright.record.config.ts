import { defineConfig, devices } from "@playwright/test";

const viewport = { width: 1920, height: 1080 };
// A separate port, so a production run never reuses a running dev server
const isProd = !!process.env.LAUNCH_RECORD_PROD;
const port = isProd ? 3100 : 3000;
const baseURL = `http://localhost:${port}`;

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
    // Headless Chrome rasterizes on the CPU by default, which holds the
    // screencast near 19fps and bands the backdrop's blurred gradients.
    launchOptions: { args: ["--enable-gpu"] },
  },
  webServer: isProd
    ? {
        command: `node_modules/.bin/next build && node_modules/.bin/next start --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 600_000,
      }
    : {
        command: "node_modules/.bin/next dev",
        url: baseURL,
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
