// Gets production ready for GitHub Actions, so nothing has to be set up on anyone's computer.
//
//   node scripts/prepare-production.mjs deploy <secrets.json>   (.github/workflows/deploy-production.yml)
//   node scripts/prepare-production.mjs find                     (.github/workflows/backup.yml)
//
// `deploy` creates production's D1 database and R2 bucket the first time (in Oceania), and writes
// their settings into this checkout's wrangler.jsonc, where the repository keeps placeholders. It
// also writes the Worker's secrets to <secrets.json> for `wrangler deploy --secrets-file`: the
// Turnstile secret and notification addresses from the environment, and a new random
// PREVIEW_SECRET only when the Worker has none yet, so preview links already sent keep working.
//
// `find` only looks the database up, for the weekly backup: until production exists there is
// nothing to back up, and it says so instead of failing.
//
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN; `deploy` also reads TURNSTILE_SITE_KEY,
// TURNSTILE_SECRET_KEY and NOTIFY_EMAILS.
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { wrangler, wranglerOutput } from "./wrangler.mjs";

const CONFIG = "wrangler.jsonc";
const WORKER = "naisema-production";
const DATABASE = "naisema-v1-production";
const BUCKET = "naisema-production-media";
// The Phase 1a Worker's upload queue: while it exists, the old Worker (which ran a container)
// is still in place, and v1 can't replace it in a deploy.
const OLD_QUEUE = "naisema-production-upload-scans";
const DB_PLACEHOLDER = "REPLACE_WITH_PRODUCTION_DATABASE_ID";
const SITE_KEY_PLACEHOLDER = "REPLACE_WITH_TURNSTILE_SITE_KEY";

const [mode, secretsFile] = process.argv.slice(2);
if (!["deploy", "find"].includes(mode) || (mode === "deploy" && !secretsFile)) {
  console.error("Usage: node scripts/prepare-production.mjs deploy <secrets.json> | find");
  process.exit(1);
}

/** What Wrangler printed, or null when the command failed (the thing it asked about isn't there). */
function lookUp(args) {
  try {
    return wranglerOutput(args);
  } catch {
    return null;
  }
}

function findDatabaseId() {
  const rows = JSON.parse(wranglerOutput(["d1", "list", "--json"]));
  const row = rows.find((db) => db.name === DATABASE);
  return row ? (row.uuid ?? row.id ?? null) : null;
}

/** Tells the GitHub Actions step whether there is anything to do, as `ready=true|false`. */
function setReady(ready) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ready=${ready}\n`);
}

function fillConfig(replacements) {
  let text = readFileSync(CONFIG, "utf8");
  for (const [placeholder, value] of replacements) text = text.replaceAll(placeholder, value);
  writeFileSync(CONFIG, text);
}

if (mode === "find") {
  // Before the backup has its own token there is nothing it could read: skip quietly, as before
  // production existed. With a token, a failing lookup fails the run, so a broken backup is seen.
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.log(
      "::warning::The production-backup environment has no CLOUDFLARE_API_TOKEN yet, so nothing was backed up.",
    );
    setReady(false);
    process.exit(0);
  }
  const id = findDatabaseId();
  if (!id) {
    console.log(`::warning::Production has no ${DATABASE} database yet, so there's nothing to back up.`);
    setReady(false);
  } else {
    fillConfig([[DB_PLACEHOLDER, id]]);
    console.log(`Found ${DATABASE} (${id}).`);
    setReady(true);
  }
  process.exit(0);
}

// --- deploy ---

if (lookUp(["queues", "info", OLD_QUEUE]) !== null) {
  console.error(
    `::error::The old Phase 1a ${WORKER} Worker is still in Cloudflare, and v1 can't replace it in a deploy. ` +
      `In the Cloudflare dashboard, delete the Worker ${WORKER} (Workers & Pages → ${WORKER} → Settings → Delete) ` +
      `and the queue ${OLD_QUEUE} (Storage & databases → Queues). Phase 1a production held no real data. Then run this again.`,
  );
  process.exit(1);
}

let databaseId = findDatabaseId();
if (!databaseId) {
  console.log(`Creating the production database ${DATABASE}, in Oceania (first deploy only).`);
  wrangler(["d1", "create", DATABASE, "--location", "oc", "--update-config=false"]);
  databaseId = findDatabaseId();
  if (!databaseId) {
    console.error(`::error::Created ${DATABASE}, but couldn't find it afterwards. Check the D1 page in Cloudflare.`);
    process.exit(1);
  }
}
console.log(`Production database: ${DATABASE} (${databaseId}).`);

if (lookUp(["r2", "bucket", "info", BUCKET]) === null) {
  console.log(`Creating the private media bucket ${BUCKET}, in Oceania (first deploy only).`);
  wrangler(["r2", "bucket", "create", BUCKET, "--location", "oc", "--update-config=false"]);
}
console.log(`Production media bucket: ${BUCKET}.`);

fillConfig([
  [DB_PLACEHOLDER, databaseId],
  [SITE_KEY_PLACEHOLDER, process.env.TURNSTILE_SITE_KEY ?? ""],
]);

const secrets = {
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "",
  NOTIFY_EMAILS: process.env.NOTIFY_EMAILS ?? "",
};
// PREVIEW_SECRET signs preview links. It is made once, on the first deploy, and kept after that.
const existing = lookUp(["secret", "list", "--name", WORKER, "--format", "json"]) ?? "";
if (!existing.includes('"PREVIEW_SECRET"')) {
  secrets.PREVIEW_SECRET = randomBytes(32).toString("base64");
  console.log("Made a new random PREVIEW_SECRET (first deploy only).");
}
writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
console.log("Production is ready to deploy.");
