// Checks staff sign-in on production end to end, for .github/workflows/check-sign-in.yml: asks
// admin.naisema.com for a sign-in link for the newest active administrator, while watching the
// Worker's live logs, then says in plain words where it stopped. A real link is emailed, as if they
// had asked for it themselves.
//
// The repository is public, so this never prints an address or a link: only counts, the app's own
// (already redacted) log lines and Cloudflare's errors, with any address in them blanked.
//
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, and wrangler.jsonc filled in by
// `node scripts/prepare-production.mjs find`.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { wranglerOutput } from "./wrangler.mjs";

const WORKER = "naisema-production";
const SIGN_IN = "https://admin.naisema.com/admin/sign-in";
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const blank = (text) => String(text).replace(EMAIL, "[email]");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function query(sql) {
  const out = wranglerOutput(["d1", "execute", "DB", "--remote", "--env", "production", "--json", "--command", sql]);
  return JSON.parse(out)[0]?.results ?? [];
}
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;

// 1. Who to test with: the newest active administrator.
const admins = query(`SELECT email FROM staff WHERE active = 1 AND roles LIKE '%"admin"%' ORDER BY created_at DESC`);
console.log(`Active administrators on production: ${admins.length}.`);
if (!admins.length) {
  console.log(
    "::error::Production has no active administrator, so no sign-in link can be sent. Run Deploy to production with your email and name in the first-administrator boxes.",
  );
  process.exit(1);
}
const email = admins[0].email;
// Hidden from this public log from here on, even if something prints it.
console.log(`::add-mask::${email}`);
const linksBefore = query(
  `SELECT COUNT(*) AS n FROM sign_in_link WHERE email = ${q(email)} AND expires_at > ${Date.now()}`,
)[0].n;
console.log(`Unexpired sign-in links for them before the test: ${linksBefore} (at most 3 are sent in 15 minutes).`);

// 2. Watch the Worker's logs while asking for a link.
const manifest = createRequire(import.meta.url).resolve("wrangler/package.json");
const { bin } = JSON.parse(readFileSync(manifest, "utf8"));
const entry = join(dirname(manifest), typeof bin === "string" ? bin : bin.wrangler);
const tail = spawn(process.execPath, [entry, "tail", WORKER, "--format", "json"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let tailed = "";
let tailErrors = "";
tail.stdout.on("data", (chunk) => {
  tailed += chunk;
});
tail.stderr.on("data", (chunk) => {
  tailErrors += chunk;
});
await sleep(12_000); // the tail takes a few seconds to connect

const response = await fetch(SIGN_IN, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://admin.naisema.com" },
  body: new URLSearchParams({ email }),
  redirect: "manual",
});
const page = await response.text();
console.log(
  `Asked for a sign-in link: the page answered ${response.status}${page.includes("Check your email") ? ', "Check your email"' : ""}.`,
);
await sleep(15_000);
tail.kill();

const linksAfter = query(
  `SELECT COUNT(*) AS n FROM sign_in_link WHERE email = ${q(email)} AND expires_at > ${Date.now()}`,
)[0].n;

// 3. What the Worker said while answering.
/** The JSON objects in Wrangler's tail output, which prints them one after another. */
function events(text) {
  const found = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") {
      if (depth++ === 0) start = i;
    } else if (c === "}" && --depth === 0) {
      try {
        found.push(JSON.parse(text.slice(start, i + 1)));
      } catch {}
    }
  }
  return found;
}
const signIns = events(tailed).filter(
  (event) => event?.event?.request?.url?.includes("/admin/sign-in") && event.event.request.method === "POST",
);
const lines = [];
for (const event of signIns) {
  lines.push(`Request outcome: ${event.outcome}`);
  for (const log of event.logs ?? []) lines.push(`  log (${log.level}): ${blank((log.message ?? []).join(" "))}`);
  for (const error of event.exceptions ?? []) lines.push(`  exception: ${blank(`${error.name}: ${error.message}`)}`);
}
console.log("\nWhat the Worker logged while answering:");
console.log(lines.length ? lines.join("\n") : "  (nothing)");
if (!signIns.length)
  console.log(
    `  The log watch saw no sign-in request.${tailErrors ? ` Wrangler said: ${blank(tailErrors).slice(0, 2000)}` : ""}`,
  );

// 4. In plain words.
const logged = lines.join("\n");
console.log("");
if (linksAfter <= linksBefore && linksBefore >= 3) {
  console.log(
    "::warning::Not sent: 3 links were already sent in the last 15 minutes, the most there can be. Wait 15 minutes and run this again.",
  );
} else if (linksAfter <= linksBefore) {
  console.log("::error::The site didn't make a link at all. Send this log to whoever looks after the code.");
} else if (/Email failed/.test(logged)) {
  const code = /"code":"([A-Z_]+)"/.exec(logged)?.[1];
  console.log(
    `::error::A link was made, but Cloudflare refused to send the email${code ? ` (${code})` : ""}. The reason is in the log lines above.`,
  );
} else if (/Email not sent/.test(logged)) {
  console.log("::error::A link was made, but the Worker has no email sending set up (no EMAIL binding).");
} else if (!signIns.length) {
  console.log(
    "::warning::A link was made, but the log watch didn't catch the request, so whether Cloudflare sent the email isn't known. Look in Cloudflare: Compute > Email Service > Email Sending > Activity log.",
  );
} else {
  console.log(
    "::notice::A link was made and Cloudflare accepted the email without an error. If it hasn't arrived in a few minutes, look in Cloudflare: Compute > Email Service > Email Sending > Activity log, which says whether it was delivered or bounced.",
  );
}
