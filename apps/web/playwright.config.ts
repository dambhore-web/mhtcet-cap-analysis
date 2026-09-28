import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the real API code serving the invented demo dataset
 * (`apps/api/src/demo`), so no database or secrets are needed, locally or in CI.
 */
const WEB_PORT = 5173;
/** E2E_LIVE=1 runs the real API against DATABASE_URL_STAGING instead of the demo dataset. */
const LIVE = !!process.env.E2E_LIVE;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    serviceWorkers: "block",
    // Optional: use a pre-installed Chromium instead of the one `playwright install` downloads
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: LIVE
    ? [{ name: "live", use: { ...devices["Desktop Chrome"] }, grep: /@live/ }]
    : [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@phone|@live/ },
        { name: "phone", use: { ...devices["Pixel 7"] }, grep: /@phone/ },
      ],
  webServer: [
    {
      command: LIVE ? "npm run start -w @mhtcet/api" : "npm run dev:demo -w @mhtcet/api",
      url: "http://localhost:3001/api/health",
      // every test shares one IP; the API's per-IP budgets would throttle the suite itself
      env: { ...process.env, RATE_LIMITS: "off" } as Record<string, string>,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run dev -w @mhtcet/web -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
