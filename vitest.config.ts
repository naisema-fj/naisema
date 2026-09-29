import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Integration tests run against the *built* Worker (`pnpm build` first), so they
// exercise the same bundle that deploys. D1 starts empty and the setup file
// applies the real migrations before any test runs.
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./build/server/wrangler.json" },
      // Tests must never reach real Cloudflare resources, whatever the config says.
      remoteBindings: false,
      miniflare: {
        bindings: { TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, "migrations")) },
      },
    })),
  ],
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/apply-migrations.ts"],
  },
});
