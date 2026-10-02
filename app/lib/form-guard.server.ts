import { verifyTurnstile } from "./turnstile";

/**
 * What every public form checks before it reads anything (docs/phase-1a-defaults.md §4): that the
 * sender isn't sending too often (the Workers rate-limiting binding, per address and form) and that
 * Turnstile believes a person sent it.
 */

export type GuardResult = { ok: true } | { ok: false; status: 403 | 429; error: string };

/** The visitor's address as Cloudflare saw it. */
export const visitorAddress = (request: Request) => request.headers.get("CF-Connecting-IP");

export async function guardForm(env: Env, request: Request, form: FormData, formName: string): Promise<GuardResult> {
  const address = visitorAddress(request);
  const { success } = await env.FORM_RATE_LIMIT.limit({ key: `${formName}|${address ?? "unknown"}` });
  if (!success) {
    return {
      ok: false,
      status: 429,
      error: "You've sent this form several times in the last minute. Wait a minute, then send it again.",
    };
  }
  const token = String(form.get("cf-turnstile-response") ?? "");
  if (!(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, address))) {
    return {
      ok: false,
      status: 403,
      error:
        "We couldn't check that a person sent this. Wait for the check above the button to finish, then send it again.",
    };
  }
  return { ok: true };
}
