import { Form } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { can } from "~/lib/permissions";
import { describeRoleAssignment } from "~/lib/role-names";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/home";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  return {
    email: user.email,
    canManageStaff: can(actor, { action: "role.assign" }),
    canEditContent: can(actor, { action: "content.edit" }),
    roles: actor.roles.map(describeRoleAssignment),
  };
}

export default function AdminHome({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>Na iSema staff</h1>
      <p>
        Signed in as <strong>{loaderData.email}</strong>.
      </p>
      <h2>Your roles</h2>
      <ul>
        {loaderData.roles.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>
      {loaderData.canEditContent && (
        <>
          <h2>Content</h2>
          <ul>
            <li>
              <a href="/admin/articles">Articles</a>
            </li>
            <li>
              <a href="/admin/topics">Topics</a>
            </li>
          </ul>
        </>
      )}
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
