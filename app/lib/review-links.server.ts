import { and, count, desc, eq, isNull, max } from "drizzle-orm";
import { reviewLink, reviewLinkAccess, user } from "~db/schema";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import type { LayerReview } from "./layer-review.server";
import { reviewLinkExpiry, reviewLinkState } from "./layer-review-rules";
import { type Actor, can } from "./permissions";
import { type ReviewActionResult, refuse } from "./review.server";
import { rightsFactsFor } from "./rights.server";
import { isPublishable } from "./rights-rules";
import { hashToken, randomToken } from "./signed-tokens.server";

/**
 * Review Links (ADR-0003, GOV-03): an editor shares one exact Learning Layer Revision with someone
 * without a staff account, such as a Knowledge Holder. A link is view-only, needs no sign-in, lasts
 * 14 days and can be revoked, and every opening is logged. Its token is random rather than signed,
 * so it needs no key and is revoked by a row; only a hash of it is kept, so the address is shown once.
 */

/** The address a Review Link opens, on the public site. */
export const reviewLinkPath = (token: string) => `/review/${token}`;

/** A token as `randomToken` makes them: 32 bytes, base64url. Anything else is never looked up. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** The Review Link with this token, whatever its state, or null. */
async function findReviewLink(db: Database, token: string) {
  if (!TOKEN.test(token)) return null;
  return (
    (await db
      .select()
      .from(reviewLink)
      .where(eq(reviewLink.tokenHash, await hashToken(token)))
      .get()) ?? null
  );
}

/**
 * An editor issues a Review Link to the latest Revision once it is submitted; the token comes back
 * once, to show, with the name it was stored under.
 */
export async function issueReviewLink(
  db: Database,
  actor: Actor,
  review: LayerReview,
  recipient: string,
): Promise<{ ok: true; token: string; recipient: string } | { ok: false; error: string }> {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!can(actor, { action: "reviewLink.issue" })) return fail("Only editors can issue Review Links.");
  if (review.layer.publicationState === "archived") return fail("Archived Learning Layers can't be shared.");
  if (review.layer.currentDraftRevisionId !== review.revisionId) {
    return fail("Only the latest revision can be shared for review.");
  }
  if (!review.submitted) return fail("Submit this revision for review before sharing it.");
  const name = recipient.trim().slice(0, 200);
  if (!name) return fail("Say who the Review Link is for.");
  const id = crypto.randomUUID();
  const token = randomToken();
  const now = new Date();
  await db.batch([
    db.insert(reviewLink).values({
      id,
      revisionId: review.revisionId,
      tokenHash: await hashToken(token),
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
      details: { revisionId: review.revisionId, recipient: name },
    }),
  ]);
  return { ok: true, token, recipient: name };
}

/** An editor revokes a Review Link to this Revision; it stops working at once. */
export async function revokeReviewLink(
  db: Database,
  actor: Actor,
  review: LayerReview,
  linkId: string,
): Promise<ReviewActionResult> {
  if (!can(actor, { action: "reviewLink.issue" })) return refuse("Only editors can revoke Review Links.");
  const link = await db.select().from(reviewLink).where(eq(reviewLink.id, linkId)).get();
  if (link?.revisionId !== review.revisionId) return refuse("That Review Link isn't for this revision.");
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
export async function reviewLinksFor(db: Database, revisionId: string, now = new Date()) {
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
    .where(eq(reviewLink.revisionId, revisionId))
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
