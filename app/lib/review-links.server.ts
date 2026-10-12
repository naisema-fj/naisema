import { and, count, desc, eq, isNull, max } from "drizzle-orm";
import { reviewLink, reviewLinkAccess, user } from "~db/schema";
import { issueToken, tokenHashOf } from "./access-links";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import type { LayerReview } from "./layer-review.server";
import { reviewLinkExpiry, reviewLinkState } from "./layer-review-rules";
import { type Actor, can } from "./permissions";
import { type Review, type ReviewActionResult, refuse } from "./review.server";
import { rightsFactsFor } from "./rights.server";
import { isPublishable } from "./rights-rules";

/**
 * Review Links (ADR-0003, GOV-03): an editor shares one exact Revision, of a Learning Layer or of a
 * Content Item (an article, Episode, Video…), with someone without a staff account, such as a Knowledge Holder. A link is view-only, needs no sign-in, lasts
 * 14 days and can be revoked, and every opening is logged. Its token, and how it is kept, are every
 * access link's (app/lib/access-links.ts).
 */

/** The address a Review Link opens, on the public site. */
export const reviewLinkPath = (token: string) => `/review/${token}`;

/** The Review Link with this token, whatever its state, or null. */
async function findReviewLink(db: Database, token: string) {
  const tokenHash = await tokenHashOf(token);
  if (!tokenHash) return null;
  return (await db.select().from(reviewLink).where(eq(reviewLink.tokenHash, tokenHash)).get()) ?? null;
}

/** What a Review Link shows: a Learning Layer Revision, or a Content Item Revision. */
export type LinkSubject = "learningLayer" | "contentItem";

/** The Review Link column that holds each kind of Revision. */
const SUBJECT_COLUMNS = {
  learningLayer: { column: reviewLink.revisionId, key: "revisionId" },
  contentItem: { column: reviewLink.contentRevisionId, key: "contentRevisionId" },
} as const;

type Issued = { ok: true; token: string; recipient: string } | { ok: false; error: string };

/** Checks who may issue and what for, then stores the link; the token comes back once, to show. */
async function issueLink(
  db: Database,
  actor: Actor,
  subject: LinkSubject,
  target: { revisionId: string; archived: boolean; isLatestDraft: boolean; submitted: boolean; what: string },
  recipient: string,
): Promise<Issued> {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!can(actor, { action: "reviewLink.issue" })) return fail("Only editors can issue Review Links.");
  if (target.archived) return fail(`Archived ${target.what}s can't be shared.`);
  if (!target.isLatestDraft) return fail("Only the latest revision can be shared for review.");
  if (!target.submitted) return fail("Submit this revision for review before sharing it.");
  const name = recipient.trim().slice(0, 200);
  if (!name) return fail("Say who the Review Link is for.");
  const id = crypto.randomUUID();
  const { token, tokenHash } = await issueToken();
  const now = new Date();
  await db.batch([
    db.insert(reviewLink).values({
      id,
      [SUBJECT_COLUMNS[subject].key]: target.revisionId,
      tokenHash,
      recipient: name,
      createdBy: actor.userId,
      createdAt: now,
      expiresAt: reviewLinkExpiry(now),
    }),
    auditInsert(db, {
      actorId: actor.userId,
      action: "review_link.issued",
      objectType: "review_link",
      objectId: id,
      details: { revisionId: target.revisionId, recipient: name },
    }),
  ]);
  return { ok: true, token, recipient: name };
}

/**
 * An editor issues a Review Link to the latest Learning Layer Revision once it is submitted; the
 * token comes back once, to show, with the name it was stored under.
 */
export const issueReviewLink = (db: Database, actor: Actor, review: LayerReview, recipient: string) =>
  issueLink(
    db,
    actor,
    "learningLayer",
    {
      revisionId: review.revisionId,
      archived: review.layer.publicationState === "archived",
      isLatestDraft: review.layer.currentDraftRevisionId === review.revisionId,
      submitted: review.submitted,
      what: "Learning Layer",
    },
    recipient,
  );

/** The same for a Content Item Revision. */
export const issueContentReviewLink = (db: Database, actor: Actor, review: Review, recipient: string) =>
  issueLink(
    db,
    actor,
    "contentItem",
    {
      revisionId: review.revisionId,
      archived: review.contentItem.publicationState === "archived",
      isLatestDraft: review.contentItem.currentDraftRevisionId === review.revisionId,
      submitted: review.submitted,
      what: "item",
    },
    recipient,
  );

/** An editor revokes a Review Link to this Revision; it stops working at once. */
export async function revokeReviewLink(
  db: Database,
  actor: Actor,
  review: { revisionId: string },
  linkId: string,
  subject: LinkSubject = "learningLayer",
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "reviewLink.issue" })) return refuse("Only editors can revoke Review Links.");
  const link = await db.select().from(reviewLink).where(eq(reviewLink.id, linkId)).get();
  if (link?.[SUBJECT_COLUMNS[subject].key] !== review.revisionId)
    return refuse("That Review Link isn't for this revision.");
  if (link.revokedAt) return refuse("That Review Link is already revoked.");
  await db.batch([
    db
      .update(reviewLink)
      .set({ revokedAt: new Date(), revokedBy: actor.userId })
      .where(and(eq(reviewLink.id, linkId), isNull(reviewLink.revokedAt))),
    auditInsert(db, {
      actorId: actor.userId,
      action: "review_link.revoked",
      objectType: "review_link",
      objectId: linkId,
    }),
  ]);
  return { ok: true };
}

const logAccess = (db: Database, linkId: string, outcome: string, now: Date) =>
  db.insert(reviewLinkAccess).values({ id: crypto.randomUUID(), reviewLinkId: linkId, outcome, accessedAt: now });

/**
 * Opens a Review Link by its token, logging the opening whether or not it still works: "viewed",
 * "expired" or "revoked". Returns the link, or why it doesn't open.
 */
export async function openReviewLink(db: Database, token: string, now = new Date()) {
  const link = await findReviewLink(db, token);
  if (!link) return { ok: false as const, reason: "unknown" as const };
  const state = reviewLinkState(link, now);
  await logAccess(db, link.id, state === "active" ? "viewed" : state, now);
  if (state !== "active") return { ok: false as const, reason: state };
  return { ok: true as const, link };
}

/**
 * The active Review Link for playing its video, logging the start of each play ("played"): the
 * first request of a play, not every range a player asks for after it. A link that no longer works
 * is logged too.
 */
export async function reviewLinkForPlayback(db: Database, token: string, startsPlay: boolean, now = new Date()) {
  const link = await findReviewLink(db, token);
  if (!link) return null;
  const state = reviewLinkState(link, now);
  if (startsPlay || state !== "active") await logAccess(db, link.id, state === "active" ? "played" : state, now);
  return state === "active" ? link : null;
}

/**
 * Whether the Video has a current Rights Record granting Publish, as a whole. Without one, sharing
 * its footage through a Review Link is the editor's call, and the page says so before they share.
 */
export async function videoHasPublishRights(db: Database, contentItemId: string, now = new Date()) {
  const whole = (await rightsFactsFor(db, { type: "content_item", id: contentItemId })).filter(
    (record) => !record.part,
  );
  return isPublishable(whole, now);
}

/** The Review Links to a Revision, newest first, with their state and how often they were opened. */
export async function reviewLinksFor(
  db: Database,
  revisionId: string,
  now = new Date(),
  subject: LinkSubject = "learningLayer",
) {
  const rows = await db
    .select({
      link: reviewLink,
      issuedBy: user.email,
      views: count(reviewLinkAccess.id),
      lastViewedAt: max(reviewLinkAccess.accessedAt),
    })
    .from(reviewLink)
    .leftJoin(user, eq(user.id, reviewLink.createdBy))
    .leftJoin(
      reviewLinkAccess,
      and(eq(reviewLinkAccess.reviewLinkId, reviewLink.id), eq(reviewLinkAccess.outcome, "viewed")),
    )
    .where(eq(SUBJECT_COLUMNS[subject].column, revisionId))
    .groupBy(reviewLink.id)
    .orderBy(desc(reviewLink.createdAt));
  return rows.map(({ link, issuedBy, views, lastViewedAt }) => ({
    id: link.id,
    recipient: link.recipient,
    issuedBy: issuedBy ?? "a former staff member",
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    state: reviewLinkState(link, now),
    views,
    lastViewedAt: lastViewedAt === null ? null : new Date(lastViewedAt),
  }));
}
