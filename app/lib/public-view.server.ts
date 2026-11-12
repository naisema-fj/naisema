import { inArray } from "drizzle-orm";
import { media, topic } from "~db/schema";
import { AREA_NAMES, isPrimaryArea } from "./areas";
import { embeddedItemIds } from "./article-body";
import { type PublicItem, publicItemsById } from "./content.server";
import { itemPath, KINDS, reviewLabels } from "./content-rules";
import type { Database } from "./db.server";
import { languageName } from "./language-variety";
import { LAYER_LANGUAGE_VARIETY, LAYER_LEVELS } from "./learning-layer-fields";
import { formatBytes, UPLOAD_TYPE_NAMES, type UploadType } from "./media-rules";

/**
 * What a public page shows of an eligible item: everything already decided and in visitors' words,
 * so the page only lays it out. Media addresses go through `/media/...`, which asks the file's own
 * rights again on every request.
 */

export const imagePath = (id: string, width = 960) => `/media/images/${id}/${width}`;
export const filePath = (id: string) => `/media/files/${id}`;
const IMAGE_WIDTHS = [320, 640, 960, 1440];
const srcSet = (id: string) => IMAGE_WIDTHS.map((width) => `${imagePath(id, width)} ${width}w`).join(", ");

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const lines = (text: string | undefined) =>
  (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const links = (text: string | undefined) =>
  lines(text)
    .filter((line) => /^https:\/\//.test(line))
    .map((url) => ({ url, host: hostOf(url) }));

/** A transcript's paragraphs: "Name: words" starts a speaker's paragraph. */
export function transcriptParagraphs(text: string | undefined) {
  return lines(text).map((line) => {
    const match = /^([^:]{1,60}):\s+(.*)$/.exec(line);
    return match ? { speaker: match[1], text: match[2] } : { speaker: null, text: line };
  });
}

/** An item as a card in a list. */
export function itemCard({ item, revision }: PublicItem) {
  return {
    id: item.id,
    path: itemPath(item),
    title: revision.title,
    summary: revision.summary,
    kind: item.kind,
    kindName: KINDS[item.kind].name,
    area: isPrimaryArea(item.area) ? item.area : null,
    publishedAt: item.publishedAt,
    image: revision.fields.coverMediaId || revision.fields.posterMediaId || revision.fields.portraitMediaId || null,
  };
}
export type ItemCard = ReturnType<typeof itemCard>;

/** The full public view of one eligible item. */
export async function publicView(db: Database, found: PublicItem) {
  const { item, revision, approvals } = found;
  const { fields } = revision;
  const mediaIds = revision.mediaIds;
  const [files, topics, embedded] = await Promise.all([
    mediaIds.length ? db.select().from(media).where(inArray(media.id, mediaIds)) : Promise.resolve([]),
    revision.topics.length ? db.select().from(topic).where(inArray(topic.slug, revision.topics)) : Promise.resolve([]),
    publicItemsById(db, [...embeddedItemIds(revision.body), ...(fields.sampleItemId ? [fields.sampleItemId] : [])]),
  ]);
  const file = (id: string | undefined) => (id ? files.find((row) => row.id === id) : undefined);
  const embeds = Object.fromEntries(
    [...embedded.entries()].map(([id, shown]) => [id, { title: shown.revision.title, href: itemPath(shown.item) }]),
  );
  // A language approval is for one Language Variety, which its label names in full.
  const languageNameShown =
    LAYER_LANGUAGE_VARIETY === "standard-fijian" ? "Standard Fijian" : languageName(LAYER_LANGUAGE_VARIETY);
  const audio = file(fields.audioMediaId);
  const document = file(fields.fileMediaId);
  const footage = file(fields.videoMediaId);
  const sample = fields.sampleItemId ? embedded.get(fields.sampleItemId) : undefined;
  return {
    id: item.id,
    kind: item.kind,
    kindName: KINDS[item.kind].name,
    area: isPrimaryArea(item.area) ? item.area : null,
    areaName: isPrimaryArea(item.area) ? AREA_NAMES[item.area] : null,
    path: itemPath(item),
    title: revision.title,
    summary: revision.summary,
    credit: revision.credit,
    publishedAt: item.publishedAt,
    labels: reviewLabels({ flags: revision.flags, approvals, languageName: languageNameShown }),
    body: revision.body,
    embeds,
    topics: topics.map((row) => ({ slug: row.slug, name: row.name })),
    cover: fields.coverMediaId
      ? {
          src: imagePath(fields.coverMediaId),
          srcSet: srcSet(fields.coverMediaId),
          alt: file(fields.coverMediaId)?.alt ?? "",
        }
      : null,
    episode:
      item.kind === "episode"
        ? {
            audioPath: audio ? filePath(audio.id) : null,
            audioType: audio?.contentType ?? "",
            guests: fields.guests ?? "",
            transcript: transcriptParagraphs(fields.transcript),
            links: links(fields.links),
          }
        : null,
    resource:
      item.kind === "resource"
        ? {
            file: document
              ? {
                  path: filePath(document.id),
                  type: UPLOAD_TYPE_NAMES[document.contentType as UploadType] ?? document.contentType,
                  size: formatBytes(document.bytes),
                }
              : null,
            url: fields.externalUrl ? { href: fields.externalUrl, host: hostOf(fields.externalUrl) } : null,
            language: fields.language || "Not stated",
            ageGuidance: fields.ageGuidance || "Not stated",
            accessibility: fields.accessibility || "Not described yet.",
            usageTerms: fields.usageTerms ?? "",
          }
        : null,
    video:
      item.kind === "video" && footage
        ? {
            src: filePath(footage.id),
            type: footage.contentType,
            poster: fields.posterMediaId ? imagePath(fields.posterMediaId) : null,
            width: footage.width ?? 16,
            height: footage.height ?? 9,
            orientation: orientation(footage.width, footage.height),
            layer: revision.layer
              ? {
                  title: revision.layer.title,
                  level: LAYER_LEVELS[revision.layer.level],
                  path: `${itemPath(item)}/language`,
                }
              : null,
          }
        : null,
    creator:
      item.kind === "creator"
        ? {
            portrait: fields.portraitMediaId
              ? {
                  src: imagePath(fields.portraitMediaId, 640),
                  srcSet: srcSet(fields.portraitMediaId),
                  alt: file(fields.portraitMediaId)?.alt ?? "",
                }
              : null,
            sample: sample
              ? {
                  path: itemPath(sample.item),
                  title: sample.revision.title,
                  summary: sample.revision.summary,
                  kindName: KINDS[sample.item.kind].name,
                }
              : null,
            links: links(fields.links),
          }
        : null,
    provider:
      item.kind === "provider"
        ? {
            website: fields.website ? { href: fields.website, host: hostOf(fields.website) } : null,
            location: fields.location || "Not stated",
            offerings: lines(fields.offerings),
            contact: fields.contact ?? "",
          }
        : null,
  };
}
export type PublicView = Awaited<ReturnType<typeof publicView>>;

export const orientation = (width: number | null, height: number | null): "landscape" | "portrait" | "square" =>
  !width || !height ? "landscape" : width > height ? "landscape" : width < height ? "portrait" : "square";
