import { eq, like, or } from "drizzle-orm";
import { contentItem, revision } from "~db/schema";
import type { Database } from "./db.server";

/**
 * The Content Items whose current published or draft Revision mentions an ID: a media library file
 * they use, or another item they embed, relate to or offer as a Creator's free sample. They are
 * brought up to date when what they mention changes. It matches the ID anywhere in the snapshot:
 * an ID is a UUID, so it can't match by accident, and an extra match only costs a purge.
 */
export async function itemsMentioning(db: Database, id: string) {
  const rows = await db
    .selectDistinct({ id: contentItem.id })
    .from(contentItem)
    .innerJoin(
      revision,
      or(eq(revision.id, contentItem.currentPublishedRevisionId), eq(revision.id, contentItem.currentDraftRevisionId)),
    )
    .where(like(revision.snapshot, `%${id}%`));
  return rows.map((row) => row.id);
}
