import type { ArticleSnapshot } from "./article-fields";
import { embedsFor, getArticle } from "./articles.server";
import { mainMedia } from "./content-kinds";
import type { Database } from "./db.server";
import { mediaName } from "./media.server";
import { topicNamer } from "./topics.server";

/**
 * What a Content Item Revision's page needs beyond its snapshot, for staff and for a Review Link
 * alike: its Topics by name, the Content Items its body embeds, the media library file it uses
 * and, for a Creator Profile, its free sample. Embedded items link to the staff site only where
 * `linkEmbeds` is set; a Review Link shows their titles and nothing to follow.
 */
export async function revisionDisplay(db: Database, snapshot: ArticleSnapshot, linkEmbeds: boolean) {
  const [topicNames, embeds, fileName, sample] = await Promise.all([
    topicNamer(db),
    embedsFor(db, snapshot.body),
    mediaName(db, mainMedia(snapshot)),
    snapshot.creator ? getArticle(db, snapshot.creator.sampleItemId) : null,
  ]);
  return {
    topics: topicNames(snapshot.topicIds),
    embeds: linkEmbeds
      ? embeds
      : Object.fromEntries(Object.entries(embeds).map(([id, item]) => [id, { title: item.title }])),
    fileName,
    sampleTitle: snapshot.creator ? (sample?.currentRevision.snapshot.title ?? null) : null,
  };
}
