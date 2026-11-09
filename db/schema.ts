import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ArticleBody } from "../app/lib/article-body";
import type {
  ContentFlag,
  ContentKind,
  ItemState,
  KindFields,
  ReviewDecision,
  ReviewType,
} from "../app/lib/content-rules";
import type { LearningLayer } from "../app/lib/learning-layer-fields";
import type { MediaKind } from "../app/lib/media-rules";
import type { PermittedUse } from "../app/lib/rights-rules";
import type { Role } from "../app/lib/roles";

/**
 * The v1 data model (ADR-0015): nine tables. Content is a Content Item with write-once Revisions;
 * Review Approvals and Rights Records decide, on every request, whether a Revision is public
 * (ADR-0003, ADR-0007). A Video's Learning Layer lives inside its Revision.
 */

const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);

/** People who work on the admin host, behind Cloudflare Access. Their email is what Access vouches for. */
export const staff = sqliteTable("staff", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  roles: text("roles", { mode: "json" }).$type<Role[]>().notNull(),
  /** The Language Variety a language reviewer reviews, like "standard-fijian". */
  languageVariety: text("language_variety"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

/**
 * A Content Item: one canonical address, `/{area}/{slug}` (`/{slug}` for a Page). What the public
 * sees is its published Revision, and only while that Revision is eligible (ADR-0007).
 */
export const contentItem = sqliteTable(
  "content_item",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<ContentKind>().notNull(),
    /** One of the six areas, or "pages" for a footer Page. */
    area: text("area").notNull(),
    slug: text("slug").notNull(),
    /** The latest Revision's title, for staff lists. */
    title: text("title").notNull(),
    state: text("state").$type<ItemState>().notNull().default("draft"),
    publishedRevisionId: text("published_revision_id"),
    /** The published Revision's words, lower-cased, for search. Empty while nothing is published. */
    searchText: text("search_text").notNull().default(""),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("content_item_address").on(table.area, table.slug),
    index("content_item_state").on(table.state),
  ],
);

/** A write-once snapshot of a Content Item. An edit is always a new Revision (ADR-0015). */
export const revision = sqliteTable(
  "revision",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => contentItem.id),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    credit: text("credit").notNull(),
    flags: text("flags", { mode: "json" }).$type<ContentFlag[]>().notNull(),
    topics: text("topics", { mode: "json" }).$type<string[]>().notNull(),
    body: text("body", { mode: "json" }).$type<ArticleBody>().notNull(),
    /** What the kind adds: an Episode's audio and transcript, a Video's footage and so on. */
    fields: text("fields", { mode: "json" }).$type<KindFields>().notNull(),
    /** A Video's Learning Layer: Segments, Annotations, notes and Activities. */
    layer: text("layer", { mode: "json" }).$type<LearningLayer>(),
    /** Every media file the Revision shows, each of which needs its own current Rights Record. */
    mediaIds: text("media_ids", { mode: "json" }).$type<string[]>().notNull(),
    authorEmail: text("author_email").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("revision_number").on(table.itemId, table.number)],
);

/**
 * A Review Approval, or a request for changes, on one exact Revision (ADR-0003). The latest
 * decision of each Review Type counts. A Knowledge Holder Approval records who approved and how.
 */
export const review = sqliteTable(
  "review",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revision.id),
    type: text("type").$type<ReviewType>().notNull(),
    decision: text("decision").$type<ReviewDecision>().notNull(),
    reviewerEmail: text("reviewer_email").notNull(),
    notes: text("notes").notNull().default(""),
    /** For a Knowledge Holder Approval: their name, how they approved, and any conditions. */
    knowledgeHolder: text("knowledge_holder", { mode: "json" }).$type<{
      name: string;
      how: string;
      conditions: string;
    }>(),
    createdAt: createdAt(),
  },
  (table) => [index("review_revision").on(table.revisionId)],
);

/** What a rights holder has permitted NAISEMA to do with a Content Item or a media file. */
export const rightsRecord = sqliteTable(
  "rights_record",
  {
    id: text("id").primaryKey(),
    subjectType: text("subject_type").$type<"item" | "media">().notNull(),
    subjectId: text("subject_id").notNull(),
    holder: text("holder").notNull(),
    permittedUses: text("permitted_uses", { mode: "json" }).$type<PermittedUse[]>().notNull(),
    /** Documented permission from the guardian of children who can be identified. */
    guardianPermission: integer("guardian_permission", { mode: "boolean" }).notNull().default(false),
    /** The last day it holds, as YYYY-MM-DD in Fiji, or null for no end. */
    expiresOn: text("expires_on"),
    /** The signed permission, in the media bucket under `evidence/`, readable by editors only. */
    evidenceKey: text("evidence_key"),
    notes: text("notes").notNull().default(""),
    withdrawnAt: integer("withdrawn_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("rights_subject").on(table.subjectType, table.subjectId)],
);

/** A file in the media bucket: an image, audio, an MP4 clip or a PDF, uploaded by staff. */
export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<MediaKind>().notNull(),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull(),
    filename: text("filename").notNull(),
    alt: text("alt").notNull().default(""),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: createdAt(),
  },
  (table) => [check("media_kind", sql`${table.kind} in ('image', 'audio', 'video', 'document')`)],
);

/** A reviewed word or phrase in a Language Variety's library, which Annotations point to. */
export const expression = sqliteTable(
  "expression",
  {
    id: text("id").primaryKey(),
    variety: text("variety").notNull(),
    headword: text("headword").notNull(),
    generalMeaning: text("general_meaning").notNull(),
    literalMeaning: text("literal_meaning").notNull().default(""),
    grammarNote: text("grammar_note").notNull().default(""),
    pronunciation: text("pronunciation").notNull().default(""),
    createdBy: text("created_by").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("expression_variety").on(table.variety, table.headword)],
);

/** A Topic: a theme across areas, with at most one level of subtopics. */
export const topic = sqliteTable("topic", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  parent: text("parent"),
});

/** What someone sent through a public form. Never published; the right person is emailed. */
export const submission = sqliteTable(
  "submission",
  {
    id: text("id").primaryKey(),
    form: text("form").notNull(),
    name: text("name"),
    email: text("email"),
    fields: text("fields", { mode: "json" }).$type<Record<string, string>>().notNull(),
    /** The version of the privacy notice the form showed when it was sent. */
    noticeVersion: text("notice_version").notNull(),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("submission_created").on(table.createdAt)],
);

/** Who did what, append-only (migration 0000 refuses updates and deletes). */
export const auditEvent = sqliteTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("audit_subject").on(table.subjectType, table.subjectId)],
);
