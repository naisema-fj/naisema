import { asc, eq, notInArray } from "drizzle-orm";
import {
  auditEvent,
  consentRecord,
  contentItem,
  contributor,
  learningLayerApproval,
  learningLayerReviewAssignment,
  learningLayerSubmission,
  notice,
  reviewApproval,
  reviewAssignment,
  reviewLink,
  reviewLinkAccess,
  revision,
  revisionSubmission,
  rightsRecord,
  rightsRecordContributor,
  slugRedirect,
  submission,
  topic,
} from "~db/schema";
import type { ArticleSnapshot } from "./article-fields";
import { auditInsert } from "./audit.server";
import { bodyHtml } from "./body-html.server";
import { caseSourceForm } from "./case-rules";
import type { Database } from "./db.server";
import { itemPath } from "./item-paths";
import { BUNDLE_FORMAT, BUNDLE_VERSION, learningLayerBundle } from "./learning-layer-bundle.server";
import { type Actor, CASE_HANDLER, type CaseKind, can, type ExportKind } from "./permissions";

/**
 * Bulk exports (CMS-05, VCMS-06, OWN-03): everything NAISEMA holds, in documented JSON
 * (docs/handover/exports.md) that can be read and reused without this code. Each export says what
 * it is (`format`) and which version of that format, is decided by `can` for its kind, and is
 * audited with what it held; contacts also need a stated purpose, recorded as the audit's reason.
 */

export const EXPORT_VERSION = 1;

export const EXPORT_NAMES: Record<ExportKind, string> = {
  content: "Content Items and their Revisions",
  rights: "Rights Records",
  approvals: "Review submissions, assignments, approvals and Review Links",
  learningLayer: "One Learning Layer, complete",
  audit: "The audit log",
  contacts: "Contacts from the public forms",
};

export type ExportRequest = { kind: ExportKind; purpose?: string; learningLayerId?: string };

export type ExportResult =
  | { ok: true; filename: string; document: Record<string, unknown> }
  | { ok: false; status: 400 | 403 | 404; error: string };

/** Runs one export for a staff member: decided, built and audited in that order. */
export async function runExport(db: Database, actor: Actor, request: ExportRequest): Promise<ExportResult> {
  if (!can(actor, { action: "export.run", kind: request.kind })) {
    return { ok: false, status: 403, error: "Your roles don't include this export." };
  }
  const built = await BUILDERS[request.kind](db, request);
  if (!built.ok) return built;
  const exportedAt = new Date();
  await auditInsert(db, {
    actorId: actor.userId,
    action: "export.downloaded",
    objectType: built.object.type,
    objectId: built.object.id,
    details: { kind: request.kind, ...built.counts, ...(built.reason ? { reason: built.reason } : {}) },
  });
  return {
    ok: true,
    filename: `naisema-${built.name}-${exportedAt.toISOString().slice(0, 10)}.json`,
    document: {
      format: built.format,
      version: built.version,
      exportedAt: exportedAt.toISOString(),
      exportedBy: actor.userId,
      ...built.data,
    },
  };
}

/** One export, built: what it is, what the audit records it as, and what it holds. */
type Built = {
  ok: true;
  /** For the file's name. */
  name: string;
  format: string;
  version: number;
  object: { type: string; id: string };
  data: Record<string, unknown>;
  counts: Record<string, number>;
  /** Why it was run, when its kind asks (contacts). */
  reason?: string;
};

type Builder = (db: Database, request: ExportRequest) => Promise<Built | Extract<ExportResult, { ok: false }>>;

/** An export of everything of one kind, in its own `naisema.<kind>` format. */
const whole = (
  kind: ExportKind,
  contents: Pick<Built, "data" | "counts">,
  extra: Partial<Pick<Built, "reason">> = {},
): Built => ({
  ok: true,
  name: kind,
  format: `naisema.${kind}`,
  version: EXPORT_VERSION,
  object: { type: "export", id: kind },
  ...contents,
  ...extra,
});

const BUILDERS: Record<ExportKind, Builder> = {
  content: async (db) => whole("content", await contentExport(db)),
  rights: async (db) => whole("rights", await rightsExport(db)),
  approvals: async (db) => whole("approvals", await approvalsExport(db)),
  audit: async (db) => whole("audit", await auditExport(db)),
  contacts: async (db, request) => {
    const purpose = request.purpose?.trim() ?? "";
    if (purpose.length < 10) {
      return { ok: false, status: 400, error: "Say what the contacts are for, in a sentence, before exporting them." };
    }
    const contents = await contactsExport(db);
    return whole("contacts", { ...contents, data: { purpose, ...contents.data } }, { reason: purpose });
  },
  learningLayer: async (db, { learningLayerId }) => {
    const bundle = learningLayerId ? await learningLayerBundle(db, learningLayerId) : null;
    if (!learningLayerId || !bundle) return { ok: false, status: 404, error: "There is no such Learning Layer." };
    return {
      ok: true,
      name: `learning-layer-${learningLayerId}`,
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      object: { type: "learning_layer", id: learningLayerId },
      data: bundle,
      counts: { revisions: Object.keys(bundle.captions).length },
    };
  },
};

type Contents = Pick<Built, "data" | "counts">;

/**
 * Every Content Item with every Revision in save order, each Revision's snapshot as stored (its
 * body as Tiptap JSON) and that body rendered as HTML, plus Topics and old addresses. Embedded items
 * link to their public address and show their latest title.
 */
async function contentExport(db: Database): Promise<Contents> {
  const items = await db.select().from(contentItem).orderBy(asc(contentItem.createdAt)).all();
  const revisions = await db
    .select({ revision, submittedBy: revisionSubmission.submittedBy, submittedAt: revisionSubmission.submittedAt })
    .from(revision)
    .leftJoin(revisionSubmission, eq(revisionSubmission.revisionId, revision.id))
    .orderBy(asc(revision.contentItemId), asc(revision.number))
    .all();
  const latestTitle = new Map(revisions.map(({ revision }) => [revision.contentItemId, titleOf(revision.snapshot)]));
  const embeds = Object.fromEntries(
    items.map((item) => [item.id, { title: latestTitle.get(item.id) ?? "", href: itemPath(item) }]),
  );
  const redirects = await db.select().from(slugRedirect).all();
  return {
    counts: { items: items.length, revisions: revisions.length },
    data: {
      topics: await db.select().from(topic).orderBy(asc(topic.name)).all(),
      items: items.map((item) => ({
        ...item,
        path: itemPath(item),
        oldPaths: redirects
          .filter((redirect) => redirect.contentItemId === item.id)
          .map((redirect) => itemPath({ ...item, primaryArea: redirect.primaryArea, slug: redirect.slug })),
        revisions: revisions
          .filter(({ revision }) => revision.contentItemId === item.id)
          .map(({ revision, submittedBy, submittedAt }) => ({
            ...revision,
            submitted: submittedBy ? { by: submittedBy, at: submittedAt } : null,
            html: bodyHtml((revision.snapshot as ArticleSnapshot).body, embeds),
          })),
      })),
    },
  };
}

const titleOf = (snapshot: unknown) => (snapshot as Partial<ArticleSnapshot>).title ?? "";

/** Every Rights Record, current or withdrawn, with its Contributors. Evidence files stay private: only their names. */
async function rightsExport(db: Database): Promise<Contents> {
  const records = await db.select().from(rightsRecord).orderBy(asc(rightsRecord.createdAt)).all();
  const links = await db.select().from(rightsRecordContributor).all();
  return {
    counts: { records: records.length },
    data: {
      contributors: await db.select().from(contributor).orderBy(asc(contributor.name)).all(),
      records: records.map((record) => ({
        ...record,
        contributorIds: links.filter((link) => link.rightsRecordId === record.id).map((link) => link.contributorId),
      })),
    },
  };
}

/**
 * Review for Content Items and Learning Layers, each in its own tables (ADR-0001): who submitted
 * which Revision, who was asked to review, every decision, and the Review Links Knowledge Holders
 * saw (never their tokens) with each opening.
 */
async function approvalsExport(db: Database): Promise<Contents> {
  const [contentApprovals, layerApprovals] = await Promise.all([
    db.select().from(reviewApproval).orderBy(asc(reviewApproval.decidedAt)).all(),
    db.select().from(learningLayerApproval).orderBy(asc(learningLayerApproval.decidedAt)).all(),
  ]);
  return {
    counts: { approvals: contentApprovals.length + layerApprovals.length },
    data: {
      contentItems: {
        submissions: await db.select().from(revisionSubmission).all(),
        assignments: await db.select().from(reviewAssignment).all(),
        approvals: contentApprovals,
      },
      learningLayers: {
        submissions: await db.select().from(learningLayerSubmission).all(),
        assignments: await db.select().from(learningLayerReviewAssignment).all(),
        approvals: layerApprovals,
        reviewLinks: await reviewLinksWithoutTokens(db),
        reviewLinkOpenings: await db.select().from(reviewLinkAccess).orderBy(asc(reviewLinkAccess.accessedAt)).all(),
      },
    },
  };
}

/** Review Links as exported: everything but the hash of their token. */
const reviewLinksWithoutTokens = (db: Database) =>
  db
    .select({
      id: reviewLink.id,
      revisionId: reviewLink.revisionId,
      recipient: reviewLink.recipient,
      createdBy: reviewLink.createdBy,
      createdAt: reviewLink.createdAt,
      expiresAt: reviewLink.expiresAt,
      revokedAt: reviewLink.revokedAt,
      revokedBy: reviewLink.revokedBy,
    })
    .from(reviewLink)
    .orderBy(asc(reviewLink.createdAt))
    .all();

/** The whole audit log, oldest first. */
async function auditExport(db: Database): Promise<Contents> {
  const events = await db.select().from(auditEvent).orderBy(asc(auditEvent.createdAt), asc(auditEvent.id)).all();
  return { counts: { events: events.length }, data: { events } };
}

/**
 * The people who sent the public forms, with what they sent and agreed to, and the notices'
 * words. People who came through a report or data request are left out: their Cases are the case
 * team's (CASE_HANDLER), handled in the Case queue.
 */
async function contactsExport(db: Database): Promise<Contents> {
  const caseForms = [...new Set((Object.keys(CASE_HANDLER) as CaseKind[]).map(caseSourceForm))];
  const submissions = await db.select().from(submission).orderBy(asc(submission.receivedAt)).all();
  const consents = await db
    .select()
    .from(consentRecord)
    .where(notInArray(consentRecord.sourceForm, caseForms))
    .orderBy(asc(consentRecord.givenAt))
    .all();
  return {
    counts: { submissions: submissions.length, consents: consents.length },
    data: {
      notices: await db.select().from(notice).orderBy(asc(notice.purpose), asc(notice.version)).all(),
      submissions,
      consentRecords: consents,
    },
  };
}
