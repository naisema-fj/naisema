import { data, Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { visitorAddress } from "~/lib/form-guard.server";
import { PRIVATE_NO_STORE } from "~/lib/http";
import { getStaff, sendSignInLink } from "~/lib/staff.server";
import type { Route } from "./+types/sign-in";

export function headers() {
  return { "Cache-Control": PRIVATE_NO_STORE };
}

/** GET /admin/sign-in: staff ask for a sign-in link by email (ADR-0016). */
export async function loader({ request, context }: Route.LoaderArgs) {
  if (await getStaff(context.get(cloudflareContext).env, request)) throw redirect("/admin");
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { success } = await env.FORM_RATE_LIMIT.limit({ key: `sign-in|${visitorAddress(request) ?? "unknown"}` });
  if (!success) {
    return data(
      { sent: false as const, error: "That's several tries in a minute. Wait a minute, then try again." },
      { status: 429 },
    );
  }
  const email = String((await request.formData()).get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return data({ sent: false as const, error: "Enter your email address, like name@example.org." }, { status: 400 });
  }
  const { devLink } = await sendSignInLink(env, getDb(env.DB), email, new URL(request.url).origin);
  return { sent: true as const, email, devLink };
}

export function meta() {
  return [{ title: "Sign in · NAISEMA staff" }];
}

export default function SignIn({ actionData }: Route.ComponentProps) {
  if (actionData?.sent) {
    return (
      <main id="main" className="page">
        <h1>Check your email</h1>
        <p role="status">
          If {actionData.email} is on NAISEMA's staff list, a sign-in link is on its way. It works once, for 15 minutes.
        </p>
        <p>Nothing after a few minutes? Check your spam folder, then ask for another link.</p>
        {actionData.devLink && (
          <p className="hint">
            Development only, where no email is sent: <a href={actionData.devLink}>open the sign-in link</a>.
          </p>
        )}
        <p>
          <a href="/admin/sign-in">Ask for another link</a>
        </p>
      </main>
    );
  }
  return (
    <main id="main" className="page">
      <h1>Sign in to NAISEMA staff</h1>
      <Form method="post">
        {actionData?.error && (
          <p role="alert" className="error">
            {actionData.error}
          </p>
        )}
        <label htmlFor="email">Your email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <button type="submit">Email me a sign-in link</button>
      </Form>
    </main>
  );
}
