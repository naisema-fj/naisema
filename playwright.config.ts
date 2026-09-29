import { defineConfig, devices } from "@playwright/test";

const port = 4173;
// Local sandboxes may provide a Chromium build that differs from the one this
// Playwright version expects; CI installs the matching browser instead.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
  ],
  webServer: {
    // Serves the production build with local D1, migrated and seeded with e2e fixtures.
    command: `node scripts/ensure-dev-vars.mjs && pnpm db:migrate:local && pnpm wrangler d1 execute DB --local --file e2e/seed.sql && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
