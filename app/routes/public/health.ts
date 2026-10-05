import { cloudflareContext } from "~/lib/cloudflare";
import { logError } from "~/lib/log.server";
import type { Route } from "./+types/health";

/**
 * For the external uptime monitor (ADR-0012): "ok" once the Worker has answered and read from D1.
 * Public pages may be served from the edge cache while the Worker or database is failing, so the
 * monitor checks this as well as the homepage. Says nothing else about the platform.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };
  try {
    await env.DB.prepare("SELECT 1").first();
  } catch (error) {
    logError("Health check failed", { error });
    return new Response("unavailable\n", { status: 503, headers });
  }
  return new Response("ok\n", { headers });
}
