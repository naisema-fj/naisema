import { and, desc, eq, inArray, isNotNull, like, or } from "drizzle-orm";
import { contentItem, media, review, revision, rightsRecord } from "~db/schema";
import { EMPTY_ARTICLE_BODY } from "./article-body";
import { audit } from "./audit.server";
import { fijiToday } from "./calendar";
import {
  type ContentFlag,
  type ContentKind,
  eligibility,
  KINDS,
  type KindFields,
  type Place,
  type ReviewDecision,
  type ReviewType,
  requiredReviews,
  revisionMediaIds,
} from "./content-rules";
import type { Database } from "./db.server";
import { type LearningLayer, layerReadinessProblems } from "./learning-layer-fields";
import { can, type Staff } from "./roles";
import { firstFreeSlug, slugify } from "./slug";

/**
 * Content Items, their write-once Revisions, Review Approvals and publication (ADR-0003, ADR-0006,
 * ADR-0007, ADR-0015). Every change is permission-checked here and audited; every public read asks
 * `eligibility` again, so a withdrawn right or approval takes effect on the next request.
 */

export type ItemRow = typeof contentItem.$inferSelect;
export type RevisionRow = typeof revision.$inferSelect;
export type ReviewRow = typeof review.$inferSelect;

export class Refused extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Who may change a Content Item of this kind: editors any, Educators Videos. */
export const mayEdit = (actor: Staff, kind: ContentKind) =>
  can(actor, "content.edit") || (kind === "video" && can(actor, "video.edit"));

/** Which Review Types a person may decide, given their roles. */
export function mayReview(actor: Staff, type: ReviewType) {
  return can(actor, `review.${type}`);
}

const facts = (item: ItemRow, rev: RevisionRow) => ({
  kind: item.kind,
  place: item.area as Place,
  flags: rev.flags,
  fields: rev.fields,
  hasLayer: rev.layer !== null,
  layerReady: rev.layer
    ? layerReadinessProblems(rev.layer)
    : item.kind === "video"
      ? ["It has no Learning Layer yet."]
      : [],
  authorEmail: rev.authorEmail,
});

/**
 * Whether each Revision may be public today, worked out for many at once: the reviews on each
 * exact Revision and the Rights Records on its item and every media file it shows.
 */
export async function eligibilityOf(
  db: Database,
  pairs: { item: ItemRow; revision: RevisionRow }[],
  today = fijiToday(),
) {
  const revisionIds = pairs.map((pair) => pair.revision.id);
  const itemIds = pairs.map((pair) => pair.item.id);
  const mediaIds = [...new Set(pairs.flatMap((pair) => pair.revision.mediaIds))];
  const [reviews, rights, files] = revisionIds.length
    ? await Promise.all([
        db.select().from(review).where(inArray(review.revisionId, revisionIds)),
        db
          .select()
          .from(rightsRecord)
          .where(
            or(
              and(eq(rightsRecord.subjectType, "item"), inArray(rightsRecord.subjectId, itemIds)),
              mediaIds.length
                ? and(eq(rightsRecord.subjectType, "media"), inArray(rightsRecord.subjectId, mediaIds))
                : undefined,
            ),
          ),
        mediaIds.length
          ? db.select({ id: media.id, filename: media.filename }).from(media).where(inArray(media.id, mediaIds))
          : Promise.resolve([]),
      ])
    : [[], [], []];
  const names = new Map(files.map((file) => [file.id, file.filename]));
  const recordsOf = (type: "item" | "media", id: string) =>
    rights.filter((record) => record.subjectType === type && record.subjectId === id);
  return new Map(
    pairs.map(({ item, revision: rev }) => [
      rev.id,
      eligibility({
        revision: facts(item, rev),
        reviews: reviews.filter((row) => row.revisionId === rev.id),
        itemRights: recordsOf("item", item.id),
        media: rev.mediaIds.map((id) => ({
          id,
          name: names.has(id) ? `the file ${names.get(id)}` : "a media file that no longer exists",
          records: recordsOf("media", id),
        })),
        held: item.heldAt !== null,
        today,
      }),
    ]),
  );
}

// --- Staff: items and Revisions ---

export async function latestRevision(db: Database, itemId: string) {
  return db.query.revision.findFirst({ where: eq(revision.itemId, itemId), orderBy: desc(revision.number) });
}

/** A new Content Item with an empty first Revision, at a free address in its place. */
export async function createItem(
  db: Database,
  actor: Staff,
  input: { kind: ContentKind; place: Place; title: string },
) {
  if (!mayEdit(actor, input.kind)) throw new Refused("Your roles don't allow adding this kind of item.", 403);
  if (!KINDS[input.kind].places.includes(input.place)) throw new Refused(`A ${KINDS[input.kind].name} can't go there.`);
  const title = input.title.trim();
  if (!title) throw new Refused("Enter a title.");
  const taken = await db.select({ slug: contentItem.slug }).from(contentItem).where(eq(contentItem.area, input.place));
  const slug = firstFreeSlug(slugify(title) || "item", new Set(taken.map((row) => row.slug)));
  const id = crypto.randomUUID();
  const now = new Date();
  await db.batch([
    db.insert(contentItem).values({ id, kind: input.kind, area: input.place, slug, title, updatedAt: now }),
    db.insert(revision).values({
      id: crypto.randomUUID(),
      itemId: id,
      number: 1,
      title,
      summary: "",
      credit: "",
      flags: [],
      topics: [],
      body: EMPTY_ARTICLE_BODY,
      fields: {},
      layer: null,
      mediaIds: [],
      authorEmail: actor.email,
    }),
    audit(db, actor.email, "item.created", { type: "content_item", id }, { kind: input.kind, place: input.place }),
  ]);
  return id;
}

export type RevisionInput = {
  title: string;
  summary: string;
  credit: string;
  flags: ContentFlag[];
  topics: string[];
  body: RevisionRow["body"];
  fields: KindFields;
  layer: LearningLayer | null;
};

/**
 * Saves an edit as a new Revision (never changing an earlier one), from the Revision the editor
 * started on, so two people saving at once can't silently overwrite each other.
 */
export async function saveRevision(
  db: Database,
  actor: Staff,
  itemId: string,
  baseRevisionId: string,
  input: RevisionInput,
) {
  const item = await db.query.contentItem.findFirst({ where: eq(contentItem.id, itemId) });
  if (!item) throw new Refused("That item doesn't exist.", 404);
  if (!mayEdit(actor, item.kind)) throw new Refused("Your roles don't allow editing this item.", 403);
  if (item.state === "archived") throw new Refused("An archived item can't be edited.");
  const latest = await latestRevision(db, itemId);
  if (!latest || latest.id !== baseRevisionId) {
    throw new Refused(
      "Someone saved a newer version while you were editing. Open the latest one and make your change again.",
      409,
    );
  }
  const title = input.title.trim();
  if (!title) throw new Refused("Enter a title.");
  const fields: KindFields = {};
  for (const spec of KINDS[item.kind].fields) {
    const value = input.fields[spec.name]?.trim() ?? "";
    if (spec.type === "url" && value && !/^https:\/\//.test(value))
      throw new Refused(`${spec.label} must start with https://.`);
    if (value) fields[spec.name] = value.slice(0, spec.type === "textarea" ? 100_000 : 500);
  }
  const id = crypto.randomUUID();
  const number = latest.number + 1;
  await db.batch([
    db.insert(revision).values({
      id,
      itemId,
      number,
      title: title.slice(0, 200),
      summary: input.summary.trim().slice(0, 1000),
      credit: input.credit.trim().slice(0, 300),
      flags: input.flags,
      topics: input.topics,
      body: input.body,
      fields,
      layer: item.kind === "video" ? input.layer : null,
      mediaIds: revisionMediaIds(item.kind, fields, input.body),
      authorEmail: actor.email,
    }),
    db.update(contentItem).set({ title, updatedAt: new Date() }).where(eq(contentItem.id, itemId)),
    audit(db, actor.email, "revision.saved", { type: "content_item", id: itemId }, { revision: number }),
  ]);
  return { id, number };
}

/** A Content Item for its staff pages: its latest and published Revisions and where the latest stands. */
export async function itemForStaff(db: Database, itemId: string) {
  const item = await db.query.contentItem.findFirst({ where: eq(contentItem.id, itemId) });
  if (!item) return null;
  const latest = (await latestRevision(db, itemId)) as RevisionRow;
  const published = item.publishedRevisionId
    ? await db.query.revision.findFirst({ where: eq(revision.id, item.publishedRevisionId) })
    : null;
  const reviews = await db
    .select()
    .from(review)
    .where(eq(review.revisionId, latest.id))
    .orderBy(desc(review.createdAt));
  const decided = (await eligibilityOf(db, [{ item, revision: latest }])).get(latest.id) as {
    eligible: boolean;
    reasons: string[];
  };
  return {
    item,
    latest,
    published: published ?? null,
    reviews,
    required: requiredReviews(facts(item, latest)),
    eligibility: decided,
  };
}

/**
 * Records a review decision on one exact Revision. Nobody decides on a Revision they wrote; a
 * language review needs the reviewer's own Language Variety; a Knowledge Holder Approval is
 * recorded by an editor and names who approved and how.
 */
export async function recordReview(
  db: Database,
  actor: Staff,
  revisionId: string,
  input: {
    type: ReviewType;
    decision: ReviewDecision;
    notes: string;
    knowledgeHolder?: { name: string; how: string; conditions: string };
  },
) {
  const rev = await db.query.revision.findFirst({ where: eq(revision.id, revisionId) });
  if (!rev) throw new Refused("That version doesn't exist.", 404);
  if (!mayReview(actor, input.type)) throw new Refused("Your roles don't include that review.", 403);
  if (rev.authorEmail.toLowerCase() === actor.email.toLowerCase()) {
    throw new Refused("You wrote this version, so someone else has to review it.", 403);
  }
  if (input.type === "language" && actor.languageVariety !== "standard-fijian") {
    throw new Refused("Your staff record doesn't say you review Standard Fijian.", 403);
  }
  let knowledgeHolder = null;
  if (input.type === "knowledge-holder" && input.decision === "approved") {
    const name = input.knowledgeHolder?.name.trim() ?? "";
    const how = input.knowledgeHolder?.how.trim() ?? "";
    if (!name || !how) throw new Refused("Record who the Knowledge Holder is and how they approved.");
    knowledgeHolder = { name, how, conditions: input.knowledgeHolder?.conditions.trim() ?? "" };
  }
  if (input.decision === "changes-requested" && !input.notes.trim()) {
    throw new Refused("Say what needs to change.");
  }
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(review).values({
      id,
      revisionId,
      type: input.type,
      decision: input.decision,
      reviewerEmail: actor.email,
      notes: input.notes.trim().slice(0, 4000),
      knowledgeHolder,
    }),
    audit(
      db,
      actor.email,
      `review.${input.decision}`,
      { type: "content_item", id: rev.itemId },
      {
        revision: rev.number,
        reviewType: input.type,
      },
    ),
  ]);
  return id;
}

/** The words search matches, from a Revision's title, summary, credit, body and text fields. */
function searchTextOf(rev: RevisionRow) {
  const words: string[] = [rev.title, rev.summary, rev.credit];
  const walk = (value: unknown) => {
    if (typeof value === "string") return;
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") {
      const node = value as { text?: unknown };
      if (typeof node.text === "string") words.push(node.text);
      Object.values(value).forEach(walk);
    }
  };
  walk(rev.body);
  words.push(rev.fields.transcript ?? "", rev.fields.guests ?? "", rev.fields.offerings ?? "");
  for (const segment of rev.layer?.segments ?? []) words.push(segment.fijian, segment.english);
  return words.join(" ").replace(/\s+/g, " ").toLowerCase().slice(0, 200_000);
}

/** Publishes the latest Revision, if it is eligible right now; the reasons otherwise. */
export async function publish(db: Database, actor: Staff, itemId: string, revisionId: string) {
  if (!can(actor, "content.publish")) throw new Refused("Only editors publish.", 403);
  const found = await itemForStaff(db, itemId);
  if (!found) throw new Refused("That item doesn't exist.", 404);
  if (found.latest.id !== revisionId)
    throw new Refused("A newer version was saved. Publish that one once it is ready.", 409);
  if (found.item.state === "archived") throw new Refused("An archived item can't be published.");
  if (!found.eligibility.eligible)
    throw new Refused(`It can't be published yet. ${found.eligibility.reasons.join(" ")}`);
  const now = new Date();
  await db.batch([
    db
      .update(contentItem)
      .set({
        state: "published",
        publishedRevisionId: revisionId,
        searchText: searchTextOf(found.latest),
        publishedAt: found.item.publishedAt ?? now,
        updatedAt: now,
      })
      .where(eq(contentItem.id, itemId)),
    audit(db, actor.email, "item.published", { type: "content_item", id: itemId }, { revision: found.latest.number }),
  ]);
}

/** Takes an item off the public site (withdrawn) or out of use (archived), with a reason. */
export async function unpublish(
  db: Database,
  actor: Staff,
  itemId: string,
  to: "withdrawn" | "archived",
  reason: string,
) {
  if (!can(actor, "content.publish")) throw new Refused("Only editors withdraw or archive.", 403);
  const item = await db.query.contentItem.findFirst({ where: eq(contentItem.id, itemId) });
  if (!item) throw new Refused("That item doesn't exist.", 404);
  if (!reason.trim()) throw new Refused("Give a reason, so it can be explained later.");
  await db.batch([
    db
      .update(contentItem)
      .set({ state: to, publishedRevisionId: null, searchText: "", updatedAt: new Date() })
      .where(eq(contentItem.id, itemId)),
    audit(db, actor.email, `item.${to}`, { type: "content_item", id: itemId }, { reason: reason.trim().slice(0, 500) }),
  ]);
}

/**
 * Holds an item off the public site while a Report about it is looked into (CONTEXT.md, Report).
 * Only the Safeguarding Lead holds and releases. The item stays published, so nothing else about
 * it changes, and it shows again when the hold is released, if it is still eligible then.
 */
export async function holdItem(db: Database, actor: Staff, itemId: string, reason: string) {
  if (!can(actor, "content.hold")) throw new Refused("Only the Safeguarding Lead holds an item.", 403);
  const item = await db.query.contentItem.findFirst({ where: eq(contentItem.id, itemId) });
  if (!item) throw new Refused("That item doesn't exist.", 404);
  const why = reason.trim().slice(0, 500);
  if (!why) throw new Refused("Say why it is held, such as which report it is about.");
  if (item.heldAt) throw new Refused("It is already held.", 409);
  const now = new Date();
  await db.batch([
    db
      .update(contentItem)
      .set({ heldAt: now, heldBy: actor.email, heldReason: why, updatedAt: now })
      .where(eq(contentItem.id, itemId)),
    audit(db, actor.email, "item.held", { type: "content_item", id: itemId }, { reason: why }),
  ]);
}

/** Ends a hold. The item is public again at once if its published Revision is still eligible. */
export async function releaseItem(db: Database, actor: Staff, itemId: string, reason: string) {
  if (!can(actor, "content.hold")) throw new Refused("Only the Safeguarding Lead releases a hold.", 403);
  const item = await db.query.contentItem.findFirst({ where: eq(contentItem.id, itemId) });
  if (!item) throw new Refused("That item doesn't exist.", 404);
  if (!item.heldAt) throw new Refused("It isn't held.", 409);
  await db.batch([
    db
      .update(contentItem)
      .set({ heldAt: null, heldBy: null, heldReason: null, updatedAt: new Date() })
      .where(eq(contentItem.id, itemId)),
    audit(
      db,
      actor.email,
      "item.released",
      { type: "content_item", id: itemId },
      { reason: reason.trim().slice(0, 500) },
    ),
  ]);
}

/** Every item on hold, oldest hold first, so none is forgotten. */
export const heldItems = (db: Database) =>
  db.select().from(contentItem).where(isNotNull(contentItem.heldAt)).orderBy(contentItem.heldAt);

/**
 * The item a Report's "where is it" answer names, when it is a NAISEMA address: a path such as
 * `/voices/talanoa` (the report link on every page fills one in) or a full URL to one.
 */
export async function itemAtAddress(db: Database, address: string) {
  let path = address.trim();
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    return null;
  }
  const parts = path.split(/[?#]/)[0].split("/").filter(Boolean);
  if (parts.length === 3 && parts[2] === "language") parts.pop();
  const [place, slug] = parts.length === 1 ? ["pages", parts[0]] : parts.length === 2 ? parts : [];
  if (!place || !slug) return null;
  return (
    (await db.query.contentItem.findFirst({
      where: and(eq(contentItem.area, place.toLowerCase()), eq(contentItem.slug, slug.toLowerCase())),
    })) ?? null
  );
}

/** Staff lists: every item, newest change first, optionally of one kind or matching words. */
export function listItems(db: Database, filter: { kind?: ContentKind; query?: string } = {}) {
  const where = and(
    filter.kind ? eq(contentItem.kind, filter.kind) : undefined,
    filter.query ? like(contentItem.title, `%${filter.query.replace(/[%_]/g, "")}%`) : undefined,
  );
  return db.select().from(contentItem).where(where).orderBy(desc(contentItem.updatedAt)).limit(200);
}

// --- The public site ---

export type PublicItem = { item: ItemRow; revision: RevisionRow; approvals: ReviewRow[] };

/**
 * Published items that are eligible right now, newest first: in an area, under a Topic, matching
 * search words, or of some kinds. Each is checked by `eligibility` as it is read (ADR-0007).
 */
export async function publicItems(
  db: Database,
  filter: { area?: string; topic?: string; query?: string; kinds?: ContentKind[]; limit?: number } = {},
): Promise<PublicItem[]> {
  const words = (filter.query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[%_]/g, ""))
    .filter(Boolean)
    .slice(0, 8);
  const rows = await db
    .select({ item: contentItem, revision })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.publishedRevisionId))
    .where(
      and(
        eq(contentItem.state, "published"),
        filter.area ? eq(contentItem.area, filter.area) : undefined,
        filter.kinds?.length ? inArray(contentItem.kind, filter.kinds) : undefined,
        ...words.map((word) => like(contentItem.searchText, `%${word}%`)),
      ),
    )
    .orderBy(desc(contentItem.publishedAt))
    .limit(filter.topic ? 500 : (filter.limit ?? 50) * 2);
  const candidates = filter.topic ? rows.filter((row) => row.revision.topics.includes(filter.topic as string)) : rows;
  const decided = await eligibilityOf(db, candidates);
  const shown = candidates.filter((row) => decided.get(row.revision.id)?.eligible).slice(0, filter.limit ?? 50);
  const approvals = shown.length
    ? await db
        .select()
        .from(review)
        .where(
          and(
            inArray(
              review.revisionId,
              shown.map((row) => row.revision.id),
            ),
            eq(review.decision, "approved"),
          ),
        )
    : [];
  return shown.map((row) => ({ ...row, approvals: approvals.filter((a) => a.revisionId === row.revision.id) }));
}

/** One public item by its address: shown, gone (it was public once), or never there. */
export async function findPublicItem(
  db: Database,
  place: string,
  slug: string,
): Promise<({ kind: "shown" } & PublicItem) | { kind: "gone" } | { kind: "missing" }> {
  const item = await db.query.contentItem.findFirst({
    where: and(eq(contentItem.area, place), eq(contentItem.slug, slug)),
  });
  if (!item) return { kind: "missing" };
  if (item.state !== "published" || !item.publishedRevisionId)
    return item.publishedAt ? { kind: "gone" } : { kind: "missing" };
  const rev = await db.query.revision.findFirst({ where: eq(revision.id, item.publishedRevisionId) });
  if (!rev) return { kind: "missing" };
  const decided = (await eligibilityOf(db, [{ item, revision: rev }])).get(rev.id);
  if (!decided?.eligible) return { kind: "gone" };
  const approvals = await db
    .select()
    .from(review)
    .where(and(eq(review.revisionId, rev.id), eq(review.decision, "approved")));
  return { kind: "shown", item, revision: rev, approvals };
}

/** Published items by ID that are eligible now, for embeds, samples and media delivery. */
export async function publicItemsById(db: Database, ids: string[]) {
  if (!ids.length) return new Map<string, PublicItem>();
  const rows = await db
    .select({ item: contentItem, revision })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.publishedRevisionId))
    .where(and(inArray(contentItem.id, ids), eq(contentItem.state, "published")));
  const decided = await eligibilityOf(db, rows);
  return new Map(
    rows.filter((row) => decided.get(row.revision.id)?.eligible).map((row) => [row.item.id, { ...row, approvals: [] }]),
  );
}
