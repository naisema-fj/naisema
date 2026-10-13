import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
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
import { fijiToday } from "./calendar";
import { readableKinds } from "./cases.server";
import type { Database } from "./db.server";
import { layerReviewQueue } from "./layer-review.server";
import { logError } from "./log.server";
import { type Actor, can } from "./permissions";
import { layerQueues } from "./publication.server";
import { contentReviewQueue, loadReview } from "./review.server";
import { requirementName } from "./review-names";
import { backupLine, dueCounts, longestWaitText } from "./staff-dashboard";
import { revisionEligibility } from "./visibility.server";

/**
 * What needs each person's attention (#56): counts of the work waiting for the roles they hold,
 * each with a link to where it is done. Only counts and waits are shown, never what a Case or
 * Submission says. The rules for wording are app/lib/staff-dashboard.ts.
 *
 * Each section is read on its own and in parallel, so a failure in one is shown as that section
 * being unavailable rather than taking the whole staff home down.
 */

export type AttentionItem = { key: string; count: number; label: string; detail: string | null; href: string };
export type StatusLine = { key: string; label: string; text: string; ok: boolean; href: string };
type Section = { attention?: AttentionItem[]; status?: StatusLine[] };

const item = (found: Omit<AttentionItem, "detail"> & { detail?: string | null }): AttentionItem => ({
  detail: null,
  ...found,
});

/** A submitted revision still waiting on reviews, and since when. */
export type WaitingRevision = { id: string; number: number; title: string; since: Date; waitingFor: string[] };

/** The most Content Items whose publishing state is worked out for the dashboard; the oldest first. */
const CONTENT_LIMIT = 60;

/**
 * Submitted drafts of Content Items that are not yet approved (waiting on a review, or sent back by
 * one), and those ready to publish. Oldest first, so a long list drops the newest, not the longest-waiting.
 */
export async function contentQueues(db: Database, now: Date) {
  const rows = await db
    .select({
      id: contentItem.id,
      revisionId: contentItem.currentDraftRevisionId,
      number: revision.number,
      snapshot: revision.snapshot,
      state: contentItem.publicationState,
      publishedId: contentItem.currentPublishedRevisionId,
      submittedAt: revisionSubmission.submittedAt,
    })
    .from(contentItem)
    .innerJoin(revisionSubmission, eq(revisionSubmission.revisionId, contentItem.currentDraftRevisionId))
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(ne(contentItem.publicationState, "archived"))
    .orderBy(asc(revisionSubmission.submittedAt))
    .limit(CONTENT_LIMIT + 1);
  const notApproved: WaitingRevision[] = [];
  let readyToPublish = 0;
  for (const row of rows.slice(0, CONTENT_LIMIT)) {
    const review = row.revisionId ? await loadReview(db, row.revisionId) : null;
    if (!review) continue;
    const missing = review.progress.filter((entry) => entry.status !== "approved");
    if (missing.length) {
      notApproved.push({
        id: row.id,
        number: row.number,
        title: (row.snapshot as { title?: string }).title ?? "Untitled",
        since: row.submittedAt,
        waitingFor: missing.map((entry) => requirementName(entry.requirement)),
      });
    } else if (!(row.state === "published" && row.publishedId === row.revisionId)) {
      if ((await revisionEligibility(db, review, now)).eligible) readyToPublish++;
    }
  }
  return { notApproved, readyToPublish, capped: rows.length > CONTENT_LIMIT };
}

/** When one Content Item or Learning Layer revision was submitted; null if it never was. */
export async function submittedAt(db: Database, kind: "contentItem" | "learningLayer", id: string, number: number) {
  const found =
    kind === "contentItem"
      ? await db
          .select({ at: revisionSubmission.submittedAt })
          .from(revisionSubmission)
          .innerJoin(revision, eq(revision.id, revisionSubmission.revisionId))
          .where(and(eq(revision.contentItemId, id), eq(revision.number, number)))
          .get()
      : await db
          .select({ at: learningLayerSubmission.submittedAt })
          .from(learningLayerSubmission)
          .innerJoin(learningLayerRevision, eq(learningLayerRevision.id, learningLayerSubmission.revisionId))
          .where(and(eq(learningLayerRevision.learningLayerId, id), eq(learningLayerRevision.number, number)))
          .get();
  return found?.at ?? null;
}

/** When each queued Content Item or Learning Layer revision was submitted. */
async function submittedTimes(
  db: Database,
  entries: { id: string; number: number }[],
  kind: "contentItem" | "learningLayer",
) {
  const times = await Promise.all(entries.map((entry) => submittedAt(db, kind, entry.id, entry.number)));
  return times.filter((time): time is Date => time !== null);
}

async function myReviews(db: Database, actor: Actor, now: Date): Promise<Section> {
  const [items, layers] = await Promise.all([contentReviewQueue(db, actor.userId), layerReviewQueue(db, actor.userId)]);
  const times = [
    ...(await submittedTimes(db, items, "contentItem")),
    ...(await submittedTimes(db, layers, "learningLayer")),
  ];
  return {
    attention: [
      item({
        key: "my-reviews",
        count: items.length + layers.length,
        label: "waiting for your review",
        detail: longestWaitText(times, now),
        href: "/admin/reviews",
      }),
    ],
  };
}

async function editorQueues(db: Database, now: Date): Promise<Section> {
  const [content, layers] = await Promise.all([contentQueues(db, now), layerQueues(db, now)]);
  const more = content.capped ? ` Only the ${CONTENT_LIMIT} longest-waiting are counted.` : "";
  return {
    attention: [
      item({
        key: "content-not-approved",
        count: content.notApproved.length,
        label: "Content Items submitted and not yet approved",
        detail:
          `${
            longestWaitText(
              content.notApproved.map((entry) => entry.since),
              now,
            ) ?? ""
          }${more}`.trim() || null,
        href: "/admin/articles",
      }),
      item({
        key: "content-ready",
        count: content.readyToPublish,
        label: "Content Items ready to publish",
        detail: more.trim() || null,
        href: "/admin/articles",
      }),
      item({
        key: "layers-not-approved",
        count: layers.missingReview.length,
        label: "Learning Layers submitted and not yet approved",
        href: "/admin/learning-layers",
      }),
      item({
        key: "layers-ready",
        count: layers.readyToPublish.length,
        label: "Learning Layers ready to publish",
        href: "/admin/learning-layers",
      }),
    ],
  };
}

async function failedVideos(db: Database): Promise<Section> {
  const [{ failed }] = await db
    .select({ failed: sql<number>`count(*)` })
    .from(videoAsset)
    .where(eq(videoAsset.state, "failed"));
  return {
    attention: [
      item({ key: "videos-failed", count: failed, label: "Videos that failed processing", href: "/admin/media" }),
    ],
  };
}

async function submissionsDue(db: Database, now: Date): Promise<Section> {
  const open = await db.select({ dueOn: submission.dueOn }).from(submission).where(ne(submission.status, "closed"));
  const due = dueCounts(
    open.map((row) => row.dueOn),
    fijiToday(now),
  );
  return {
    attention: [
      item({
        key: "submissions-overdue",
        count: due.overdue,
        label: "Submissions past their due date",
        href: "/admin/submissions",
      }),
      item({
        key: "submissions-soon",
        count: due.soon,
        label: "Submissions due in the next two days",
        href: "/admin/submissions",
      }),
    ],
  };
}

/** Counts only, and no audit entry: the Case queue records who opened it, and this opens no Case. */
async function casesToTriage(db: Database, actor: Actor, now: Date): Promise<Section> {
  const untriaged = await db
    .select({ receivedAt: caseRecord.receivedAt })
    .from(caseRecord)
    .where(and(inArray(caseRecord.kind, readableKinds(actor)), eq(caseRecord.state, "received")));
  return {
    attention: [
      item({
        key: "cases-untriaged",
        count: untriaged.length,
        label: "Cases not yet triaged",
        detail: longestWaitText(
          untriaged.map((row) => row.receivedAt),
          now,
        ),
        href: "/admin/cases",
      }),
    ],
  };
}

async function monitoring(db: Database): Promise<Section> {
  const problems = await db.select().from(monitorAlert).orderBy(monitorAlert.failingSince);
  return {
    status: [
      {
        key: "monitor",
        label: "Monitoring",
        text: problems.length
          ? `${problems.length} ${problems.length === 1 ? "problem is" : "problems are"} being reported: ${problems.map((problem) => problem.summary).join(" ")}`
          : "No problems are being reported.",
        ok: problems.length === 0,
        href: "/admin/usage",
      },
    ],
  };
}

async function backups(db: Database, now: Date): Promise<Section> {
  // A run still under way has no result yet, so the last one that finished is the one reported.
  const last = await db
    .select({ startedAt: jobRun.startedAt, ok: jobRun.ok })
    .from(jobRun)
    .where(and(eq(jobRun.job, "backup"), isNotNull(jobRun.ok)))
    .orderBy(desc(jobRun.startedAt))
    .limit(1)
    .get();
  const line = backupLine(last ? { startedAt: last.startedAt, ok: last.ok === true } : null, now);
  return { status: [{ key: "backup", label: "Backups", text: line.text, ok: line.ok, href: "/admin/restore" }] };
}

/** What needs this person's attention, and (for administrators) the platform's state. */
export async function staffDashboard(db: Database, actor: Actor, now = new Date()) {
  const allowed = (check: Parameters<typeof can>[1]) => can(actor, check);
  // Each section: whether this person may see it, its name for a failure, and how to read it.
  const sections: [boolean, string, () => Promise<Section>][] = [
    [allowed({ action: "reviewQueue.view" }), "Your reviews", () => myReviews(db, actor, now)],
    [allowed({ action: "content.edit" }), "Content waiting to be reviewed or published", () => editorQueues(db, now)],
    [allowed({ action: "media.upload" }), "Videos", () => failedVideos(db)],
    [allowed({ action: "submission.manage" }), "Submissions", () => submissionsDue(db, now)],
    [readableKinds(actor).length > 0, "Cases", () => casesToTriage(db, actor, now)],
    [allowed({ action: "usage.read" }), "Monitoring", () => monitoring(db)],
    [allowed({ action: "restore.run" }), "Backups", () => backups(db, now)],
  ];
  const read = await Promise.all(
    sections
      .filter(([shown]) => shown)
      .map(async ([, name, load]) => {
        try {
          return await load();
        } catch (error) {
          logError("A staff dashboard section failed", { section: name, error });
          return {
            status: [
              {
                key: `failed-${name}`,
                label: name,
                text: "This couldn't be checked just now.",
                ok: false,
                href: "/admin",
              },
            ],
          };
        }
      }),
  );
  return {
    attention: read.flatMap((section) => section.attention ?? []).filter((found) => found.count > 0),
    status: read.flatMap((section) => section.status ?? []),
  };
}
