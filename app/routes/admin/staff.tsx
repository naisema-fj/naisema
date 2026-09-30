import { data, Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { can, REVIEW_TYPES, STAFF_ROLES } from "~/lib/permissions";
import { describeRoleAssignment, ROLE_NAMES } from "~/lib/role-names";
import { requireStaff } from "~/lib/staff.server";
import { grantRole, listStaff, revokeRole, validateGrant } from "~/lib/staff-roles.server";
import { listTwoFactorStatus, resetTwoFactor } from "~/lib/staff-two-factor.server";
import type { Route } from "./+types/staff";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Staff and roles · Na iSema staff" }];
}

async function requireAdministrator(request: Request, env: Env) {
  const staff = await requireStaff(env, request);
  // Granting a role can also create the staff member's account.
  if (!can(staff.actor, { action: "role.assign" }) || !can(staff.actor, { action: "account.manage" })) {
    throw new Response("Only administrators can manage staff.", { status: 403 });
  }
  return staff;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { db, actor } = await requireAdministrator(request, context.get(cloudflareContext).env);
  return { staff: await listStaff(db), twoFactor: await listTwoFactorStatus(db, actor) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireAdministrator(request, env);
  const form = await request.formData();

  if (form.get("intent") === "revoke") {
    const result = await revokeRole(db, actor.userId, String(form.get("assignmentId") ?? ""));
    if (!result.ok) return data({ error: result.error }, { status: 400 });
    throw redirect("/admin/staff");
  }

  if (form.get("intent") === "resetTwoFactor") {
    const result = await resetTwoFactor(env, db, actor, String(form.get("userId") ?? ""));
    if (!result.ok) return data({ error: result.error }, { status: 400 });
    throw redirect("/admin/staff");
  }

  const validation = validateGrant(form);
  if (!validation.ok) return data({ error: validation.error }, { status: 400 });
  await grantRole(db, actor.userId, validation.grant);
  throw redirect("/admin/staff");
}

export default function Staff({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Staff and roles</h1>
      {actionData?.error && <p role="alert">{actionData.error}</p>}

      <h2>Current roles</h2>
      <table>
        <caption className="visually-hidden">Active staff role assignments</caption>
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loaderData.staff.map((row) => (
            <tr key={row.assignmentId}>
              <td>{row.email}</td>
              <td>{describeRoleAssignment(row.assignment)}</td>
              <td>
                <Form method="post">
                  <input type="hidden" name="intent" value="revoke" />
                  <input type="hidden" name="assignmentId" value={row.assignmentId} />
                  <button type="submit" aria-label={`Revoke ${ROLE_NAMES[row.assignment.role]} from ${row.email}`}>
                    Revoke
                  </button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Two-factor</h2>
      <p>
        If someone loses the phone with their authenticator app, reset their two-factor. They are signed out everywhere
        and set up a new authenticator app the next time they sign in.
      </p>
      <table>
        <caption className="visually-hidden">Two-factor status of each staff member</caption>
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Two-factor</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loaderData.twoFactor.map((member) => (
            <tr key={member.userId}>
              <td>{member.email}</td>
              <td>{member.twoFactorEnabled ? "Set up" : "Not set up yet"}</td>
              <td>
                {member.canReset && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="resetTwoFactor" />
                    <input type="hidden" name="userId" value={member.userId} />
                    <button type="submit" aria-label={`Reset two-factor for ${member.email}`}>
                      Reset two-factor
                    </button>
                  </Form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Grant a role</h2>
      <p>New staff get an account when first granted a role; they then sign in by email link.</p>
      <Form method="post">
        <input type="hidden" name="intent" value="grant" />
        <label htmlFor="grant-email">Email address</label>
        <input id="grant-email" name="email" type="email" required />
        <label htmlFor="grant-role">Role</label>
        <select id="grant-role" name="role" required>
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_NAMES[role]}
            </option>
          ))}
        </select>
        <label htmlFor="grant-review-type">Review Type (reviewers only)</label>
        <select id="grant-review-type" name="reviewType">
          <option value="">—</option>
          {REVIEW_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <label htmlFor="grant-variety">Language Variety (language reviewers only)</label>
        <input id="grant-variety" name="languageVariety" placeholder="standard-fijian" />
        <button type="submit">Grant role</button>
      </Form>
    </main>
  );
}
