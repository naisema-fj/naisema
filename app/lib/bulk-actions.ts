import { REVIEW_TYPES, type ReviewType } from "./permissions";

/**
 * Bulk actions on content lists and queues (BO-07): what an editor's selection means. Each chosen
 * item is then checked and changed on its own (app/lib/bulk-actions.server.ts). Publishing is not
 * here: each Revision needs its own eligibility check, so it stays one at a time.
 */

export type BulkKind = "content" | "layer";
export type BulkAction = "assign" | "withdraw" | "archive";

/** The most items one step takes, so a single request stays quick and its result stays readable. */
export const MAX_BULK = 50;
export const BULK_REASON_LIMIT = 500;

export type BulkRequest =
  | { kind: BulkKind; action: "assign"; ids: string[]; reviewType: ReviewType; reviewerId: string }
  | { kind: BulkKind; action: "withdraw" | "archive"; ids: string[]; reason: string };

export type BulkRead = { ok: true; request: BulkRequest } | { ok: false; error: string };

export const BULK_KIND_NAMES: Record<BulkKind, { one: string; many: string }> = {
  content: { one: "Content Item", many: "Content Items" },
  layer: { one: "Learning Layer", many: "Learning Layers" },
};

const isKind = (value: string): value is BulkKind => value === "content" || value === "layer";

const refusal = (error: string): BulkRead => ({ ok: false, error });

/** Reads the bulk form: the kind of item, the chosen IDs (once each), the action and what it needs. */
export function readBulkForm(form: FormData): BulkRead {
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const kind = field("kind");
  if (!isKind(kind)) return refusal("That kind of item isn't available for bulk actions.");
  const intent = field("intent");
  if (intent === "publish") return refusal("Publishing can't be done in bulk. Publish each revision on its own page.");
  if (intent !== "assign" && intent !== "withdraw" && intent !== "archive") {
    return refusal("That action isn't available.");
  }
  const ids = [
    ...new Set(
      form
        .getAll("id")
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  ];
  if (!ids.length) return refusal("Choose at least one item.");
  if (ids.length > MAX_BULK) return refusal(`Choose at most ${MAX_BULK} items at a time.`);

  if (intent === "assign") {
    const [reviewType, ...rest] = field("reviewer").split(":");
    const reviewerId = rest.join(":");
    if (!(REVIEW_TYPES as readonly string[]).includes(reviewType) || !reviewerId) {
      return refusal("Choose a reviewer.");
    }
    return { ok: true, request: { kind, action: "assign", ids, reviewType: reviewType as ReviewType, reviewerId } };
  }
  const reason = field("reason");
  if (!reason) return refusal("Say why. One reason is kept in the audit log for every item.");
  if (reason.length > BULK_REASON_LIMIT) {
    return refusal(`The reason can be at most ${BULK_REASON_LIMIT} characters.`);
  }
  return { ok: true, request: { kind, action: intent, ids, reason } };
}

/** What happened to one chosen item: done, or skipped with the reason. */
export type BulkOutcome = { id: string; title: string; ok: boolean; text: string };

const PAST: Record<BulkAction, string> = {
  assign: "Assigned the reviewer to",
  withdraw: "Withdrew",
  archive: "Archived",
};

/** One sentence for the result page: how many were done out of how many chosen, and how many skipped. */
export function summarise(action: BulkAction, kind: BulkKind, outcomes: BulkOutcome[]) {
  const total = outcomes.length;
  const done = outcomes.filter((outcome) => outcome.ok).length;
  const skipped = total - done;
  const noun = BULK_KIND_NAMES[kind][total === 1 ? "one" : "many"];
  const head =
    done === 0 && action === "assign"
      ? `The reviewer was not assigned to any of the ${total} ${noun}.`
      : done === 0
        ? `Nothing was ${action === "withdraw" ? "withdrawn" : "archived"}: none of the ${total} ${noun} could be.`
        : `${PAST[action]} ${done} of ${total} ${noun}.`;
  return skipped ? `${head} ${skipped} ${skipped === 1 ? "was" : "were"} skipped.` : head;
}
