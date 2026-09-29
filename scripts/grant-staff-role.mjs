// Grants a staff role from the command line, creating the account if needed. This is how the
// first administrator is created; after that, administrators grant roles in the admin site.
//
//   pnpm staff:grant --env staging --email natasha@example.com --role administrator
//   pnpm staff:grant --local --email me@example.com --role administrator
//
// Reviewers also need --review-type (and --language-variety for language reviewers).
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const ROLES = ["administrator", "editor", "educator", "reviewer", "safeguarding_lead", "privacy_contact"];
const REVIEW_TYPES = ["language", "cultural", "editorial", "accessibility", "safeguarding"];

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    local: { type: "boolean", default: false },
    email: { type: "string" },
    role: { type: "string" },
    "review-type": { type: "string" },
    "language-variety": { type: "string" },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

// wrangler d1 execute cannot bind parameters, so every value that reaches the SQL below is
// checked against a strict pattern first, whatever the role.
const email = values.email?.trim().toLowerCase();
if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) fail("Pass --email with a valid address.");
if (!ROLES.includes(values.role)) fail(`Pass --role, one of: ${ROLES.join(", ")}.`);
if (!values.local && !values.env) fail("Pass --env staging|production, or --local.");
if (values.env && !["staging", "production"].includes(values.env)) fail("--env must be staging or production.");
const reviewType = values["review-type"] ?? null;
const variety = values["language-variety"] ?? null;
if (reviewType !== null && !REVIEW_TYPES.includes(reviewType))
  fail(`--review-type must be one of: ${REVIEW_TYPES.join(", ")}.`);
if (variety !== null && !/^[a-z0-9-]+$/.test(variety))
  fail("--language-variety must be lower-case letters, digits and hyphens.");
if (values.role !== "reviewer" && (reviewType || variety))
  fail("Only reviewers take --review-type or --language-variety.");
if (values.role === "reviewer" && !reviewType) fail(`Reviewers need --review-type (${REVIEW_TYPES.join(", ")}).`);
if (reviewType === "language" && !variety) fail("Language reviewers need --language-variety.");
if (reviewType !== "language" && variety) fail("Only language reviewers take --language-variety.");

const sqlText = (value) => (value === null ? "NULL" : `'${value}'`);
const now = Date.now();
const assignmentId = randomUUID();
const sql = [
  `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
     VALUES ('${randomUUID()}', '${email.split("@")[0]}', '${email}', 0, ${now}, ${now})
     ON CONFLICT(email) DO NOTHING;`,
  `INSERT INTO role_assignment (id, user_id, role, review_type, language_variety, granted_by, granted_at)
     SELECT '${assignmentId}', id, '${values.role}', ${sqlText(reviewType)}, ${sqlText(variety)}, 'cli', ${now}
     FROM user WHERE email = '${email}';`,
  `INSERT INTO audit_event (id, actor_id, action, object_type, object_id, details, created_at)
     VALUES ('${randomUUID()}', NULL, 'role.granted', 'role_assignment', '${assignmentId}',
             '{"via":"cli","role":"${values.role}"}', ${now});`,
].join("\n");

const target = values.local ? ["--local"] : ["--remote", "--env", values.env];
execFileSync("pnpm", ["wrangler", "d1", "execute", "DB", ...target, "--config", "wrangler.jsonc", "--command", sql], {
  stdio: "inherit",
});
console.log(`Granted ${values.role} to ${email}. They can now sign in at the admin site and set up two-factor.`);
