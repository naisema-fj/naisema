import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  caseRecord,
  contentItem,
  jobRun,
  learningLayerRevision,
  learningLayerSubmission,
  monitorAlert,
  revision,
  revisionSubmission,
  submission,
  videoAsset,
} from "~db/schema";
import { CASE_KINDS } from "./case-rules";
import type { Database } from "./db.server";
import { layerReviewQueue } from "./layer-review.server";
import { type Actor, type CaseKind, can } from "./permissions";
import { layerQueues } from "./publication.server";
import { contentReviewQueue, loadReview } from "./review.server";
import { backupLine, dueCounts, waitedText } from "./staff-dashboard";
import { revisionEligibility } from "./visibility.server";

/**
 * What needs each person's attention (#56): counts of the work waiting for the roles they hold,
 * each with a link to where it is done. Only counts and waits are shown, never what a Case or
 * Submission says. The rules for wording are app/lib/staff-dashboard.ts.
 */

export type AttentionItem = { key: string; count: number; label: string; detail: string | null; href: string };
export type StatusLine = { key: string; label: string; text: string; ok: boolean; href: string };

/** The most Content Items whose publishing state is worked out for the dashboard. */
const CONTENT_LIMIT = 60;

/** Submitted drafts of Content Items that are waiting on a review, and those ready to publish. */
async function contentQueues(db: Database, now: Date) {
  const rows = await db
    .select({
      id: contentItem.id,
      revisionId: contentItem.currentDraftRevisionId,
      state: contentItem.publicationState,
      publishedId: contentItem.currentPublishedRevisionId,
      submittedAt: revisionSubmission.submittedAt,
    })
    .from(contentItem)
    .innerJoin(revisionSubmission, eq(revisionSubmission.revisionId, contentItem.currentDraftRevisionId))
    .where(ne(contentItem.publicationState, "archived"))
    .orderBy(desc(revisionSubmission.submittedAt))
    .limit(CONTENT_LIMIT);
  const missingReview: Date[] = [];
  let readyToPublish = 0;
  for (const row of rows) {
    const review = row.revisionId ? await loadReview(db, row.revisionId) : null;
    if (!review) continue;
    if (review.progress.some((item) => item.status !== "approved")) {
      missingReview.push(row.submittedAt);
    } else if (!(row.state === "published" && row.publishedId === row.revisionId)) {
      if ((await revisionEligibility(db, review, now)).eligible) readyToPublish++;
    }
  }
  return { missingReview, readyToPublish };
}

/** When each queued Content Item or Learning Layer revision was submitted, for how long it has waited. */
async function submittedTimes(
  db: Database,
  entries: { id: string; number: number }[],
  kind: "contentItem" | "learningLayer",
) {
  const times: Date[] = [];
  for (const entry of entries) {
    const found =
      kind === "contentItem"
        ? await db
            .select({ at: revisionSubmission.submittedAt })
            .from(revisionSubmission)
            .innerJoin(revision, eq(revision.id, revisionSubmission.revisionId))
            .where(and(eq(revision.contentItemId, entry.id), eq(revision.number, entry.number)))
            .get()
        : await db
            .select({ at: learningLayerSubmission.submittedAt })
            .from(learningLayerSubmission)
            .innerJoin(learningLayerRevision, eq(learningLayerRevision.id, learningLayerSubmission.revisionId))
            .where(
              and(eq(learningLayerRevision.learningLayerId, entry.id), eq(learningLayerRevision.number, entry.number)),
            )
            .get();
    if (found) times.push(found.at);
  }
  return times;
}

const oldest = (times: Date[]) => (times.length ? new Date(Math.min(...times.map((time) => time.getTime()))) : null);

/** What needs this person's attention, and (for administrators) the platform's state. */
export async function staffDashboard(db: Database, actor: Actor, now = new Date()) {
  const attention: AttentionItem[] = [];
  const status: StatusLine[] = [];
  const add = (item: Omit<AttentionItem, "detail"> & { detail?: string | null }) => {
    if (item.count > 0) attention.push({ detail: null, ...item });
  };

  if (can(actor, { action: "reviewQueue.view" })) {
    const [items, layers] = await Promise.all([
      contentReviewQueue(db, actor.userId),
      layerReviewQueue(db, actor.userId),
    ]);
    const since = oldest([
      ...(await submittedTimes(db, items, "contentItem")),
      ...(await submittedTimes(db, layers, "learningLayer")),
    ]);
    add({
      key: "my-reviews",
      count: items.length + layers.length,
      label: "waiting for your review",
      detail: since ? `The longest has been ${waitedText(since, now)}.` : null,
      href: "/admin/reviews",
    });
  }

  if (can(actor, { action: "content.edit" })) {
    const [content, layers] = await Promise.all([contentQueues(db, now), layerQueues(db, now)]);
    const since = oldest(content.missingReview);
    add({
      key: "content-missing-review",
      count: content.missingReview.length,
      label: "Content Items submitted and still waiting on a review",
      detail: since ? `The longest has been ${waitedText(since, now)}.` : null,
      href: "/admin/articles",
    });
    add({
      key: "content-ready",
      count: content.readyToPublish,
      label: "Content Items ready to publish",
      href: "/admin/articles",
    });
    add({
      key: "layers-missing-review",
      count: layers.missingReview.length,
      label: "Learning Layers submitted and still waiting on a review",
      href: "/admin/learning-layers",
    });
    add({
      key: "layers-ready",
      count: layers.readyToPublish.length,
      label: "Learning Layers ready to publish",
      href: "/admin/learning-layers",
    });
  }

  if (can(actor, { action: "media.upload" })) {
    const [{ failed }] = await db
      .select({ failed: sql<number>`count(*)` })
      .from(videoAsset)
      .where(eq(videoAsset.state, "failed"));
    add({ key: "videos-failed", count: failed, label: "Videos that failed processing", href: "/admin/media" });
  }

  if (can(actor, { action: "submission.manage" })) {
    const open = await db.select({ dueOn: submission.dueOn }).from(submission).where(ne(submission.status, "closed"));
    const due = dueCounts(
      open.map((row) => row.dueOn),
      now,
    );
    add({
      key: "submissions-overdue",
      count: due.overdue,
      label: "Submissions past their due date",
      href: "/admin/submissions",
    });
    add({
      key: "submissions-soon",
      count: due.soon,
      label: "Submissions due in the next two days",
      href: "/admin/submissions",
    });
  }

  const kinds = (Object.keys(CASE_KINDS) as CaseKind[]).filter((kind) =>
    can(actor, { action: "case.read", case: { kind } }),
  );
  if (kinds.length) {
    // Counts only, and no audit entry: the Case queue records who opened it, and this opens no Case.
    const untriaged = await db
      .select({ receivedAt: caseRecord.receivedAt })
      .from(caseRecord)
      .where(and(inArray(caseRecord.kind, kinds), eq(caseRecord.state, "received")));
    const since = oldest(untriaged.map((row) => row.receivedAt));
    add({
      key: "cases-untriaged",
      count: untriaged.length,
      label: "Cases not yet triaged",
      detail: since ? `The longest has been ${waitedText(since, now)}.` : null,
      href: "/admin/cases",
    });
  }

  if (can(actor, { action: "usage.read" })) {
    const problems = await db.select().from(monitorAlert).orderBy(monitorAlert.failingSince);
    status.push({
      key: "monitor",
      label: "Monitoring",
      text: problems.length
        ? `${problems.length} ${problems.length === 1 ? "problem is" : "problems are"} being reported: ${problems.map((problem) => problem.summary).join(" ")}`
        : "No problems are being reported.",
      ok: problems.length === 0,
      href: "/admin/usage",
    });
  }
  if (can(actor, { action: "restore.run" })) {
    const last = await db
      .select({ startedAt: jobRun.startedAt, ok: jobRun.ok })
      .from(jobRun)
      .where(eq(jobRun.job, "backup"))
      .orderBy(desc(jobRun.startedAt))
      .limit(1)
      .get();
    const line = backupLine(last ? { startedAt: last.startedAt, ok: last.ok !== false } : null, now);
    status.push({ key: "backup", label: "Backups", text: line.text, ok: line.ok, href: "/admin/restore" });
  }
  return { attention, status };
}
