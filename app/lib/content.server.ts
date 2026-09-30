import { can } from "./permissions";
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
