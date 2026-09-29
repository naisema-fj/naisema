import { Form } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { can, type StaffRole } from "~/lib/permissions";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/home";

export const handle = { hydrate: false };

const ROLE_NAMES: Record<StaffRole, string> = {
  administrator: "Administrator",
  editor: "Editor",
  educator: "Educator",
  reviewer: "Reviewer",
  safeguarding_lead: "Safeguarding lead",
  privacy_contact: "Privacy contact",
};

export function meta() {
  return [{ title: "NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  return {
    email: user.email,
    canManageStaff: can(actor, { action: "role.assign" }),
    roles: actor.roles.map((assignment) =>
      [ROLE_NAMES[assignment.role], assignment.reviewType, assignment.languageVariety].filter(Boolean).join(" · "),
    ),
  };
}

export default function AdminHome({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>NAISEMA staff</h1>
      <p>
        Signed in as <strong>{loaderData.email}</strong>.
      </p>
      <h2>Your roles</h2>
      <ul>
        {loaderData.roles.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>
      {loaderData.canManageStaff && (
        <p>
          <a href="/admin/staff">Manage staff and roles</a>
        </p>
      )}
      <Form method="post" action="/admin/sign-out">
        <button type="submit">Sign out</button>
      </Form>
    </main>
  );
}
