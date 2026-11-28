import { withGuidepup } from "@guidepup/playwright";
import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const port = Number(process.env.PORT) || 3000;
const baseURL = `http://localhost:${port}`;

// Starts the real VoiceOver, so it only runs on a machine set up with `@guidepup/setup`.
export default withGuidepup(
  defineConfig({
    testDir: "e2e",
    testMatch: "**/voiceover.spec.ts",
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    timeout: 5 * 60_000,
    reportSlowTests: null,
    reporter: isCI ? [["list"], ["github"]] : "list",
    use: {
      baseURL,
      locale: "en-US",
      trace: "retain-on-failure",
    },
    webServer: {
      command: `node_modules/.bin/next dev --port ${port}`,
      url: baseURL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      stdout: isCI ? "pipe" : "ignore",
    },
    projects: [
      {
        name: "voiceover",
        use: {
          ...devices["Desktop Chrome"],
          viewport: { width: 1440, height: 900 },
        },
      },
    ],
  }),
);
