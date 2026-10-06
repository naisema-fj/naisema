import { redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { fromThisSite, signOutLearner } from "~/lib/learners.server";
import type { Route } from "./+types/sign-out";

/** POST /account/sign-out — ends the learner's session on this device, then home. */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  if (!fromThisSite(request)) throw new Response("Cross-site request refused", { status: 403 });
  throw redirect("/", { headers: await signOutLearner(env, request) });
}

/** Signing out is only ever a form post, so a link can't sign anyone out. */
export function loader() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
