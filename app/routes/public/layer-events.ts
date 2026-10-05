import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { recordEvent } from "~/lib/events.server";
import { eventDetail, readLearningEvent } from "~/lib/learning-events";
import { publicLayerById } from "~/lib/public-video.server";
import type { Route } from "./+types/layer-events";

/** Larger than any event the player sends. */
const MAX_BYTES = 1_024;

const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /language/:layerId/events — one learning event from the immersion player, recorded by the
 * Learning Layer's IDs only (app/lib/learning-events.ts), and only while the Learning Layer is
 * public (ADR-0007). Anyone can send one, so counts are indicative, as for `content_opened`.
 */
export async function action({ params, request, context }: Route.ActionArgs) {
  if (request.method !== "POST") return reply(405);
  const { env } = context.get(cloudflareContext);
  const layer = await publicLayerById(getDb(env.DB), params.layerId);
  if (!layer) return reply(404);
  const body = await request.text();
  if (body.length > MAX_BYTES) return reply(413);
  let sent: unknown;
  try {
    sent = JSON.parse(body);
  } catch {
    return reply(400);
  }
  const event = readLearningEvent(sent, layer.snapshot);
  if (!event) return reply(400);
  recordEvent(env, event.name, [layer.id, ...eventDetail(event)]);
  return reply(204);
}

export function loader() {
  return reply(405);
}
