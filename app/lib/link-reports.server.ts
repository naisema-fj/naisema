import { and, count, eq, gte } from "drizzle-orm";
import { contentItem, linkReport } from "~db/schema";
import type { Database } from "./db.server";
import { itemPath } from "./public.server";
import { linkHost } from "./resource-fields";
import { publicItem } from "./visibility.server";

/**
 * Visitors' reports that a Resource's link is broken. Nothing personal is kept: the reporter is a
 * keyed hash of their address and the day, so one person counts once a day per Resource.
 */

/** The reporter, as an HMAC of their address and the day; never the address itself. */
async function reporterKey(env: Env, request: Request, day: string) {
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`link-report|${address}|${day}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Records a report against a published Resource's link. Returns its title and page, or null. */
export async function reportBrokenLink(env: Env, db: Database, request: Request, itemId: string, now = new Date()) {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, itemId)).get();
  const published = item?.type === "resource" ? await publicItem(db, item, now) : null;
  const source = published?.snapshot.resource?.source;
  if (!item || !published || source?.kind !== "link") return null;
  await db
    .insert(linkReport)
    .values({
      contentItemId: item.id,
      reporterKey: await reporterKey(env, request, now.toISOString().slice(0, 10)),
      reportedAt: now,
    })
    .onConflictDoNothing();
  return {
    title: published.snapshot.title,
    host: linkHost(source.url),
    path: itemPath(item),
  };
}

/** How many reports a Resource's link has had since the editor last checked it. */
export async function reportsSince(db: Database, itemId: string, checkedOn: string) {
  const [row] = await db
    .select({ total: count() })
    .from(linkReport)
    .where(and(eq(linkReport.contentItemId, itemId), gte(linkReport.reportedAt, new Date(`${checkedOn}T00:00:00Z`))));
  return row?.total ?? 0;
}
