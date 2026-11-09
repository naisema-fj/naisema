import { redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { signOut } from "~/lib/staff.server";
import type { Route } from "./+types/sign-out";

/** POST /admin/sign-out: ends this browser's session. */
export async function action({ request, context }: Route.ActionArgs) {
  const cookie = await signOut(getDb(context.get(cloudflareContext).env.DB), request);
  return redirect("/admin/sign-in", { headers: { "Set-Cookie": cookie } });
}

export function loader() {
  return redirect("/admin");
}
