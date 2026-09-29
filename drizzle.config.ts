import { defineConfig } from "drizzle-kit";

// Generates SQL migrations into ./migrations, which `wrangler d1 migrations apply`
// reads directly (docs/handover/runbook.md).
export default defineConfig({
  dialect: "sqlite",
  schema: "./db/schema.ts",
  out: "./migrations",
});
