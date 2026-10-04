import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { verifyStreamSignature } from "~/lib/stream-signing";
import { readLimitedBytes, UploadTooLarge } from "~/lib/upload-limit.server";
import { applyProviderUpdate } from "~/lib/video-assets.server";
import { optionalSecret } from "~/lib/video-provider.server";
import { readStreamVideo } from "~/lib/video-rules";
import type { Route } from "./+types/stream-webhook";

/** A Stream webhook body is one video object: a few kilobytes. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * POST /webhooks/stream — Cloudflare Stream reports a video ready or failed (ADR-0008). Only a
 * delivery signed with the webhook secret is read. Reports only move a Video Asset forwards, so a
 * repeated or late delivery changes nothing, and a video this environment doesn't know (another
 * environment's, as one account has one webhook address) is acknowledged and ignored.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  let body: string;
  try {
    body = new TextDecoder().decode(await readLimitedBytes(request, MAX_BODY_BYTES));
  } catch (error) {
    if (error instanceof UploadTooLarge) return new Response("Too large", { status: 413 });
    throw error;
  }
  const secret = optionalSecret(env, "STREAM_WEBHOOK_SECRET") ?? "";
  if (!(await verifyStreamSignature(secret, request.headers.get("Webhook-Signature"), body))) {
    return new Response("Signature refused", { status: 401 });
  }
  let video: ReturnType<typeof readStreamVideo> = null;
  try {
    video = readStreamVideo(JSON.parse(body));
  } catch {
    // Not JSON: nothing to act on, and nothing a retry would fix.
  }
  if (video) await applyProviderUpdate(getDb(env.DB), "stream", video.providerId, video.update);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function loader() {
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
