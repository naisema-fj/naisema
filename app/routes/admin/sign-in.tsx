import { Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { ADMIN_PATHS, getSignedIn, requestStaffSignInLink } from "~/lib/staff.server";
import type { Route } from "./+types/sign-in";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Sign in · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  if (await getSignedIn(env, request)) throw redirect(ADMIN_PATHS.home);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const email = String((await request.formData()).get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) {
    return { status: "invalid" as const };
  }

  await requestStaffSignInLink(env, request, email);
  return { status: "sent" as const, email };
}

export default function SignIn({ actionData }: Route.ComponentProps) {
  if (actionData?.status === "sent") {
    return (
      <main id="main" className="page">
        <h1>Check your email</h1>
        <p>
          If <strong>{actionData.email}</strong> belongs to a Na iSema staff account, we have sent it a sign-in link.
          The link works once and expires in 15 minutes.
        </p>
      </main>
    );
  }

  return (
    <main id="main" className="page">
      <h1>Sign in to Na iSema staff tools</h1>
      <p>We will email you a sign-in link. You will then confirm it is you with your authenticator app.</p>
      <Form method="post">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={actionData?.status === "invalid" ? "email-error" : undefined}
        />
        {actionData?.status === "invalid" && (
          <p id="email-error" role="alert">
            Enter an email address, like name@example.com.
          </p>
        )}
        <button type="submit">Email me a sign-in link</button>
      </Form>
    </main>
  );
}
