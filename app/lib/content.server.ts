import { can } from "./permissions";
import { getProvider } from "./providers.server";
import { requireStaff } from "./staff.server";

/** The staff gate plus the Editor check every content page and form goes through. */
export async function requireEditor(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  if (!can(staff.actor, { action: "content.edit" })) {
    throw new Response("Only editors can work on content.", { status: 403 });
  }
  return staff;
}

/** The staff gate plus the check for recording Rights Records and managing Contributors. */
export async function requireRightsManager(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  if (!can(staff.actor, { action: "rights.manage" })) {
    throw new Response("Only editors can manage rights and contributors.", { status: 403 });
  }
  return staff;
}

/** The editor gate plus the Provider a staff page is about; 404 if there is none. */
export async function requireProvider(env: Env, request: Request, id: string) {
  const staff = await requireEditor(env, request);
  const found = await getProvider(staff.db, id);
  if (!found) throw new Response("Not found", { status: 404 });
  return { ...staff, provider: found };
}
