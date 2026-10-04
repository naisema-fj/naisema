// Shared by the staff command-line scripts: argument checks and running SQL against D1 through
// Wrangler. wrangler d1 execute cannot bind parameters, so every value that reaches SQL must be
// checked against a strict pattern first.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export function fail(message) {
  console.error(message);
  process.exit(1);
}

/** The --email value, lower-cased, or exits if it is not a plain address safe to put in SQL. */
export function requireEmail(value) {
  const email = value?.trim().toLowerCase();
  if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) fail("Pass --email with a valid address.");
  return email;
}

/** Wrangler's target flags for --env staging|production or --local, or exits if neither is valid. */
export function requireTarget(values) {
  if (!values.local && !values.env) fail("Pass --env staging|production, or --local.");
  if (values.env && !["staging", "production"].includes(values.env)) fail("--env must be staging or production.");
  return values.local ? ["--local"] : ["--remote", "--env", values.env];
}

// Run Wrangler's own entry file with this Node binary: no shell, so it works the same on
// Windows (where `pnpm` is a .cmd wrapper) and the SQL travels in a file, not a long argument.
function wrangler(target, args, options) {
  const require = createRequire(import.meta.url);
  const wranglerPackage = require.resolve("wrangler/package.json");
  const wranglerBin = join(dirname(wranglerPackage), require(wranglerPackage).bin.wrangler);
  return execFileSync(
    process.execPath,
    [wranglerBin, "d1", "execute", "DB", ...target, "--config", "wrangler.jsonc", ...args, "--yes"],
    options,
  );
}

/** Runs SQL statements against the target D1 database, showing Wrangler's output. */
export function executeSql(target, sql) {
  const workDir = mkdtempSync(join(tmpdir(), "naisema-staff-"));
  const sqlFile = join(workDir, "staff.sql");
  writeFileSync(sqlFile, sql);
  try {
    wrangler(target, ["--file", sqlFile], { stdio: "inherit" });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** Runs one read-only query against the target D1 database and returns its rows. */
export function queryRows(target, sql) {
  const output = wrangler(target, ["--json", "--command", sql], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
  return JSON.parse(output)[0]?.results ?? [];
}
