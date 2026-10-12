import { cloudflareContext } from "~/lib/cloudflare";
import { describeRoleAssignment } from "~/lib/role-names";
import { requireStaff } from "~/lib/staff.server";
import { staffNav } from "~/lib/staff-nav";
import type { Route } from "./+types/home";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "NAISEMA staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user, actor } = await requireStaff(context.get(cloudflareContext).env, request);
  return {
    email: user.email,
    roles: actor.roles.map(describeRoleAssignment),
    groups: staffNav(actor),
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
      <h2>Where to go</h2>
      <div className="staff-links">
        {loaderData.groups.map((group, index) => (
          <section key={group.name} aria-labelledby={`links-${index}`}>
            <h3 id={`links-${index}`}>{group.name}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
