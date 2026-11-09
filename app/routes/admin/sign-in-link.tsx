import { data, Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/http";
import { redeemSignInLink } from "~/lib/staff.server";
import type { Route } from "./+types/sign-in-link";

export function headers() {
  return { "Cache-Control": PRIVATE_NO_STORE, "Referrer-Policy": "no-referrer" };
}

/**
 * GET /admin/sign-in/link?token=: the emailed link. Opening it only shows a button; pressing it
 * signs in. Email providers often open links to check them, and that would otherwise use the link
 * up before the person did.
 */
export function loader({ request }: Route.LoaderArgs) {
  return { token: new URL(request.url).searchParams.get("token") ?? "" };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const token = String((await request.formData()).get("token") ?? "");
  const cookie = await redeemSignInLink(getDb(env.DB), token, new URL(request.url).protocol === "https:");
  if (!cookie) return data({ failed: true }, { status: 400 });
  return redirect("/admin", { headers: { "Set-Cookie": cookie } });
}

export function meta() {
  return [{ title: "Sign in · NAISEMA staff" }];
}

export default function SignInLink({ loaderData, actionData }: Route.ComponentProps) {
  if (actionData?.failed || !loaderData.token) {
    return (
      <main id="main" className="page">
        <h1>This link doesn't work</h1>
        <p>It may have been used already, or be more than 15 minutes old.</p>
        <p>
          <a href="/admin/sign-in">Ask for a new link</a>
        </p>
      </main>
    );
  }
  return (
    <main id="main" className="page">
      <h1>Sign in to NAISEMA staff</h1>
      <Form method="post">
        <input type="hidden" name="token" value={loaderData.token} />
        <button type="submit">Sign in</button>
      </Form>
    </main>
  );
}
