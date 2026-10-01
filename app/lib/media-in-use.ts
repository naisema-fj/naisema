import type { ArticleSnapshot } from "./article-fields";

const ASSET_ID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
/** A media library address: an image at /media/images/{id}/{width} or a file at /media/files/{id}. */
const MEDIA_PATH = new RegExp(`^/media/(?:images/${ASSET_ID}/|files/${ASSET_ID}$)`);

/**
 * The media library files a Revision shows or offers, each once: images and links in its body
 * that point at the media library (as a path on this site or on any of our hosts), a Resource's
 * file and an Episode's audio. Each needs a current Rights Record of its own for the Revision to
 * be public (#17, ADR-0007). Images from other sites are covered by the item's own Rights Record.
 */
export function mediaAssetIdsIn(snapshot: ArticleSnapshot): string[] {
  const ids = new Set<string>();
  visit(snapshot.body, (address) => {
    const match = pathOf(address)?.match(MEDIA_PATH);
    const id = match?.[1] ?? match?.[2];
    if (id) ids.add(id);
  });
  if (snapshot.resource?.source.kind === "file") ids.add(snapshot.resource.source.assetId);
  if (snapshot.episode) ids.add(snapshot.episode.audioAssetId);
  return [...ids];
}

/** Calls `found` with every image address and link address in a body, at any depth. */
function visit(node: unknown, found: (address: string) => void) {
  if (typeof node !== "object" || node === null) return;
  const { type, attrs, content, marks } = node as {
    type?: unknown;
    attrs?: { src?: unknown };
    content?: unknown;
    marks?: unknown;
  };
  if (type === "image" && typeof attrs?.src === "string") found(attrs.src);
  if (Array.isArray(marks)) {
    for (const mark of marks as { type?: unknown; attrs?: { href?: unknown } }[]) {
      if (mark.type === "link" && typeof mark.attrs?.href === "string") found(mark.attrs.href);
    }
  }
  if (Array.isArray(content)) for (const child of content) visit(child, found);
}

/** An address's path, whether it is a path on this site or a full address. */
function pathOf(address: string) {
  try {
    return new URL(address, "https://naisema.invalid").pathname;
  } catch {
    return null;
  }
}
