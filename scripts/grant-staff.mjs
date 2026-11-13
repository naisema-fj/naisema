// Adds a staff member, or changes their roles: `pnpm staff:grant <local|staging|production> <email> "<Name>" <roles>`,
// roles comma-separated from admin, editor, educator, reviewer, safeguarding (app/lib/roles.ts). A
// reviewer reviews Standard Fijian. They also need adding to the Cloudflare Access allowlist.
// Used for the first administrator; after that, administrators use /admin/staff, which is audited.
import { wrangler } from "./wrangler.mjs";

const ROLES = ["admin", "editor", "educator", "reviewer", "safeguarding"];
const [target, givenEmail, name, roleList] = process.argv.slice(2);
// Stored as sign-in looks it up: trimmed and lower-case, or no link is ever sent to it.
const email = givenEmail?.trim().toLowerCase();
if (!["local", "staging", "production"].includes(target) || !email?.includes("@") || !name || !roleList) {
  console.error('Usage: pnpm staff:grant <local|staging|production> <email> "<Name>" <roles>');
  process.exit(1);
}
const roles = roleList.split(",").map((role) => role.trim());
const unknown = roles.filter((role) => !ROLES.includes(role));
if (unknown.length) {
  console.error(`Unknown roles: ${unknown.join(", ")}. Choose from ${ROLES.join(", ")}.`);
  process.exit(1);
}
const q = (value) => (value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`);
const variety = roles.includes("reviewer") ? "standard-fijian" : null;
const sql = `INSERT INTO staff (email, name, roles, language_variety) VALUES (${q(email)}, ${q(name)}, ${q(JSON.stringify(roles))}, ${q(variety)})
ON CONFLICT(email) DO UPDATE SET name = excluded.name, roles = excluded.roles, language_variety = excluded.language_variety, active = 1;
INSERT INTO audit_event (id, actor_email, action, subject_type, subject_id, details) VALUES (${q(crypto.randomUUID())}, 'staff:grant script', 'staff.granted', 'staff', ${q(email)}, ${q(JSON.stringify({ roles }))});`;
const where = target === "local" ? ["--local"] : ["--remote", "--env", target];
wrangler(["d1", "execute", "DB", ...where, "--command", sql]);
console.log(`${email} now holds: ${roles.join(", ")}`);
