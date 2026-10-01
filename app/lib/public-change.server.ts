import { eq, inArray, or } from "drizzle-orm";
import { contentItem, revision, topic } from "~db/schema";
import type { ArticleSnapshot } from "./article-fields";
import type { Database } from "./db.server";
import { mediaPaths } from "./media-delivery.server";
import { itemsMentioning } from "./mentions.server";
import { pagesShowing, purgePublicPages } from "./public-cache.server";
import { indexItem } from "./search.server";

/**
 * Call after anything that may change what the public sees of an item: publishing, withdrawing,
 * archiving, a review decision, a rights change or a new address. Its search entry is rebuilt and
 * the pages showing it (its own, its area or site page, its Topic pages and any it leads, the
 * homepage and the sitemap) are purged from the edge cache (ADR-0007), together, in one place; so
 * are the items that show it in turn.
 */
export async function publicItemChanged(
  env: Env,
  db: Database,
  itemId: string,
  alsoPurge: string[] = [],
  { mentions = true }: { mentions?: boolean } = {},
) {
  await indexItem(db, itemId);
  // Items that show this one (a Creator's free sample, a related or embedded item) change with it.
  // One level only, so items that mention each other can't loop.
  if (mentions) {
    for (const id of await itemsMentioning(db, itemId)) {
      if (id !== itemId) await publicItemChanged(env, db, id, [], { mentions: false });
    }
  }
  const item = await db.select().from(contentItem).where(eq(contentItem.id, itemId)).get();
  if (!item) return;
  // Its Topics as last published and as now drafted: either may list it.
  const revisionIds = [item.currentPublishedRevisionId, item.currentDraftRevisionId].filter(
    (id): id is string => id !== null,
  );
  const snapshots = revisionIds.length
    ? await db.select({ snapshot: revision.snapshot }).from(revision).where(inArray(revision.id, revisionIds))
    : [];
  const topicIds = [...new Set(snapshots.flatMap(({ snapshot }) => (snapshot as ArticleSnapshot).topicIds ?? []))];
  // A Topic it leads shows it too, even once it is no longer tagged with that Topic.
  const topics = await db
    .select({ slug: topic.slug, parentId: topic.parentTopicId })
    .from(topic)
    .where(
      topicIds.length ? or(inArray(topic.id, topicIds), eq(topic.leadItemId, itemId)) : eq(topic.leadItemId, itemId),
    );
  // A subtopic's items also show on its broader Topic's page, whole and filtered to the subtopic.
  const parentIds = topics.map((row) => row.parentId).filter((id): id is string => id !== null);
  const parents = parentIds.length
    ? await db.select({ id: topic.id, slug: topic.slug }).from(topic).where(inArray(topic.id, parentIds))
    : [];
  const topicPaths = topics.flatMap((row) => {
    const parent = parents.find((candidate) => candidate.id === row.parentId);
    return parent ? [`/topics/${parent.slug}`, `/topics/${parent.slug}/${row.slug}`] : [];
  });
  await purgePublicPages(env, [
    ...pagesShowing({
      type: item.type,
      area: item.primaryArea,
      slug: item.slug,
      topicSlugs: topics.map((row) => row.slug),
    }),
    ...topicPaths,
    ...alsoPurge,
  ]);
}

/**
 * Call after a media library file's Rights Records change. Its own addresses are purged, and every
 * item whose current published or draft Revision uses it is brought up to date, since its
 * eligibility depends on the file's rights (#17).
 */
export async function mediaAssetChanged(env: Env, db: Database, assetId: string) {
  await purgePublicPages(env, mediaPaths(assetId));
  for (const id of await itemsMentioning(db, assetId)) await publicItemChanged(env, db, id);
}
