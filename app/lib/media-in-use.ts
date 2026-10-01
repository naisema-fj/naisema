import type { ArticleSnapshot } from "./article-fields";

/** A media library image address: /media/images/{asset id}/{width}, on any of our hosts. */
const MEDIA_IMAGE = /^\/media\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//;

/**
 * The media library files a Revision shows or offers, each once: images in its body served from
 * the media library, a Resource's file and an Episode's audio. Each needs a current Rights Record
 * of its own for the Revision to be public (#17, ADR-0007). Images from other sites are covered by
 * the item's own Rights Record.
 */
export function mediaAssetIdsIn(snapshot: ArticleSnapshot): string[] {
  const ids = new Set<string>();
  visit(snapshot.body, (src) => {
    const match = pathOf(src)?.match(MEDIA_IMAGE);
    if (match) ids.add(match[1]);
  });
  if (snapshot.resource?.source.kind === "file") ids.add(snapshot.resource.source.assetId);
  if (snapshot.episode) ids.add(snapshot.episode.audioAssetId);
  return [...ids];
}

/** Calls `found` with the address of every image in a body, at any depth. */
function visit(node: unknown, found: (src: string) => void) {
  if (typeof node !== "object" || node === null) return;
  const { type, attrs, content } = node as { type?: unknown; attrs?: { src?: unknown }; content?: unknown };
  if (type === "image" && typeof attrs?.src === "string") found(attrs.src);
  if (Array.isArray(content)) for (const child of content) visit(child, found);
}

function pathOf(src: string) {
  try {
    return new URL(src).pathname;
  } catch {
    return null;
  }
}
