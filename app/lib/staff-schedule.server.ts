import { and, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { caseRecord, contentItem, mediaAsset, revision, rightsRecord, submission } from "~db/schema";
import { fijiDayEnd, fijiDayStart, fijiToday } from "./calendar";
import { CASE_KINDS } from "./case-rules";
import { readableKinds } from "./cases.server";
import type { Database } from "./db.server";
import { layerReviewQueue } from "./layer-review.server";
import { logError } from "./log.server";
import { type Actor, can, type ReviewType } from "./permissions";
import { layerQueues } from "./publication.server";
import { contentReviewQueue } from "./review.server";
import { REVIEW_NAMES } from "./review-names";
import { formatDay, type RightsSubject, rightsPagePath } from "./rights-rules";
import { contentQueues, submittedAt } from "./staff-dashboard.server";
import { arrangeSchedule, lastDayOf, type ScheduleEntry } from "./staff-schedule";
import { SUBMISSION_TYPES } from "./submission-fields";

/**
 * "What's coming up" (#59): what is due, soonest first, and what has been waiting longest, for the
 * roles a person holds. Each kind is read under the permission of the page that deals with it, and
 * each on its own, so one failing is reported as unavailable without hiding the rest. Entries name
 * the kind of thing and its day or wait, never what a Case or Submission says or who sent it. A
 * Rights Record names its rights holder, as the page that renews it does for the same people.
 */

/** How long after a Rights Record expired it is still listed as overdue. */
const EXPIRED_LISTED_DAYS = 30;

type Source = { name: string; entries: ScheduleEntry[]; limited?: boolean };

async function rightsExpiries(db: Database, now: Date, days: number): Promise<ScheduleEntry[]> {
  const today = fijiToday(now);
  const end = fijiDayEnd(lastDayOf(today, days));
  // A Rights Record that lapsed longer ago than this is no longer a reminder, so it is left off.
  const earliest = fijiDayStart(lastDayOf(today, -EXPIRED_LISTED_DAYS));
  const rows = await db
    .select({ record: rightsRecord, snapshot: revision.snapshot, fileName: mediaAsset.name })
    .from(rightsRecord)
    .leftJoin(
      contentItem,
      and(eq(rightsRecord.subjectType, "content_item"), eq(contentItem.id, rightsRecord.subjectId)),
    )
    .leftJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .leftJoin(mediaAsset, and(eq(rightsRecord.subjectType, "media_asset"), eq(mediaAsset.id, rightsRecord.subjectId)))
    .where(
      and(isNull(rightsRecord.withdrawnAt), gte(rightsRecord.expiresAt, earliest), lte(rightsRecord.expiresAt, end)),
    );
  return rows.map(({ record, snapshot, fileName }) => {
    const expires = record.expiresAt as Date;
    return {
      key: `rights-${record.id}`,
      kind: "rights",
      title: fileName ?? (snapshot as { title?: string } | null)?.title ?? "An item",
      detail: `Rights Record from ${record.rightsHolder} expires on ${formatDay(expires)}`,
      date: fijiToday(expires),
      since: null,
      href: rightsPagePath({ type: record.subjectType as RightsSubject["type"], id: record.subjectId }),
    };
  });
}

async function submissionsDue(db: Database, now: Date, days: number): Promise<ScheduleEntry[]> {
  const rows = await db
    .select({ id: submission.id, type: submission.type, dueOn: submission.dueOn, receivedAt: submission.receivedAt })
    .from(submission)
    .where(and(ne(submission.status, "closed"), lte(submission.dueOn, lastDayOf(fijiToday(now), days))));
  return rows.map((row) => ({
    key: `submission-${row.id}`,
    kind: "submission",
    title: SUBMISSION_TYPES[row.type]?.name ?? "Submission",
    detail: `Received ${formatDay(row.receivedAt)}`,
    date: row.dueOn,
    since: null,
    href: `/admin/submissions/${row.id}`,
  }));
}

/**
 * Cases carry no due date, so they appear by how long they have waited: those not yet triaged, and
 * appeals waiting for a decision. Read directly, not through the Case queue, which audits who opened it.
 */
async function casesWaiting(db: Database, actor: Actor): Promise<ScheduleEntry[]> {
  const rows = await db
    .select({
      id: caseRecord.id,
      kind: caseRecord.kind,
      state: caseRecord.state,
      receivedAt: caseRecord.receivedAt,
      appealedAt: caseRecord.appealedAt,
      appealOutcome: caseRecord.appealOutcome,
    })
    .from(caseRecord)
    .where(and(inArray(caseRecord.kind, readableKinds(actor)), inArray(caseRecord.state, ["received", "appealed"])));
  return rows.flatMap((row): ScheduleEntry[] => {
    const appeal = row.state === "appealed";
    if (appeal && row.appealOutcome) return [];
    return [
      {
        key: `case-${row.id}`,
        kind: "case",
        title: CASE_KINDS[row.kind],
        detail: appeal ? "Appeal waiting for a decision" : "Not yet triaged",
        date: null,
        since: appeal ? (row.appealedAt ?? row.receivedAt) : row.receivedAt,
        href: `/admin/cases/${row.id}`,
      },
    ];
  });
}

/**
 * Revisions waiting on reviews: for an editor, every submitted revision not yet approved (the
 * longest-waiting few, as for the dashboard); for a reviewer, those waiting on them, marked as
 * theirs. A person who is both gets one line, with both wordings.
 */
async function reviewsWaiting(db: Database, actor: Actor, now: Date) {
  const entries = new Map<string, ScheduleEntry>();
  let limited = false;
  const add = (entry: {
    prefix: "content" | "layer";
    id: string;
    number: number;
    title: string;
    detail: string;
    since: Date;
  }) => {
    const key = `${entry.prefix}-${entry.id}-${entry.number}`;
    const held = entries.get(key);
    entries.set(key, {
      key,
      kind: "review",
      title: `${entry.title}, revision ${entry.number}${entry.prefix === "layer" ? " (Learning Layer)" : ""}`,
      detail: held ? `${entry.detail}. ${held.detail}` : entry.detail,
      date: null,
      since: entry.since,
      href:
        entry.prefix === "content"
          ? `/admin/articles/${entry.id}/revisions/${entry.number}`
          : `/admin/learning-layers/${entry.id}/revisions/${entry.number}`,
    });
  };

  if (can(actor, { action: "content.edit" })) {
    const [content, layers] = await Promise.all([contentQueues(db, now), layerQueues(db, now)]);
    limited = content.capped;
    for (const entry of content.notApproved) {
      add({ prefix: "content", ...entry, detail: `Waiting on ${entry.waitingFor.join(", ")}` });
    }
    const times = await Promise.all(
      layers.missingReview.map((entry) => submittedAt(db, "learningLayer", entry.learningLayerId, entry.number)),
    );
    layers.missingReview.forEach((entry, index) => {
      const since = times[index];
      if (since) {
        add({
          prefix: "layer",
          id: entry.learningLayerId,
          number: entry.number,
          title: entry.title,
          detail: `Waiting on ${entry.waitingFor.join(", ")}`,
          since,
        });
      }
    });
  }

  if (can(actor, { action: "reviewQueue.view" })) {
    const [items, layers] = await Promise.all([
      contentReviewQueue(db, actor.userId),
      layerReviewQueue(db, actor.userId),
    ]);
    const yours = (types: string[]) =>
      `Waiting for your ${types.map((type) => REVIEW_NAMES[type as ReviewType].toLowerCase()).join(", ")}`;
    const [itemTimes, layerTimes] = await Promise.all([
      Promise.all(items.map((entry) => submittedAt(db, "contentItem", entry.id, entry.number))),
      Promise.all(layers.map((entry) => submittedAt(db, "learningLayer", entry.id, entry.number))),
    ]);
    items.forEach((entry, index) => {
      const since = itemTimes[index];
      if (since) add({ prefix: "content", ...entry, detail: yours(entry.reviewTypes), since });
    });
    layers.forEach((entry, index) => {
      const since = layerTimes[index];
      if (since) add({ prefix: "layer", ...entry, detail: yours(entry.reviewTypes), since });
    });
  }
  return { entries: [...entries.values()], limited };
}

export async function staffSchedule(db: Database, actor: Actor, now: Date, days: number) {
  const sources: [boolean, string, () => Promise<Omit<Source, "name">>][] = [
    [
      can(actor, { action: "rights.manage" }),
      "Rights Records",
      async () => ({ entries: await rightsExpiries(db, now, days) }),
    ],
    [
      can(actor, { action: "submission.manage" }),
      "Submissions",
      async () => ({ entries: await submissionsDue(db, now, days) }),
    ],
    [readableKinds(actor).length > 0, "Cases", async () => ({ entries: await casesWaiting(db, actor) })],
    [
      can(actor, { action: "content.edit" }) || can(actor, { action: "reviewQueue.view" }),
      "Reviews",
      async () => reviewsWaiting(db, actor, now).then(({ entries, limited }) => ({ entries, limited })),
    ],
  ];
  const read: (Source & { failed: boolean })[] = await Promise.all(
    sources
      .filter(([shown]) => shown)
      .map(async ([, name, load]) => {
        try {
          return { name, ...(await load()), failed: false };
        } catch (error) {
          logError("A schedule source failed", { source: name, error });
          return { name, entries: [], failed: true };
        }
      }),
  );
  const today = fijiToday(now);
  return {
    today,
    ...arrangeSchedule(
      read.flatMap((source) => source.entries),
      today,
      days,
    ),
    unavailable: read.filter((source) => source.failed).map((source) => source.name),
    limited: read.some((source) => source.limited),
  };
}
