import { and, asc, eq } from "drizzle-orm";
import { contentItem, learningLayer, revision } from "~db/schema";
import { type ArticleSnapshot, footageOf } from "./article-fields";
import { activeHold } from "./content-holds.server";
import { type ContentKindName, contentKind, kindOf } from "./content-kinds";
import type { Database } from "./db.server";
import { episodeRecording } from "./episode-fields";
import { type LayerReview, loadLayerReview } from "./layer-review.server";
import { layerReadinessProblems } from "./layer-review-rules";
import type { LearningLayerSnapshot } from "./learning-layer-fields";
import { readyDownload, readyEpisodeAudio } from "./media-delivery.server";
import { loadReview, type Review } from "./review.server";
import { requirementName } from "./review-names";
import type { ReviewProgress } from "./review-rules";
import { mediaRightsFacts, rightsFactsFor } from "./rights.server";
import {
  assetRightsProblems,
  isPublishable,
  type RightsFacts,
  rightsProblems,
  teachingRightsProblems,
} from "./rights-rules";
import { readyVideo } from "./video-assets.server";
import { videoItem } from "./video-items.server";

/**
 * ADR-0007's one eligibility decision, and everything public that rests on it. Two questions:
 *
 * - May this exact Revision be published right now? (`revisionEligibility`, `layerRevisionEligibility`:
 *   for publishing and the staff pages.) Submitted, every required review approved on it, ready,
 *   footage processed, rights current, and not hidden pending a Case.
 * - Is it public right now? (`publicItem`, `publicFootage`, `publicLayersOn`, `publicLayer`: for
 *   everything a visitor can reach.) Published, and its published Revision eligible; a Learning
 *   Layer also needs its Video public.
 *
 * Every answer is worked out at the moment it is asked, so a rights lapse or a Case hold takes
 * effect on the next request with nothing to unpublish. A refusal says why in typed reasons; the
 * staff pages show their words, and code sorts them by kind, never by their wording.
 */

/** What kind of thing stands in the way, so callers can sort reasons without reading them. */
export type ReasonKind =
  /** The Revision, or the Video a Learning Layer is on, isn't there. */
  | "missing"
  /** Hidden while a Case about it is reviewed. */
  | "held"
  | "unsubmitted"
  /** A required review is still needed, or was rejected. */
  | "review"
  /** Something in the content itself, such as a draft Segment or a missing transcript. */
  | "readiness"
  /** Its footage, audio or file isn't ready to serve. */
  | "media"
  | "rights";

export type Reason = { kind: ReasonKind; text: string };

export type Eligibility = { eligible: true } | { eligible: false; reasons: Reason[] };

/** The words of a refusal's reasons, as the staff pages and audit records give them. */
export const reasonTexts = (eligibility: Eligibility) =>
  eligibility.eligible ? [] : eligibility.reasons.map((reason) => reason.text);

/** An answer as a staff page shows it: eligible, or why not, in words. */
export const forStaff = (eligibility: Eligibility) =>
  eligibility.eligible ? { eligible: true as const } : { eligible: false as const, reasons: reasonTexts(eligibility) };

const decided = (reasons: Reason[]): Eligibility =>
  reasons.length ? { eligible: false, reasons } : { eligible: true };
const each = (kind: ReasonKind, texts: string[]) => texts.map((text): Reason => ({ kind, text }));

/** Reviews still needed, or rejected, on a Revision. */
const reviewReasons = (progress: ReviewProgress[]) =>
  progress.flatMap(({ requirement, status }): Reason[] => {
    if (status === "approved") return [];
    const name = requirementName(requirement);
    return [{ kind: "review", text: status === "rejected" ? `${name} was rejected.` : `${name} is still needed.` }];
  });

const UNSUBMITTED: Reason = { kind: "unsubmitted", text: "It hasn't been submitted for review." };
const MISSING: Eligibility = { eligible: false, reasons: [{ kind: "missing", text: "That revision doesn't exist." }] };

// --- May this Revision be published right now? ---

/**
 * For a Content Item Revision: it must have been submitted, every review its Content Flags require
 * must be approved on it, and its rights must be current at this moment: a current Rights Record
 * granting Publish, plus current guardian permission when it shows identifiable children. Each
 * media library file it uses needs a current Rights Record of its own too; the item's record
 * covers its words and anything from other sites. Its footage, file or audio must be ready, an
 * Episode needs its transcript, and a Creator Profile its free sample public. An item hidden
 * pending a Case's review is never eligible.
 */
export async function revisionEligibility(db: Database, review: Review, now = new Date()): Promise<Eligibility> {
  const reasons: Reason[] = [];
  if (await activeHold(db, review.contentItem.id)) {
    reasons.push({
      kind: "held",
      text: "It is hidden while a Case about it is reviewed. The safeguarding lead can show it again.",
    });
  }
  if (!review.submitted) reasons.push(UNSUBMITTED);
  const { content } = review;
  const footage = footageOf(content);
  if (footage && !(await readyVideo(db, footage))) {
    reasons.push({ kind: "media", text: "Its video hasn't finished processing." });
  }
  reasons.push(...reviewReasons(review.progress));
  reasons.push(...(await KIND_READINESS[kindOf(content)](db, content, now)));
  reasons.push(
    ...each(
      "rights",
      rightsProblems({
        records: await rightsFactsFor(db, { type: "content_item", id: review.contentItem.id }),
        needsGuardianPermission: review.flags.includes("identifiableChildren"),
        // Only parts this Revision lists can be held up by their own records.
        parts: contentKind(content).rightsParts(content),
        now,
      }),
    ),
  );
  reasons.push(...each("rights", assetRightsProblems(await mediaRightsFacts(db, review.mediaAssetIds), now)));
  return decided(reasons);
}

/**
 * What each kind of Content Item needs of its own before it can be public (content-kinds.ts): a
 * Resource's file must be a scanned PDF or audio file; an Episode needs its transcript, and its
 * audio, if that is what it plays, a scanned MP3 or M4A; a Creator Profile needs its free sample
 * public. Footage, which a Video and a video Episode play, is checked for every kind.
 */
const KIND_READINESS: Record<
  ContentKindName,
  (db: Database, content: ArticleSnapshot, now: Date) => Promise<Reason[]>
> = {
  text: async () => [],
  video: async () => [],
  resource: async (db, { resource }) =>
    resource?.source.kind === "file" && !(await readyDownload(db, resource.source.assetId))
      ? [
          {
            kind: "media",
            text: "Its file isn't in the media library as a PDF or audio file that has passed its virus scan.",
          },
        ]
      : [],
  episode: async (db, { episode }) => {
    if (!episode) return [];
    const reasons: Reason[] = [];
    const recording = episodeRecording(episode);
    if (recording.kind === "audio" && !(await readyEpisodeAudio(db, recording.assetId))) {
      reasons.push({
        kind: "media",
        text: "Its audio isn't in the media library as an MP3 or M4A file that has passed its virus scan.",
      });
    }
    if (episode.transcript.trim() === "") {
      reasons.push({
        kind: "readiness",
        text: "It has no transcript yet. Every Episode is published with a reviewed transcript.",
      });
    }
    return reasons;
  },
  // A Creator Profile's sample can't itself be a Creator Profile, so this never recurses further.
  creator: async (db, { creator }, now) =>
    creator && !(await publicItem(db, creator.sampleItemId, now))
      ? [{ kind: "readiness", text: "Its free sample isn't published right now." }]
      : [],
};

/** `revisionEligibility` for a Content Item Revision found by its ID. */
export async function isEligible(db: Database, revisionId: string, now = new Date()): Promise<Eligibility> {
  const review = await loadReview(db, revisionId);
  return review ? revisionEligibility(db, review, now) : MISSING;
}

type VideoItem = NonNullable<Awaited<ReturnType<typeof videoItem>>>;

/**
 * For a Learning Layer Revision: it must be submitted with every required review approved and be
 * ready for learners; its Video's footage must have finished processing and have its own current
 * Publish grant; the Video's rights must grant Publish and the teaching uses (and Excerpt when it is
 * on one); and a Video flagged as culturally sensitive needs the Learning Layer flagged too, so a
 * Knowledge Holder sees it. A Learning Layer on a Video hidden pending a Case is never eligible. It
 * doesn't need its Video published to be published itself; to be public, it does (`publicLayer`).
 */
export async function layerRevisionEligibility(
  db: Database,
  review: LayerReview,
  now = new Date(),
  /** Its Video, when the caller has already loaded it. */
  loaded?: VideoItem | null,
): Promise<Eligibility> {
  const video = loaded === undefined ? await videoItem(db, review.layer.contentItemId) : loaded;
  if (!video)
    return { eligible: false, reasons: [{ kind: "missing", text: "Its Video no longer shows a Video Asset." }] };
  const reasons: Reason[] = [];
  if (await activeHold(db, video.id)) {
    reasons.push({
      kind: "held",
      text: "Its Video is hidden while a Case about it is reviewed. The safeguarding lead can show it again.",
    });
  }
  if (!review.submitted) reasons.push(UNSUBMITTED);
  reasons.push(...reviewReasons(review.progress));
  reasons.push(...each("readiness", layerReadinessProblems(review.snapshot)));
  if (video.video.state === "failed") {
    reasons.push({
      kind: "media",
      text: `Its video failed processing: ${video.video.stateReason ?? "no reason was given."}`,
    });
  } else if (video.video.state !== "ready") {
    reasons.push({ kind: "media", text: "Its video hasn't finished processing." });
  }
  if (video.flags.includes("sensitiveCultural") && !review.flags.includes("sensitiveCultural")) {
    reasons.push({
      kind: "readiness",
      text: "Its Video is marked culturally sensitive, so the Learning Layer needs a Knowledge Holder's approval too. Tick Culturally sensitive in its editor.",
    });
  }
  reasons.push(
    ...each(
      "rights",
      teachingRightsProblems({
        records: await rightsFactsFor(db, { type: "content_item", id: video.id }),
        excerpt: review.snapshot.excerpt !== null,
        needsGuardianPermission: video.flags.includes("identifiableChildren"),
        now,
      }),
    ),
    ...each("rights", assetRightsProblems(await mediaRightsFacts(db, [video.video.id]), now)),
  );
  return decided(reasons);
}

/** `layerRevisionEligibility` for a Learning Layer Revision found by its ID. */
export async function isLayerEligible(db: Database, revisionId: string, now = new Date()): Promise<Eligibility> {
  const review = await loadLayerReview(db, revisionId);
  return review ? layerRevisionEligibility(db, review, now) : MISSING;
}

// --- Is it public right now? ---

type ItemRow = typeof contentItem.$inferSelect;

/** A Content Item public right now, with its published Revision's review and snapshot. */
export type PublicItem = { item: ItemRow; review: Review; snapshot: ArticleSnapshot };

/**
 * The Content Item, by ID or as a row already read, if it is public right now: published, and its
 * published Revision eligible. Public code asks this, never `revisionEligibility` alone, which
 * leaves out the publication state because publishing itself asks it.
 */
export async function publicItem(
  db: Database,
  itemOrId: ItemRow | string,
  now = new Date(),
): Promise<PublicItem | null> {
  const item =
    typeof itemOrId === "string"
      ? await db.select().from(contentItem).where(eq(contentItem.id, itemOrId)).get()
      : itemOrId;
  if (item?.publicationState !== "published" || !item.currentPublishedRevisionId) return null;
  const review = await loadReview(db, item.currentPublishedRevisionId);
  if (!review || !(await revisionEligibility(db, review, now)).eligible) return null;
  const row = await db.select().from(revision).where(eq(revision.id, item.currentPublishedRevisionId)).get();
  return row ? { item, review, snapshot: row.snapshot as ArticleSnapshot } : null;
}

/** A public item that plays footage (a Video, or a video Episode), with that footage ready. */
export type PublicFootage = PublicItem & { asset: NonNullable<Awaited<ReturnType<typeof readyVideo>>> };

/**
 * The item's footage, if it is public right now and plays footage that is ready. Pass an item
 * already found public in this request to use that decision rather than make it again.
 */
export async function publicFootage(
  db: Database,
  itemOrId: PublicItem | string,
  now = new Date(),
): Promise<PublicFootage | null> {
  const found = typeof itemOrId === "string" ? await publicItem(db, itemOrId, now) : itemOrId;
  const assetId = found ? footageOf(found.snapshot) : null;
  const asset = found && assetId ? await readyVideo(db, assetId) : undefined;
  return found && asset ? { ...found, asset } : null;
}

/** A Learning Layer public right now, with its published Revision and the public Video it is on. */
export type PublicLayer = {
  id: string;
  revisionId: string;
  snapshot: LearningLayerSnapshot;
  languageVariety: string;
  video: PublicFootage;
};

/**
 * The Learning Layers public on a Video right now: published, and their published Revision
 * eligible. Asked only of a Video already found public, with its footage ready (#28's serving
 * rule), so the Video's own decision is never made twice.
 */
export async function publicLayersOn(db: Database, video: PublicFootage, now = new Date()): Promise<PublicLayer[]> {
  const rows = await db
    .select({ id: learningLayer.id, revisionId: learningLayer.currentPublishedRevisionId })
    .from(learningLayer)
    .where(and(eq(learningLayer.contentItemId, video.item.id), eq(learningLayer.publicationState, "published")))
    .orderBy(asc(learningLayer.createdAt));
  const shown = await Promise.all(
    rows.map(async ({ id, revisionId }): Promise<PublicLayer | null> => {
      if (!revisionId) return null;
      const review = await loadLayerReview(db, revisionId);
      if (!review || !(await layerRevisionEligibility(db, review, now)).eligible) return null;
      return { id, revisionId, snapshot: review.snapshot, languageVariety: review.layer.languageVariety, video };
    }),
  );
  return shown.filter((layer) => layer !== null);
}

/** A Learning Layer by its ID, if it is public right now: on a public Video, and itself public. */
export async function publicLayer(db: Database, learningLayerId: string, now = new Date()) {
  const layer = await db.select().from(learningLayer).where(eq(learningLayer.id, learningLayerId)).get();
  const video = layer ? await publicFootage(db, layer.contentItemId, now) : null;
  if (!video) return null;
  return (await publicLayersOn(db, video, now)).find((candidate) => candidate.id === learningLayerId) ?? null;
}

// --- May a Review Link play footage? ---

/** Records that lapsed by withdrawal: a Publish grant was withdrawn and none is current. */
const withdrawn = (records: RightsFacts[], now: Date) =>
  records.some((record) => record.withdrawnAt && record.permittedUses.includes("publish")) &&
  !isPublishable(records, now);

/**
 * Whether a Review Link may play its Video's footage now. A Review Link often comes before every
 * right is recorded, so missing rights don't stop it; but footage whose Publish grant was withdrawn,
 * on the Video or the file, or a Video hidden pending a Case, never plays to anyone outside.
 */
export async function reviewLinkMayPlay(db: Database, video: { id: string; video: { id: string } }, now = new Date()) {
  if (await activeHold(db, video.id)) return false;
  const whole = (await rightsFactsFor(db, { type: "content_item", id: video.id })).filter((record) => !record.part);
  const [file] = await mediaRightsFacts(db, [video.video.id]);
  return !withdrawn(whole, now) && !withdrawn(file?.records ?? [], now);
}
