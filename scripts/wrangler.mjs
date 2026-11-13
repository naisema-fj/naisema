// Runs this project's Wrangler with Node itself, not through pnpm or a shell. On Windows pnpm is a
// .cmd file that Node can't start directly (spawnSync pnpm ENOENT), and a shell there would mangle
// arguments such as multi-line SQL; this way they reach Wrangler exactly as written, on every system.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const manifest = createRequire(import.meta.url).resolve("wrangler/package.json");
const { bin } = JSON.parse(readFileSync(manifest, "utf8"));
const entry = join(dirname(manifest), typeof bin === "string" ? bin : bin.wrangler);

/** Runs `wrangler <args>`, showing its output; throws if it fails, as execFileSync does. */
export function wrangler(args) {
  execFileSync(process.execPath, [entry, ...args], { stdio: "inherit" });
}

/**
 * Runs `wrangler <args>` and returns what it printed, for commands asked for `--json`. With
 * `quiet`, Wrangler's errors aren't shown either: for lookups where "not found" is an answer.
 */
export function wranglerOutput(args, { quiet = false } = {}) {
  return execFileSync(process.execPath, [entry, ...args], {
    stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}
