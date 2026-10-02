import { and, eq, isNull, like } from "drizzle-orm";
import { contentHold, contentItem, revision } from "~db/schema";
import type { Database } from "./db.server";

/**
 * Whether a Content Item is hidden pending a Case's review (SAFE-03). The eligibility decision asks
 * this, so a held item leaves the public site at once and can't be republished until the hold is lifted.
 */
export async function activeHold(db: Database, contentItemId: string) {
  return (
    (await db
      .select()
      .from(contentHold)
      .where(and(eq(contentHold.contentItemId, contentItemId), isNull(contentHold.liftedAt)))
      .get()) ?? null
  );
}

/**
 * Whether a media library file is used by a held item's published Revision. Such a file isn't
 * delivered either, even where other items use it too: the harm a report is about may be the image.
 * Matched in the snapshot as itemsMentioning does (mentions.server.ts).
 */
export async function usedByHeldItem(db: Database, assetId: string) {
  const row = await db
    .select({ id: contentHold.id })
    .from(contentHold)
    .innerJoin(contentItem, eq(contentItem.id, contentHold.contentItemId))
    .innerJoin(revision, eq(revision.id, contentItem.currentPublishedRevisionId))
    .where(and(isNull(contentHold.liftedAt), like(revision.snapshot, `%${assetId}%`)))
    .get();
  return Boolean(row);
}
