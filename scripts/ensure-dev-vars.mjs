// Creates .dev.vars with a random local BETTER_AUTH_SECRET if it does not exist yet.
// Used by local development and the browser tests; deployed environments use `wrangler secret put`.
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (!existsSync(".dev.vars")) {
  writeFileSync(".dev.vars", `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`);
  console.log("Created .dev.vars with a random local BETTER_AUTH_SECRET");
}
