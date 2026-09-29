import { Form } from "react-router";
import { renderSVG } from "uqr";
import { CodeField } from "~/components/code-field";
import { cloudflareContext } from "~/lib/cloudflare";
import { checkStaffCode, requireStaffStep, respondToCodeCheck } from "~/lib/staff.server";
import type { Route } from "./+types/two-factor-setup";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Set up your authenticator app · Na iSema staff" }];
}

function describeKey(totpURI: string) {
  const secret = new URL(totpURI).searchParams.get("secret") ?? "";
  const qrCode = `data:image/svg+xml;base64,${btoa(renderSVG(totpURI))}`;
  return { secret, qrCode };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const signedIn = await requireStaffStep(env, request, "twoFactorSetup");
  try {
    const { totpURI } = await signedIn.auth.api.getTOTPURI({ headers: request.headers, body: {} });
    return { key: describeKey(totpURI) };
  } catch {
    return { key: null };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const signedIn = await requireStaffStep(env, request, "twoFactorSetup");
  const form = await request.formData();

  if (form.get("intent") === "start") {
    const enabled = await signedIn.auth.api.enableTwoFactor({ headers: request.headers, body: {} });
    if (enabled.method !== "totp") throw new Error("Staff two-factor must use an authenticator app (TOTP)");
    // Better Auth also generates backup codes; they are not shown because nothing accepts them yet.
    // A lost phone is recovered by an administrator resetting two-factor (follow-up issue).
    return { key: describeKey(enabled.totpURI), error: null };
  }

  const error = respondToCodeCheck(await checkStaffCode(signedIn, request, String(form.get("code") ?? "").trim()));
  return { key: null, error };
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
          <h2>1. Add Na iSema to your app</h2>
          <p>Scan this QR code with your authenticator app.</p>
          <img src={key.qrCode} width={200} height={200} alt="QR code for adding Na iSema to an authenticator app" />
          <p>
            Or type this key into the app instead: <code data-totp-secret={key.secret}>{key.secret}</code>
          </p>

          <h2>2. Enter the code your app shows</h2>
          <Form method="post">
            <input type="hidden" name="intent" value="verify" />
            <CodeField label="6-digit code" error={actionData?.error} />
            <button type="submit">Confirm</button>
          </Form>
        </>
      )}
    </main>
  );
}
