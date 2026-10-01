import { and, eq, ne } from "drizzle-orm";
import { contentItem, slugRedirect } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { publicPath } from "./public.server";
import { slugify } from "./slug";

export type SlugChange = { ok: true; oldPath: string; newPath: string } | { ok: false; error: string };

/**
 * Changes a Content Item's slug. The old slug is kept as a redirect, so links to the old address
 * answer with a 301 to the new one (docs/phase-1a-defaults.md §5).
 */
export async function changeSlug(
  db: Database,
  changedBy: string,
  contentItemId: string,
  requested: string,
): Promise<SlugChange> {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  if (!item) return { ok: false, error: "That item doesn't exist." };
  const slug = slugify(requested);
  if (!requested.trim() || slug !== requested.trim()) {
    return { ok: false, error: `Use lower-case letters, digits and hyphens, for example "${slug}".` };
  }
  if (slug === item.slug) return { ok: false, error: "That is already its slug." };

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
      .where(
        and(
          eq(slugRedirect.primaryArea, area),
          eq(slugRedirect.slug, slug),
          ne(slugRedirect.contentItemId, contentItemId),
        ),
      )
      .get(),
  ]);
  if (takenByItem || takenByRedirect) return { ok: false, error: "Another item already uses or used that address." };

  await db.batch([
    // Taking back one of its own old slugs: that address stops being a redirect.
    db.delete(slugRedirect).where(and(eq(slugRedirect.primaryArea, area), eq(slugRedirect.slug, slug))),
    db
      .insert(slugRedirect)
      .values({ primaryArea: area, slug: item.slug, contentItemId, createdAt: new Date() })
      .onConflictDoNothing(),
    db.update(contentItem).set({ slug, updatedAt: new Date() }).where(eq(contentItem.id, contentItemId)),
    auditInsert(db, {
      actorId: changedBy,
      action: "content_item.slug_changed",
      objectType: "content_item",
      objectId: contentItemId,
      details: { from: item.slug, to: slug },
    }),
  ]);
  return { ok: true, oldPath: publicPath(area, item.slug), newPath: publicPath(area, slug) };
}
