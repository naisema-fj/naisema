// Resets a staff member's two-factor from the command line. Administrators do this in the admin
// site at /admin/staff; this is the fallback for when the only administrator loses their phone.
//
//   pnpm staff:reset-two-factor --env production --email natasha@example.com
//   pnpm staff:reset-two-factor --local --email me@example.com
//
// It removes their authenticator key and ends all their sessions; at their next sign-in they
// set up an authenticator app again. No email is sent: tell the person yourself.
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { executeSql, fail, queryRows, requireEmail, requireTarget } from "./lib/staff-cli.mjs";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    local: { type: "boolean", default: false },
    email: { type: "string" },
  },
});

// The email is the only value that reaches the SQL below, and it is checked against a strict pattern.
const email = requireEmail(values.email);
const target = requireTarget(values);

const [member] = queryRows(target, `SELECT id FROM user WHERE email = '${email}';`);
if (!member) fail(`No account uses ${email}.`);

const ofMember = `(SELECT id FROM user WHERE email = '${email}')`;
const now = Date.now();
const sql = [
  `DELETE FROM two_factor WHERE user_id = ${ofMember};`,
  `UPDATE user SET two_factor_enabled = 0, updated_at = ${now} WHERE email = '${email}';`,
  `DELETE FROM staff_session WHERE user_id = ${ofMember};`,
  `DELETE FROM session WHERE user_id = ${ofMember};`,
  `INSERT INTO audit_event (id, actor_id, action, object_type, object_id, details, created_at)
     SELECT '${randomUUID()}', NULL, 'two_factor.reset', 'user', id, '{"via":"cli"}', ${now}
     FROM user WHERE email = '${email}';`,
].join("\n");

executeSql(target, sql);
console.log(`Reset two-factor for ${email}. They set up an authenticator app again at their next sign-in.`);
