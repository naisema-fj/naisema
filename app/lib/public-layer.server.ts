import { eq } from "drizzle-orm";
import { contentItem, media } from "~db/schema";
import { findPublicItem } from "./content.server";
import type { Database } from "./db.server";
import { orientation } from "./public-view.server";

/**
 * A public Video's Learning Layer, for its player and the addresses the player reads (captions,
 * one line's English). Shown only while the Video's published Revision is eligible, which includes
 * its layer's language review and the rights its uses need (ADR-0007), asked on every request.
 */
export async function findPublicLayer(db: Database, place: string, slug: string) {
  const found = await findPublicItem(db, place, slug);
  if (found.kind !== "shown") return found;
  const { item, revision } = found;
  if (item.kind !== "video" || !revision.layer || !revision.fields.videoMediaId) return { kind: "missing" as const };
  const footage = await db.query.media.findFirst({ where: eq(media.id, revision.fields.videoMediaId) });
  if (!footage) return { kind: "missing" as const };
  return {
    kind: "shown" as const,
    item,
    revision,
    layer: revision.layer,
    footage: {
      src: `/media/files/${footage.id}`,
      type: footage.contentType,
      width: footage.width ?? 16,
      height: footage.height ?? 9,
      durationMs: footage.durationMs ?? 0,
      orientation: orientation(footage.width, footage.height),
    },
  };
}

/** The same, by the Video's ID, for the caption and English addresses. */
export async function findPublicLayerById(db: Database, itemId: string) {
  const item = await db.query.contentItem.findFirst({ where: eq(contentItem.id, itemId) });
  if (!item) return { kind: "missing" as const };
  return findPublicLayer(db, item.area, item.slug);
}
