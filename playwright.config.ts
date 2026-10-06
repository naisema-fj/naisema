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
    // Each project reports its own client IP, as Cloudflare would, so the sign-in rate limit
    // (5 magic links a minute per IP) counts each project's sign-ins separately.
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath },
        extraHTTPHeaders: { "CF-Connecting-IP": "203.0.113.10" },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: { executablePath },
        extraHTTPHeaders: { "CF-Connecting-IP": "203.0.113.20" },
      },
    },
  ],
  webServer: {
    // Serves the production build with local D1, migrated and seeded with e2e fixtures.
    command: `node scripts/ensure-dev-vars.mjs && pnpm db:migrate:local && pnpm wrangler d1 execute DB --local --file e2e/seed.sql && pnpm wrangler r2 object put naisema-dev-video-masters/masters/e2e-public-video --local --file e2e/fixtures/market.mp4 --content-type video/mp4 && pnpm preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
