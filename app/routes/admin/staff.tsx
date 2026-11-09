import { eq } from "drizzle-orm";
import { data, Form, redirect } from "react-router";
import { audit } from "~/lib/audit.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { isRole, ROLE_NAMES, ROLES } from "~/lib/roles";
import { requireStaff } from "~/lib/staff.server";
import { staff } from "~db/schema";
import type { Route } from "./+types/staff";

/**
 * /admin/staff: who works on the admin site and their roles. Cloudflare Access decides who can
 * reach the site at all; this list decides what each person may do once there. Every change is
 * audited.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireStaff(env, request, "staff.manage");
  return { people: await getDb(env.DB).select().from(staff).orderBy(staff.name) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request, "staff.manage");
  const db = getDb(env.DB);
  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(form.get("name") ?? "")
    .trim()
    .slice(0, 120);
  const roles = form.getAll("roles").map(String).filter(isRole);
  const variety = roles.includes("reviewer") ? "standard-fijian" : null;
  const active = form.get("active") !== "off";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name)
    return data({ error: "Enter a name and an email address." }, { status: 400 });
  if (email === actor.email && !roles.includes("admin"))
    return data({ error: "You can't remove your own administrator role." }, { status: 400 });
  const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
  await db.batch([
    existing
      ? db.update(staff).set({ name, roles, languageVariety: variety, active }).where(eq(staff.email, email))
      : db.insert(staff).values({ email, name, roles, languageVariety: variety, active }),
    audit(db, actor.email, existing ? "staff.changed" : "staff.added", { type: "staff", id: email }, { roles, active }),
  ]);
  return redirect("/admin/staff");
}

export function meta() {
  return [{ title: "Staff · NAISEMA staff" }];
}

function PersonForm({ person }: { person?: { email: string; name: string; roles: string[]; active: boolean } }) {
  const key = person?.email ?? "new";
  return (
    <Form method="post" className="person-form">
      <fieldset>
        <legend>{person ? person.name : "Add someone"}</legend>
        <label htmlFor={`name-${key}`}>Name</label>
        <input id={`name-${key}`} name="name" defaultValue={person?.name} required maxLength={120} />
        <label htmlFor={`email-${key}`}>Email address (as Cloudflare Access knows it)</label>
        <input
          id={`email-${key}`}
          name="email"
          type="email"
          defaultValue={person?.email}
          readOnly={Boolean(person)}
          required
        />
        {ROLES.map((role) => (
          <label key={role} className="checkbox">
            <input type="checkbox" name="roles" value={role} defaultChecked={person?.roles.includes(role)} />{" "}
            {ROLE_NAMES[role]}
            {role === "reviewer" && " (Standard Fijian)"}
          </label>
        ))}
        {person && (
          <label className="checkbox">
            <input type="checkbox" name="active" value="off" defaultChecked={!person.active} /> No longer works on
            NAISEMA
          </label>
        )}
        <button type="submit">{person ? "Save" : "Add"}</button>
      </fieldset>
    </Form>
  );
}

export default function Staff({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>Staff</h1>
      <p className="hint">
        Add each person to the Cloudflare Access allowlist as well, or they can't reach this site
        (docs/handover/runbook.md).
      </p>
      {actionData?.error && (
        <p role="alert" className="error">
          {actionData.error}
        </p>
      )}
      {loaderData.people.map((person) => (
        <PersonForm key={person.email} person={person} />
      ))}
      <PersonForm />
    </main>
  );
}
