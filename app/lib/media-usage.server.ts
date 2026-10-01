import { eq, like, or } from "drizzle-orm";
import { contentItem, revision } from "~db/schema";
import type { Database } from "./db.server";

/**
 * The Content Items whose current published or draft Revision mentions a media library file, so
 * they can be brought up to date when its rights change. It matches the file's ID anywhere in the
 * snapshot: an ID is a UUID, so it can't match by accident, and an extra match only costs a purge.
 */
export async function itemsUsingMedia(db: Database, assetId: string) {
  const rows = await db
    .selectDistinct({ id: contentItem.id })
    .from(contentItem)
    .innerJoin(
      revision,
      or(eq(revision.id, contentItem.currentPublishedRevisionId), eq(revision.id, contentItem.currentDraftRevisionId)),
    )
    .where(like(revision.snapshot, `%${assetId}%`));
  return rows.map((row) => row.id);
}
