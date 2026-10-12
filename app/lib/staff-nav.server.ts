import { can } from "./permissions";
import { activeRoles, getSignedIn, staffStep } from "./staff.server";
import { staffNav } from "./staff-nav";

/**
 * What the staff shell shows around a page: the signed-in person and the pages their roles allow.
 * Null before the staff gate is passed (the sign-in pages) or without a staff role. It only reads;
 * each page still enforces its own gate (requireStaff), so the shell can never open a page.
 */
export async function staffShellFor(env: Env, request: Request) {
  const signedIn = await getSignedIn(env, request);
  if (!signedIn || staffStep(signedIn) !== "done") return null;
  const actor = { userId: signedIn.user.id, roles: await activeRoles(signedIn.db, signedIn.user.id) };
  if (!can(actor, { action: "staffArea.enter" })) return null;
  return { email: signedIn.user.email, groups: staffNav(actor) };
}
