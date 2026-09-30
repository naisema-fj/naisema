import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { contentItem, revision, user } from "~db/schema";
import { AREA_NAMES, isPrimaryArea, type PrimaryArea } from "./areas";
import { type ArticleBody, EMPTY_ARTICLE_BODY, embeddedItemIds, parseArticleBody } from "./article-body";
import { auditInsert } from "./audit.server";
import type { Database } from "./db.server";
import { firstFreeSlug, slugify } from "./slug";
import { existingTopicIds } from "./topics.server";

/** Everything an editor writes on an Article; each save stores one of these as a Revision. */
export type ArticleSnapshot = {
  title: string;
  summary: string;
  credit: string;
  topicIds: string[];
  body: ArticleBody;
};

export type ArticleField = keyof ArticleSnapshot | "primaryArea";
export type FieldErrors = Partial<Record<ArticleField, string>>;

const LIMITS = { title: 200, summary: 500, credit: 300 } as const;

export type ArticleFormResult =
  | { ok: true; snapshot: ArticleSnapshot; primaryArea: PrimaryArea | null }
  /** On failure, `values` holds what was submitted, so the form can be shown again as it was. */
  | { ok: false; errors: FieldErrors; values: ArticleSnapshot };

/**
 * Reads the article form. Title, summary, credit and at least one Topic are required on every
 * save, and the body must pass the allowlist. `withArea` also requires a primary area (new Articles).
 */
export async function readArticleForm(db: Database, form: FormData, withArea: boolean): Promise<ArticleFormResult> {
  const errors: FieldErrors = {};
  const text = (field: keyof typeof LIMITS, label: string) => {
    const value = String(form.get(field) ?? "").trim();
    if (!value) errors[field] = `Enter the ${label}.`;
    else if (value.length > LIMITS[field]) errors[field] = `The ${label} can be at most ${LIMITS[field]} characters.`;
    return value;
  };
  const title = text("title", "title");
  const summary = text("summary", "summary");
  const credit = text("credit", "credit");

  const area = String(form.get("primaryArea") ?? "");
  const primaryArea = withArea && isPrimaryArea(area) ? area : null;
  if (withArea && !primaryArea) errors.primaryArea = "Choose the primary area.";

  const topicIds = [...new Set(form.getAll("topicId").map(String))];
  const known = await existingTopicIds(db, topicIds);
  if (!topicIds.length) errors.topicIds = "Choose at least one topic.";
  else if (topicIds.some((id) => !known.has(id))) errors.topicIds = "One of those topics no longer exists.";

  let body: ArticleBody | null = null;
  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(String(form.get("body") ?? ""));
  } catch {
    bodyJson = undefined;
  }
  const parsed = parseArticleBody(bodyJson);
  if (!parsed.ok) errors.body = parsed.error;
  else {
    const missing = await missingContentItems(db, embeddedItemIds(parsed.body));
    if (missing) errors.body = "The body embeds a Content Item that doesn't exist.";
    else body = parsed.body;
  }

  if (Object.keys(errors).length || !body) {
    // A body the allowlist refused goes back as sent, so the writer can fix it rather than lose it;
    // it is only ever loaded into the editor, never rendered as HTML.
    const submittedBody = parsed.ok ? parsed.body : isDoc(bodyJson) ? (bodyJson as ArticleBody) : EMPTY_ARTICLE_BODY;
    return { ok: false, errors, values: { title, summary, credit, topicIds, body: submittedBody } };
  }
  return { ok: true, snapshot: { title, summary, credit, topicIds, body }, primaryArea };
}

const isDoc = (value: unknown) =>
  typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc";

async function missingContentItems(db: Database, ids: string[]): Promise<boolean> {
  if (!ids.length) return false;
  const rows = await db.select({ id: contentItem.id }).from(contentItem).where(inArray(contentItem.id, ids));
  return new Set(rows.map((row) => row.id)).size !== new Set(ids).size;
}

/** Creates an Article and its first Revision. Returns the new Content Item's ID. */
export async function createArticle(
  db: Database,
  createdBy: string,
  primaryArea: PrimaryArea,
  snapshot: ArticleSnapshot,
): Promise<string> {
  const base = slugify(snapshot.title);
  const taken = await db
    .select({ slug: contentItem.slug })
    .from(contentItem)
    .where(
      and(
        eq(contentItem.primaryArea, primaryArea),
        or(eq(contentItem.slug, base), like(contentItem.slug, `${base}-%`)),
      ),
    );
  const now = new Date();
  const id = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  await db.batch([
    db.insert(contentItem).values({
      id,
      type: "article",
      slug: firstFreeSlug(base, new Set(taken.map((row) => row.slug))),
      primaryArea,
      createdBy,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(revision).values({ id: revisionId, contentItemId: id, number: 1, snapshot, createdBy, createdAt: now }),
    db.update(contentItem).set({ currentDraftRevisionId: revisionId }).where(eq(contentItem.id, id)),
    auditInsert(db, { actorId: createdBy, action: "content_item.created", objectType: "content_item", objectId: id }),
    auditInsert(db, {
      actorId: createdBy,
      action: "revision.saved",
      objectType: "revision",
      objectId: revisionId,
      details: { contentItemId: id, number: 1 },
    }),
  ]);
  return id;
}

export type SaveResult = { ok: true; number: number } | { ok: false; error: string };

const STALE =
  "Someone else saved this article while you were editing. Open it again to see their changes, then make yours.";

/**
 * Appends a Revision on top of `baseRevisionId`, the draft the editor started from, and makes it
 * the current draft. If a newer Revision already exists the save is refused rather than
 * silently replacing someone else's work.
 */
export async function saveArticle(
  db: Database,
  createdBy: string,
  contentItemId: string,
  baseRevisionId: string,
  snapshot: ArticleSnapshot,
  restoredFromRevisionId: string | null = null,
): Promise<SaveResult> {
  const item = await db.select().from(contentItem).where(eq(contentItem.id, contentItemId)).get();
  if (item?.type !== "article") return { ok: false, error: "That article doesn't exist." };
  if (item.currentDraftRevisionId !== baseRevisionId) return { ok: false, error: STALE };
  const base = await db.select({ number: revision.number }).from(revision).where(eq(revision.id, baseRevisionId)).get();
  if (!base) return { ok: false, error: STALE };

  const now = new Date();
  const id = crypto.randomUUID();
  const number = base.number + 1;
  try {
    await db.batch([
      // A concurrent save of the same base takes this number first; the unique index then refuses this one.
      db
        .insert(revision)
        .values({ id, contentItemId, number, snapshot, restoredFromRevisionId, createdBy, createdAt: now }),
      db
        .update(contentItem)
        .set({ currentDraftRevisionId: id, updatedAt: now })
        .where(eq(contentItem.id, contentItemId)),
      auditInsert(db, {
        actorId: createdBy,
        action: restoredFromRevisionId ? "revision.restored" : "revision.saved",
        objectType: "revision",
        objectId: id,
        details: { contentItemId, number, ...(restoredFromRevisionId ? { restoredFromRevisionId } : {}) },
      }),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return { ok: false, error: STALE };
    throw error;
  }
  return { ok: true, number };
}

/** Restoring saves an earlier Revision's snapshot again as a new Revision; history is never rewritten. */
export async function restoreRevision(
  db: Database,
  createdBy: string,
  contentItemId: string,
  baseRevisionId: string,
  revisionId: string,
): Promise<SaveResult> {
  const earlier = await db
    .select()
    .from(revision)
    .where(and(eq(revision.id, revisionId), eq(revision.contentItemId, contentItemId)))
    .get();
  if (!earlier) return { ok: false, error: "That revision doesn't belong to this article." };
  return saveArticle(db, createdBy, contentItemId, baseRevisionId, earlier.snapshot as ArticleSnapshot, earlier.id);
}

export async function listArticles(db: Database) {
  const rows = await db
    .select({
      id: contentItem.id,
      primaryArea: contentItem.primaryArea,
      slug: contentItem.slug,
      updatedAt: contentItem.updatedAt,
      snapshot: revision.snapshot,
      number: revision.number,
    })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(eq(contentItem.type, "article"))
    .orderBy(desc(contentItem.updatedAt));
  return rows.map(({ snapshot, ...row }) => ({
    ...row,
    title: (snapshot as ArticleSnapshot).title,
    areaName: AREA_NAMES[row.primaryArea as PrimaryArea],
  }));
}

/** An Article with its current draft. */
export async function getArticle(db: Database, contentItemId: string) {
  const row = await db
    .select({ item: contentItem, draft: revision })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(and(eq(contentItem.id, contentItemId), eq(contentItem.type, "article")))
    .get();
  if (!row) return null;
  return {
    id: row.item.id,
    slug: row.item.slug,
    primaryArea: row.item.primaryArea as PrimaryArea,
    draft: toRevision(row.draft),
  };
}

export type ArticleRevision = ReturnType<typeof toRevision>;

function toRevision(row: typeof revision.$inferSelect) {
  return {
    id: row.id,
    number: row.number,
    snapshot: row.snapshot as ArticleSnapshot,
    restoredFromRevisionId: row.restoredFromRevisionId,
    createdAt: row.createdAt,
  };
}

/** Every Revision of an Article, newest first, with who saved it. */
export async function listRevisions(db: Database, contentItemId: string) {
  const rows = await db
    .select({ revision, savedBy: user.email })
    .from(revision)
    .leftJoin(user, eq(user.id, revision.createdBy))
    .where(eq(revision.contentItemId, contentItemId))
    .orderBy(desc(revision.number));
  const numbers = new Map(rows.map((row) => [row.revision.id, row.revision.number]));
  return rows.map((row) => ({
    ...toRevision(row.revision),
    savedBy: row.savedBy ?? "a former staff member",
    restoredFromNumber: row.revision.restoredFromRevisionId
      ? (numbers.get(row.revision.restoredFromRevisionId) ?? null)
      : null,
  }));
}

export async function getRevision(db: Database, contentItemId: string, number: number) {
  const row = await db
    .select()
    .from(revision)
    .where(and(eq(revision.contentItemId, contentItemId), eq(revision.number, number)))
    .get();
  return row ? toRevision(row) : null;
}

/** Titles and admin links for embedded Content Items, keyed by ID, for the body renderer. */
export async function embedsFor(db: Database, body: ArticleBody) {
  const ids = embeddedItemIds(body);
  if (!ids.length) return {};
  const rows = await db
    .select({ id: contentItem.id, snapshot: revision.snapshot })
    .from(contentItem)
    .innerJoin(revision, eq(revision.id, contentItem.currentDraftRevisionId))
    .where(inArray(contentItem.id, ids));
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      { title: (row.snapshot as { title?: string }).title ?? "Untitled", href: `/admin/articles/${row.id}` },
    ]),
  );
}
