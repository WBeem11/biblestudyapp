import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
// E2E_PORT lets the suite run beside a dev server already using :3000.
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: CI ? 1 : 0,
  // "github" turns each failure into a run annotation, readable without signing in to see logs.
  reporter: CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Locally use the installed Chrome; CI installs Playwright's Chromium.
    // PW_CHANNEL=chrome reproduces CI locally without downloading Playwright's Chromium.
    channel: process.env.PW_CHANNEL ?? (CI ? undefined : "chrome"),
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
