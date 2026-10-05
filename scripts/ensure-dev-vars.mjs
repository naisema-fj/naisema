// Creates .dev.vars with a random local BETTER_AUTH_SECRET, and Cloudflare's always-passing
// Turnstile test secret, if they are not there yet. Used by local development and the browser
// tests; deployed environments use `wrangler secret put`.
import { randomBytes } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync(".dev.vars")) {
  writeFileSync(".dev.vars", `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`);
  console.log("Created .dev.vars with a random local BETTER_AUTH_SECRET");
}
if (!/^TURNSTILE_SECRET_KEY=/m.test(readFileSync(".dev.vars", "utf8"))) {
  appendFileSync(".dev.vars", "TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA\n");
  console.log("Added Cloudflare's Turnstile test secret to .dev.vars");
}

// `vite preview` (the browser tests' server) reads the copy of .dev.vars that `pnpm build` puts
// next to the built Worker. A build made before .dev.vars existed (as `pnpm test` does in CI) has
// no copy, so the preview would run without secrets: keep the built copy in step.
if (existsSync("build/server/wrangler.json")) {
  copyFileSync(".dev.vars", "build/server/.dev.vars");
}
