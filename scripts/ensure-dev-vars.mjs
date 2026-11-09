// Creates .dev.vars with Cloudflare's always-passing Turnstile test secret and a random local
// PREVIEW_SECRET, if they are not there yet. Used by local development and the browser tests;
// deployed environments use `wrangler secret put`.
import { randomBytes } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync(".dev.vars")) writeFileSync(".dev.vars", "");
const vars = readFileSync(".dev.vars", "utf8");
if (!/^TURNSTILE_SECRET_KEY=/m.test(vars)) {
  appendFileSync(".dev.vars", "TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA\n");
  console.log("Added Cloudflare's Turnstile test secret to .dev.vars");
}
if (!/^PREVIEW_SECRET=/m.test(vars)) {
  appendFileSync(".dev.vars", `PREVIEW_SECRET=${randomBytes(32).toString("base64url")}\n`);
  console.log("Added a random local PREVIEW_SECRET to .dev.vars");
}

// `vite preview` (the browser tests' server) reads the copy of .dev.vars that `pnpm build` puts
// next to the built Worker, so keep the built copy in step.
if (existsSync("build/server/wrangler.json")) copyFileSync(".dev.vars", "build/server/.dev.vars");
