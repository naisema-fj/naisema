import { and, eq } from "drizzle-orm";
import { contentItem, slugRedirect } from "~db/schema";
import type { PrimaryArea } from "./areas";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { isReservedSlug, slugify } from "./slug";

export type SlugChange =
  | { ok: true; area: PrimaryArea; oldSlug: string; newSlug: string }
  | { ok: false; error: string };

/**
 * Changes a Content Item's slug. The old slug is kept as a redirect, so links to the old address
 * answer with a 301 to the new one (docs/phase-1a-defaults.md §5). An old slug is never reused,
 * not even by the same item: browsers keep permanent redirects, so moving back would loop.
 */
export async function changeSlug(
  db: Database,
  changedBy: string,
  contentItemId: string,
  requested: string,
): Promise<SlugChange> {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  if (!item) return { ok: false, error: "That item doesn't exist." };
  // A Page's address is the footer page it backs, so it never moves.
  if (item.type === "page") return { ok: false, error: "A Page's address is fixed by the site page it backs." };
  const slug = slugify(requested);
  if (!requested.trim() || slug !== requested.trim()) {
    return { ok: false, error: `Use lower-case letters, digits and hyphens, for example "${slug}".` };
  }
  if (slug === item.slug) return { ok: false, error: "That is already its slug." };
  if (isReservedSlug(item.primaryArea, slug))
    return { ok: false, error: "That address is one of the area's own pages." };

  const area = item.primaryArea;
  const [takenByItem, takenByRedirect] = await Promise.all([
    db
      .select({ id: contentItem.id })
      .from(contentItem)
      .where(and(eq(contentItem.primaryArea, area), eq(contentItem.slug, slug)))
      .get(),
    db
      .select({ id: slugRedirect.contentItemId })
      .from(slugRedirect)
      .where(and(eq(slugRedirect.primaryArea, area), eq(slugRedirect.slug, slug)))
      .get(),
  ]);
  if (takenByItem || takenByRedirect)
    return { ok: false, error: "That address is in use or was used before. Choose a new one." };

  await db.batch([
    db.insert(slugRedirect).values({ primaryArea: area, slug: item.slug, contentItemId, createdAt: new Date() }),
    db.update(contentItem).set({ slug, updatedAt: new Date() }).where(eq(contentItem.id, contentItemId)),
    auditInsert(db, {
      actorId: changedBy,
      action: "content_item.slug_changed",
      objectType: "content_item",
      objectId: contentItemId,
      details: { from: item.slug, to: slug },
    }),
  ]);
  return { ok: true, area: area as PrimaryArea, oldSlug: item.slug, newSlug: slug };
}
