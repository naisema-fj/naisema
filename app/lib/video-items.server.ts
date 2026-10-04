import { and, eq } from "drizzle-orm";
import { contentItem, revision, videoAsset } from "~db/schema";
import type { ArticleSnapshot } from "./article-fields";
import type { Database } from "./db.server";

/** A Video Content Item with its current draft's title and Content Flags, and the Video Asset it shows. */
export async function videoItem(db: Database, contentItemId: string) {
  const row = await db
    .select({ item: contentItem, snapshot: revision.snapshot })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(and(eq(contentItem.id, contentItemId), eq(contentItem.type, "video")))
    .get();
  if (!row) return null;
  const snapshot = row.snapshot as ArticleSnapshot;
  const asset = snapshot.video
    ? await db.select().from(videoAsset).where(eq(videoAsset.id, snapshot.video.videoAssetId)).get()
    : undefined;
  if (!asset) return null;
  return { id: row.item.id, title: snapshot.title, flags: snapshot.flags ?? [], video: asset };
}
