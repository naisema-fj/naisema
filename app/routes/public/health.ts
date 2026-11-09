import { sql } from "drizzle-orm";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import type { Route } from "./+types/health";

/** GET /health, for the external uptime monitor (ADR-0012): answers only after reading D1, never cached. */
export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.get(cloudflareContext).env.DB);
  try {
    await db.run(sql`select 1`);
    return new Response("ok", { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  } catch {
    return new Response("database unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
