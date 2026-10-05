import { linkExpiry, linkState } from "./access-links";
import { activityProblems, countsForCompletion } from "./activities";
import { annotationProblems, noteProblems } from "./annotations";
import type { LearningLayerSnapshot } from "./learning-layer-fields";
import type { ContentFlag } from "./review-rules";

/**
 * The review and publishing rules particular to Learning Layers (ADR-0001, ADR-0003, VCMS-05/06).
 * The review rules themselves are the Content Items' (review-rules.ts): a Learning Layer always
 * teaches a language, so it always needs language review in its Variety, and a Knowledge Holder's
 * approval when it is flagged as culturally sensitive. Pure, shared by the server and the pages.
 */

/** The Content Flags a Learning Layer can carry itself; teaching a language is always implied. */
export const LAYER_FLAGS = ["sensitiveCultural"] as const satisfies readonly ContentFlag[];
export type LayerFlag = (typeof LAYER_FLAGS)[number];

/** The flags its required reviews follow: language instruction, and whatever it is flagged with. */
export const layerFlags = (snapshot: Pick<LearningLayerSnapshot, "flags">): ContentFlag[] => [
  "languageInstruction",
  ...snapshot.flags,
];

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Why a Learning Layer Revision isn't ready for learners, whatever its reviews say: it has no
 * Segments, text imported as a draft or Segments retimed by an Excerpt change still unchecked,
 * Annotations, notes or Activities that lost their place, or nothing a learner must do, so it
 * could never be completed (decision log 1a-13).
 */
export function layerReadinessProblems(snapshot: LearningLayerSnapshot): string[] {
  const problems: string[] = [];
  const { segments } = snapshot;
  if (!segments.length) problems.push("It has no Segments yet.");
  const drafts = segments.filter((segment) => segment.draft).length;
  if (drafts) {
    problems.push(
      `${counted(drafts, "Segment is an unreviewed draft", "Segments are unreviewed drafts")}. Check ${drafts === 1 ? "its" : "their"} text in the editor.`,
    );
  }
  const retimed = segments.filter((segment) => segment.retimed).length;
  if (retimed) {
    problems.push(
      `${counted(retimed, "Segment was", "Segments were")} retimed. Check ${retimed === 1 ? "its" : "their"} times in the editor.`,
    );
  }
  const lost =
    annotationProblems(snapshot.annotations, segments, new Set(Object.keys(snapshot.expressions))).length +
    noteProblems(snapshot.notes, segments).length;
  if (lost) {
    problems.push(`${counted(lost, "Annotation or note needs", "Annotations or notes need")} checking in the editor.`);
  }
  const unlinked = activityProblems(snapshot.activities, segments).filter((problem) => problem.revalidate).length;
  if (unlinked) problems.push(`${counted(unlinked, "Activity needs", "Activities need")} linking to a Segment again.`);
  if (!snapshot.activities.some(countsForCompletion)) {
    problems.push("No Activity is required, so learners can't complete this Learning Layer.");
  }
  return problems;
}

/** How long a Review Link works for. */
export const REVIEW_LINK_DAYS = 14;

export const reviewLinkExpiry = (now: Date) => linkExpiry(now, REVIEW_LINK_DAYS);

export type ReviewLinkState = "active" | "expired" | "revoked";

/** A Review Link works until it is revoked or reaches its expiry (access-links.ts). */
export function reviewLinkState(link: { expiresAt: Date; revokedAt: Date | null }, now: Date): ReviewLinkState {
  const state = linkState({ expiresAt: link.expiresAt, closedAt: link.revokedAt }, now);
  return state === "closed" ? "revoked" : state;
}
