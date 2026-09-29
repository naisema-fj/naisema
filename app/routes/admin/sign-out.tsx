import { redirect } from "react-router";
import { recordAudit } from "~/lib/audit.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { ADMIN_PATHS, getSignedIn } from "~/lib/staff.server";
import type { Route } from "./+types/sign-out";

export async function loader() {
  throw redirect(ADMIN_PATHS.home);
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await getSignedIn(context.get(cloudflareContext).env, request);
  if (!signedIn) throw redirect(ADMIN_PATHS.signIn);
  const { headers } = await signedIn.auth.api.signOut({ headers: request.headers, returnHeaders: true });
  await recordAudit(signedIn.db, {
    actorId: signedIn.user.id,
    action: "session.signed_out",
    objectType: "session",
    objectId: signedIn.sessionId,
  });
  throw redirect(ADMIN_PATHS.signIn, { headers });
}
