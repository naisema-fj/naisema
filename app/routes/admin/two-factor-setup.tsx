import { Form, redirect } from "react-router";
import { renderSVG } from "uqr";
import { cloudflareContext } from "~/lib/cloudflare";
import { ADMIN_PATHS, checkStaffCode, getSignedIn } from "~/lib/staff.server";
import type { Route } from "./+types/two-factor-setup";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Set up your authenticator app · NAISEMA staff" }];
}

async function signedInWithoutTwoFactor(request: Request, env: Env) {
  const signedIn = await getSignedIn(env, request);
  if (!signedIn) throw redirect(ADMIN_PATHS.signIn);
  if (signedIn.user.twoFactorEnabled) throw redirect(ADMIN_PATHS.twoFactor);
  return signedIn;
}

function describeKey(totpURI: string) {
  const secret = new URL(totpURI).searchParams.get("secret") ?? "";
  const qrCode = `data:image/svg+xml;base64,${btoa(renderSVG(totpURI))}`;
  return { secret, qrCode };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const signedIn = await signedInWithoutTwoFactor(request, env);
  try {
    const { totpURI } = await signedIn.auth.api.getTOTPURI({ headers: request.headers, body: {} });
    return { key: describeKey(totpURI) };
  } catch {
    return { key: null };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const signedIn = await signedInWithoutTwoFactor(request, env);
  const form = await request.formData();

  if (form.get("intent") === "start") {
    const enabled = await signedIn.auth.api.enableTwoFactor({ headers: request.headers, body: {} });
    if (enabled.method !== "totp") throw new Error("Staff two-factor must use an authenticator app (TOTP)");
    return { key: describeKey(enabled.totpURI), backupCodes: enabled.backupCodes, error: null };
  }

  const result = await checkStaffCode(signedIn, request, String(form.get("code") ?? "").trim());
  if (result.ok) throw redirect(ADMIN_PATHS.home, { headers: result.headers });
  if (result.reason === "locked") throw redirect(ADMIN_PATHS.signIn);
  return { key: null, backupCodes: null, error: `That code didn't match. ${result.attemptsLeft} attempts left.` };
}

export default function TwoFactorSetup({ loaderData, actionData }: Route.ComponentProps) {
  const key = actionData?.key ?? loaderData.key;

  return (
    <main id="main" className="page">
      <h1>Set up your authenticator app</h1>
      <p>
        Staff tools need a second step after the email link: a 6-digit code from an authenticator app such as Google
        Authenticator, Microsoft Authenticator or 1Password.
      </p>

      {!key ? (
        <Form method="post">
          <input type="hidden" name="intent" value="start" />
          <button type="submit">Start setup</button>
        </Form>
      ) : (
        <>
          <h2>1. Add NAISEMA to your app</h2>
          <p>Scan this QR code with your authenticator app.</p>
          <img src={key.qrCode} width={200} height={200} alt="QR code for adding NAISEMA to an authenticator app" />
          <p>
            Or type this key into the app instead: <code data-totp-secret={key.secret}>{key.secret}</code>
          </p>

          {actionData?.backupCodes && (
            <>
              <h2>2. Keep these backup codes somewhere safe</h2>
              <p>Each code works once if you lose your phone. They are shown only now.</p>
              <ul>
                {actionData.backupCodes.map((backupCode) => (
                  <li key={backupCode}>
                    <code>{backupCode}</code>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2>{actionData?.backupCodes ? "3." : "2."} Enter the code your app shows</h2>
          <Form method="post">
            <input type="hidden" name="intent" value="verify" />
            <label htmlFor="code">6-digit code</label>
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
            <button type="submit">Confirm</button>
          </Form>
        </>
      )}
    </main>
  );
}
