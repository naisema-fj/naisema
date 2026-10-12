// Closes the public site before a restore (docs/handover/runbook.md, restoring a backup).
//
//   pnpm restore:lock --env staging
//
// While the lock is on, visitors get "back shortly" (503) and the scheduled jobs wait. The lock is
// lifted from the staff site, at /admin/restore, once the deletion ledger has been replayed on the
// restored database (ADR-0009). It can take up to ten seconds to reach every Worker.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { env: { type: "string" } } });
if (!["staging", "production"].includes(values.env ?? "")) {
  console.error("Pass --env staging|production.");
  process.exit(1);
}

// Wrangler's own entry file with this Node binary, as the staff scripts do: no shell.
const require = createRequire(import.meta.url);
const wranglerPackage = require.resolve("wrangler/package.json");
const wranglerBin = join(dirname(wranglerPackage), require(wranglerPackage).bin.wrangler);

const workDir = mkdtempSync(join(tmpdir(), "naisema-restore-"));
const file = join(workDir, "restore-lock.json");
writeFileSync(file, JSON.stringify({ lockedAt: new Date().toISOString() }));
try {
  execFileSync(
    process.execPath,
    [wranglerBin, "r2", "object", "put", `naisema-${values.env}-ledger/state/restore-lock`, "--file", file, "--remote"],
    { stdio: "inherit" },
  );
  console.log(`The ${values.env} public site is closed. Restore the database, then finish at /admin/restore.`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
