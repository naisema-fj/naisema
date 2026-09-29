import { Form, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { ADMIN_PATHS, checkStaffCode, getSignedIn } from "~/lib/staff.server";
import type { Route } from "./+types/two-factor";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Enter your code · NAISEMA staff" }];
}

async function signedInAwaitingCode(request: Request, env: Env) {
  const signedIn = await getSignedIn(env, request);
  if (!signedIn) throw redirect(ADMIN_PATHS.signIn);
  if (!signedIn.user.twoFactorEnabled) throw redirect(ADMIN_PATHS.twoFactorSetup);
  if (signedIn.verified) throw redirect(ADMIN_PATHS.home);
  return signedIn;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await signedInAwaitingCode(request, context.get(cloudflareContext).env);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await signedInAwaitingCode(request, context.get(cloudflareContext).env);
  const code = String((await request.formData()).get("code") ?? "").trim();
  const result = await checkStaffCode(signedIn, request, code);
  if (result.ok) throw redirect(ADMIN_PATHS.home, { headers: result.headers });
  if (result.reason === "locked") throw redirect(ADMIN_PATHS.signIn);
  return { error: `That code didn't match. ${result.attemptsLeft} attempts left.` };
}

export default function TwoFactor({ actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>Enter your authenticator code</h1>
      <Form method="post">
        <label htmlFor="code">6-digit code from your authenticator app</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          required
          aria-describedby={actionData?.error ? "code-error" : undefined}
        />
        {actionData?.error && (
          <p id="code-error" role="alert">
            {actionData.error}
          </p>
        )}
        <button type="submit">Continue</button>
      </Form>
    </main>
  );
}
