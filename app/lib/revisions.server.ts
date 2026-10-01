import { and, desc, eq, like, or } from "drizzle-orm";
import { contentItem, revision, slugRedirect, user } from "~db/schema";
import type { PrimaryArea } from "./areas";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { carryForwardInserts } from "./review.server";
import type { Fingerprints } from "./review-rules";
import { firstFreeSlug, slugify } from "./slug";

/**
 * The Content Item / Revision model every content type shares (ADR-0006): a stable parent row
 * pointing at its current draft, and write-once Revisions holding full snapshots. What a snapshot
 * contains is up to each content type (articles.server.ts for Articles).
 */

export type ContentType = "article";

export type Revision<Snapshot> = {
  id: string;
  number: number;
  snapshot: Snapshot;
  restoredFromRevisionId: string | null;
  createdAt: Date;
};

function toRevision<Snapshot>(row: typeof revision.$inferSelect): Revision<Snapshot> {
  return {
    id: row.id,
    number: row.number,
    snapshot: row.snapshot as Snapshot,
    restoredFromRevisionId: row.restoredFromRevisionId,
    createdAt: row.createdAt,
  };
}

/** Creates a Content Item and its first Revision. Returns the new Content Item's ID. */
export async function createContentItem(db: Database, item: NewItem & { title: string }): Promise<string> {
  const base = slugify(item.title);
  // Two items created at the same moment can pick the same free slug; the loser tries the next one.
  for (let attempt = 0; ; attempt++) {
    // An old slug another item still redirects from is taken too.
    const [current, redirected] = await Promise.all([
      db
        .select({ slug: contentItem.slug })
        .from(contentItem)
        .where(
          and(
            eq(contentItem.primaryArea, item.primaryArea),
            or(eq(contentItem.slug, base), like(contentItem.slug, `${base}-%`)),
          ),
        ),
      db
        .select({ slug: slugRedirect.slug })
        .from(slugRedirect)
        .where(
          and(
            eq(slugRedirect.primaryArea, item.primaryArea),
            or(eq(slugRedirect.slug, base), like(slugRedirect.slug, `${base}-%`)),
          ),
        ),
    ]);
    const taken = new Set([...current, ...redirected].map((row) => row.slug));
    try {
      return await insertContentItem(db, item, firstFreeSlug(base, taken));
    } catch (error) {
      if (attempt >= 2 || !String(error).includes("content_item.slug")) throw error;
    }
  }
}

type NewItem = {
  type: ContentType;
  primaryArea: PrimaryArea;
  snapshot: unknown;
  /** One per Review Type, over the fields it covers (review-rules.ts). */
  fingerprints: Fingerprints;
  createdBy: string;
};

async function insertContentItem(db: Database, item: NewItem, slug: string) {
  const now = new Date();
  const id = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const { createdBy } = item;
  await db.batch([
    db.insert(contentItem).values({
      id,
      type: item.type,
      slug,
      primaryArea: item.primaryArea,
      createdBy,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(revision).values({
      id: revisionId,
      contentItemId: id,
      number: 1,
      snapshot: item.snapshot,
      fingerprints: item.fingerprints,
      createdBy,
      createdAt: now,
    }),
    db.update(contentItem).set({ currentDraftRevisionId: revisionId }).where(eq(contentItem.id, id)),
    auditInsert(db, { actorId: createdBy, action: "content_item.created", objectType: "content_item", objectId: id }),
    auditInsert(db, {
      actorId: createdBy,
      action: "revision.saved",
      objectType: "revision",
      objectId: revisionId,
      details: { contentItemId: id, number: 1 },
    }),
  ]);
  return id;
}

/** A Content Item of the given type with its current draft Revision, or null. */
export async function getContentItem<Snapshot>(db: Database, id: string, type: ContentType) {
  const row = await db
    .select({ item: contentItem, currentRevision: revision })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(and(eq(contentItem.id, id), eq(contentItem.type, type)))
    .get();
  if (!row) return null;
  return {
    id: row.item.id,
    slug: row.item.slug,
    primaryArea: row.item.primaryArea as PrimaryArea,
    currentRevision: toRevision<Snapshot>(row.currentRevision),
  };
}

export type SaveResult = { ok: true; number: number } | { ok: false; error: string };

const STALE_SAVE_MESSAGE =
  "Someone else saved this while you were editing. Open it again to see their changes, then make yours.";

type Save = {
  contentItemId: string;
  type: ContentType;
  /** The Revision the editor started from; the save is refused if it is no longer the current draft. */
  baseRevisionId: string;
  snapshot: unknown;
  fingerprints: Fingerprints;
  savedBy: string;
  restoredFromRevisionId?: string;
};

/**
 * Appends a Revision on top of `baseRevisionId` and makes it the current draft. If a newer
 * Revision already exists the save is refused rather than silently replacing someone's work.
 */
export async function appendRevision(db: Database, save: Save): Promise<SaveResult> {
  const { contentItemId, savedBy, restoredFromRevisionId = null } = save;
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  if (item?.type !== save.type) return { ok: false, error: "That doesn't exist." };
  if (item.currentDraftRevisionId !== save.baseRevisionId) return { ok: false, error: STALE_SAVE_MESSAGE };
  const base = await db
    .select({ number: revision.number })
    .from(revision)
    .where(eq(revision.id, save.baseRevisionId))
    .get();
  if (!base) return { ok: false, error: STALE_SAVE_MESSAGE };

  const now = new Date();
  const id = crypto.randomUUID();
  const number = base.number + 1;
  const carried = await carryForwardInserts(db, {
    contentItemId,
    sourceRevisionId: restoredFromRevisionId ?? save.baseRevisionId,
    newRevisionId: id,
    newNumber: number,
    newFingerprints: save.fingerprints,
    savedBy,
  });
  try {
    await db.batch([
      // A concurrent save of the same base takes this number first; the unique index then refuses this one.
      db.insert(revision).values({
        id,
        contentItemId,
        number,
        snapshot: save.snapshot,
        fingerprints: save.fingerprints,
        restoredFromRevisionId,
        createdBy: savedBy,
        createdAt: now,
      }),
      db
        .update(contentItem)
        .set({ currentDraftRevisionId: id, updatedAt: now })
        .where(eq(contentItem.id, contentItemId)),
      auditInsert(db, {
        actorId: savedBy,
        action: restoredFromRevisionId ? "revision.restored" : "revision.saved",
        objectType: "revision",
        objectId: id,
        details: { contentItemId, number, ...(restoredFromRevisionId ? { restoredFromRevisionId } : {}) },
      }),
      ...carried,
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return { ok: false, error: STALE_SAVE_MESSAGE };
    throw error;
  }
  return { ok: true, number };
}

/** Restoring saves an earlier Revision's snapshot again as a new Revision; history is never rewritten. */
export async function restoreRevision(
  db: Database,
  restore: Omit<Save, "snapshot" | "fingerprints" | "restoredFromRevisionId"> & {
    revisionId: string;
    /** Fingerprints are computed when a Revision is written, by the content type's rules. */
    fingerprintsOf: (snapshot: unknown) => Promise<Fingerprints>;
  },
): Promise<SaveResult> {
  const earlier = await db
    .select()
    .from(revision)
    .where(and(eq(revision.id, restore.revisionId), eq(revision.contentItemId, restore.contentItemId)))
    .get();
  if (!earlier) return { ok: false, error: "That revision doesn't belong to this item." };
  const { fingerprintsOf, revisionId: _, ...save } = restore;
  return appendRevision(db, {
    ...save,
    snapshot: earlier.snapshot,
    fingerprints: await fingerprintsOf(earlier.snapshot),
    restoredFromRevisionId: earlier.id,
  });
}

/** Every Revision of a Content Item, newest first, with who saved it. */
export async function listRevisions<Snapshot>(db: Database, contentItemId: string) {
  const rows = await db
    .select({ revision, savedBy: user.email })
    .from(revision)
    .leftJoin(user, eq(user.id, revision.createdBy))
    .where(eq(revision.contentItemId, contentItemId))
    .orderBy(desc(revision.number));
  const numbers = new Map(rows.map((row) => [row.revision.id, row.revision.number]));
  return rows.map((row) => ({
    ...toRevision<Snapshot>(row.revision),
    savedBy: row.savedBy ?? "a former staff member",
    restoredFromNumber: row.revision.restoredFromRevisionId
      ? (numbers.get(row.revision.restoredFromRevisionId) ?? null)
      : null,
  }));
}

export async function getRevision<Snapshot>(db: Database, contentItemId: string, number: number) {
  const row = await db
    .select()
    .from(revision)
    .where(and(eq(revision.contentItemId, contentItemId), eq(revision.number, number)))
    .get();
  return row ? toRevision<Snapshot>(row) : null;
}
