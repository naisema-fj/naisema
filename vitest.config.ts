import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import { aliases } from "./vite.config";

// Integration tests run against the *built* Worker (`pnpm build` first), so they
// exercise the same bundle that deploys. D1 starts empty and the setup file
// applies the real migrations before any test runs.
export default defineConfig({
  resolve: { alias: aliases },
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./build/server/wrangler.json" },
      // Tests must never reach real Cloudflare resources, whatever the config says.
      remoteBindings: false,
      miniflare: {
        // A second, empty database: an exported Learning Layer is imported into it (tests/integration/learning-layer-export.test.ts).
        d1Databases: ["IMPORT_DB"],
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")),
          BETTER_AUTH_SECRET: "test-only-secret-at-least-32-characters-long",
          PUBLIC_ORIGINS: "https://naisema.test",
          // Cloudflare's always-passing Turnstile test secret (app/lib/turnstile.ts).
          TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          // Signs the Stream webhook deliveries tests send (app/routes/public/stream-webhook.ts).
          STREAM_WEBHOOK_SECRET: "test-stream-webhook-secret",
        },
      },
    })),
  ],
  test: {
    include: ["tests/integration/**/*.test.ts", "tests/unit/**/*.test.ts"],
    // The longest journeys (a Case through triage and appeal, a Revision through every review gate)
    // make dozens of requests to the built Worker: about 2 s locally, but over the 5 s default on a
    // slow CI runner. A test that hangs still fails, at 20 s.
    testTimeout: 20_000,
    setupFiles: ["./tests/integration/apply-migrations.ts"],
  },
});
