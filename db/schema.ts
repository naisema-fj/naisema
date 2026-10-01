import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { PermittedUse, RightsPartKind } from "../app/lib/rights-rules";
import type { MediaStatus, UploadPurpose, UploadType } from "../app/lib/upload-rules";

const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);

/** Site-wide settings the founder controls, such as the site name and welcome statement (PRD §08). */
export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// --- Identity (Better Auth). Table and property names follow Better Auth's model names. ---

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }).default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const twoFactor = sqliteTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: integer("verified", { mode: "boolean" }).default(false),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
  },
  (table) => [index("two_factor_user_id_idx").on(table.userId)],
);

export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

// --- Staff authorisation (ADR-0005, ADR-0013) ---

/** A staff role granted to a user. Revoking sets revokedAt; rows are never deleted. */
export const roleAssignment = sqliteTable(
  "role_assignment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    reviewType: text("review_type"),
    languageVariety: text("language_variety"),
    grantedBy: text("granted_by"),
    grantedAt: integer("granted_at", { mode: "timestamp_ms" }).notNull(),
    revokedBy: text("revoked_by"),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("role_assignment_user_id_idx").on(table.userId)],
);

/**
 * Staff state per signed-in session (ADR-0013): whether it has passed the two-factor check,
 * and how many wrong codes it has submitted (Better Auth does not limit attempts for an
 * existing session, so the staff gate does).
 */
export const staffSession = sqliteTable("staff_session", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => session.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
});

/** Append-only record of elevated and security-relevant actions (CMS-05). */
export const auditEvent = sqliteTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id"),
    details: text("details", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("audit_event_object_idx").on(table.objectType, table.objectId)],
);

/**
 * Local development and test builds only: outgoing email is written here instead of being
 * sent (EMAIL_OUTBOX = "true"). Deployed environments send through Cloudflare Email Service.
 */
export const emailOutbox = sqliteTable("email_outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// --- Content (ADR-0006) ---

/** A subject Content Items are tagged with. Topic pages arrive with 1a-18. */
export const topic = sqliteTable("topic", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Shown at the top of the Topic's page (FOR-06). */
  description: text("description").notNull().default(""),
  /** A broader Topic this one sits under, as a subtopic; filters on the parent's page. */
  parentTopicId: text("parent_topic_id").references((): AnySQLiteColumn => topic.id),
  /** The Content Item featured first on the Topic's page, chosen by an editor. */
  leadItemId: text("lead_item_id").references((): AnySQLiteColumn => contentItem.id),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * The stable parent of a Content Item: its identity and URL, pointing at its current draft and
 * current published Revision. Everything an editor writes lives in the Revisions.
 */
export const contentItem = sqliteTable(
  "content_item",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    slug: text("slug").notNull(),
    primaryArea: text("primary_area").notNull(),
    currentDraftRevisionId: text("current_draft_revision_id").references((): AnySQLiteColumn => revision.id),
    currentPublishedRevisionId: text("current_published_revision_id").references((): AnySQLiteColumn => revision.id),
    /** unpublished → published → withdrawn → archived (docs/phase-1a-defaults.md §3). */
    publicationState: text("publication_state").notNull().default("unpublished"),
    /** When the item first went public, and when its current published Revision was published. */
    firstPublishedAt: integer("first_published_at", { mode: "timestamp_ms" }),
    lastPublishedAt: integer("last_published_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("content_item_area_slug_idx").on(table.primaryArea, table.slug)],
);

/** An old URL of a Content Item, kept when its slug changes so the old address answers with a 301. */
export const slugRedirect = sqliteTable(
  "slug_redirect",
  {
    primaryArea: text("primary_area").notNull(),
    slug: text("slug").notNull(),
    contentItemId: text("content_item_id")
      .notNull()
      .references((): AnySQLiteColumn => contentItem.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.primaryArea, table.slug] })],
);

/**
 * One save of a Content Item: a full snapshot of everything the editor wrote. Never updated in
 * place; a database trigger (migrations/0002) refuses any UPDATE.
 */
export const revision = sqliteTable(
  "revision",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItem.id),
    /** 1, 2, 3… within its Content Item, in save order. */
    number: integer("number").notNull(),
    snapshot: text("snapshot", { mode: "json" }).notNull(),
    /** One hash per Review Type over the fields it covers, taken when the Revision is written (ADR-0006). */
    fingerprints: text("fingerprints", { mode: "json" }).notNull().default({}),
    /** Set when this Revision was made by restoring an earlier one. */
    restoredFromRevisionId: text("restored_from_revision_id"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("revision_item_number_idx").on(table.contentItemId, table.number)],
);

// --- Review (ADR-0003, ADR-0006, ADR-0007) ---

/** An editor sending a Revision for review. Its existence is what makes the Revision "submitted". */
export const revisionSubmission = sqliteTable("revision_submission", {
  revisionId: text("revision_id")
    .primaryKey()
    .references(() => revision.id),
  submittedBy: text("submitted_by").notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }).notNull(),
});

/** A reviewer asked to review a Content Item for one Review Type; it applies to all its Revisions. */
export const reviewAssignment = sqliteTable(
  "review_assignment",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItem.id),
    reviewType: text("review_type").notNull(),
    reviewerId: text("reviewer_id").notNull(),
    assignedBy: text("assigned_by").notNull(),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("review_assignment_item_type_reviewer_idx").on(table.contentItemId, table.reviewType, table.reviewerId),
  ],
);

/**
 * A Review Approval: one decision, for one Review Type, on one exact Revision. Write-once like
 * Revisions (a trigger refuses UPDATE). Also holds Knowledge Holder Approvals, recorded by an
 * editor, and Carried-forward Approvals, which point at the approval they carry.
 */
export const reviewApproval = sqliteTable(
  "review_approval",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id")
      .notNull()
      .references(() => revision.id),
    reviewType: text("review_type").notNull(),
    languageVariety: text("language_variety"),
    decision: text("decision").notNull(),
    /** The reviewer; for a Knowledge Holder Approval, the editor who recorded it. */
    reviewerId: text("reviewer_id").notNull(),
    /** What the reviewer looked at, in their words. */
    scope: text("scope"),
    notes: text("notes"),
    knowledgeHolderName: text("knowledge_holder_name"),
    /** How the Knowledge Holder gave their approval (in person, by phone…). */
    knowledgeHolderMethod: text("knowledge_holder_method"),
    conditions: text("conditions"),
    carriedForwardFromId: text("carried_forward_from_id").references((): AnySQLiteColumn => reviewApproval.id),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("review_approval_revision_idx").on(table.revisionId)],
);

// --- Rights (CMS-03/04, ADR-0007) ---

/** Anyone whose story, recording or knowledge appears in content: a rights and credit relationship. */
export const contributor = sqliteTable("contributor", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * The legal permission for a contributed work or media asset. Records are never edited (a trigger
 * allows only withdrawal): a mistake is corrected by withdrawing the record and recording a new one. The evidence file lives in the
 * private EVIDENCE bucket under `evidenceKey` and is never served publicly.
 */
export const rightsRecord = sqliteTable(
  "rights_record",
  {
    id: text("id").primaryKey(),
    /** What the record covers: "content_item" now; media assets join with the media library. */
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    /** A part of the subject with rights of its own (speaker, music, archive clip); null for all of it. */
    partKind: text("part_kind").$type<RightsPartKind>(),
    /** Which speaker, piece of music or clip, as staff name it. */
    partName: text("part_name"),
    rightsHolder: text("rights_holder").notNull(),
    permittedUses: text("permitted_uses", { mode: "json" }).$type<PermittedUse[]>().notNull(),
    guardianPermission: integer("guardian_permission", { mode: "boolean" }).notNull().default(false),
    evidenceKey: text("evidence_key").notNull(),
    evidenceName: text("evidence_name").notNull(),
    evidenceType: text("evidence_type").notNull(),
    /** The scanned upload behind the evidence; null for evidence stored before the scan pipeline (#14). */
    evidenceAssetId: text("evidence_asset_id").references((): AnySQLiteColumn => mediaAsset.id),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    withdrawnAt: integer("withdrawn_at", { mode: "timestamp_ms" }),
    withdrawnBy: text("withdrawn_by"),
    withdrawalReason: text("withdrawal_reason"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("rights_record_subject_idx").on(table.subjectType, table.subjectId)],
);

export const rightsRecordContributor = sqliteTable(
  "rights_record_contributor",
  {
    rightsRecordId: text("rights_record_id")
      .notNull()
      .references(() => rightsRecord.id),
    contributorId: text("contributor_id")
      .notNull()
      .references(() => contributor.id),
  },
  (table) => [primaryKey({ columns: [table.rightsRecordId, table.contributorId] })],
);

/** Expiry warnings already emailed, so each window warns once. */
export const rightsExpiryWarning = sqliteTable(
  "rights_expiry_warning",
  {
    rightsRecordId: text("rights_record_id")
      .notNull()
      .references(() => rightsRecord.id),
    withinDays: integer("within_days").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.rightsRecordId, table.withinDays] })],
);

/**
 * The public search index (PUB-03, ADR-0007): one row per item whose published Revision was
 * eligible when it was last indexed, mirrored into the `search_fts` full-text table by triggers
 * (migrations/0006). Every hit is checked for eligibility again before it is shown.
 */
export const searchEntry = sqliteTable(
  "search_entry",
  {
    /** The full-text index's rowid; kept stable by being declared. */
    id: integer("id").primaryKey({ autoIncrement: true }),
    contentItemId: text("content_item_id")
      .notNull()
      .unique()
      .references(() => contentItem.id),
    primaryArea: text("primary_area").notNull(),
    /** The item's type (content_item.type), which visitors filter by as its format. */
    format: text("format").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    /** The item's Topic names, so searching for a Topic's name finds the items in it. */
    topicNames: text("topic_names").notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("search_entry_area_idx").on(table.primaryArea, table.format)],
);

export const searchEntryTopic = sqliteTable(
  "search_entry_topic",
  {
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItem.id),
    topicId: text("topic_id")
      .notNull()
      .references(() => topic.id),
  },
  (table) => [
    primaryKey({ columns: [table.contentItemId, table.topicId] }),
    index("search_entry_topic_topic_idx").on(table.topicId),
  ],
);

/**
 * An uploaded file (docs/phase-1a-defaults.md §1, ADR-0010). Every upload lands in the private
 * quarantine bucket; only once ClamAV passes it is it copied to its destination (the media
 * library, or a Rights Record's private evidence) and marked ready.
 *
 * Status: uploading → scanning → ready, or → infected / failed (kept in quarantine, shown to
 * staff with the reason) → removed after 30 days.
 */
export const mediaAsset = sqliteTable(
  "media_asset",
  {
    id: text("id").primaryKey(),
    /** "media" (the media library) or "evidence" (a Rights Record's private evidence). */
    purpose: text("purpose").$type<UploadPurpose>().notNull(),
    /** The accepted file type (app/lib/upload-rules.ts). */
    type: text("type").$type<UploadType>().notNull(),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    status: text("status").$type<MediaStatus>().notNull(),
    /** Why an upload was refused or failed, or which signature ClamAV found, for staff to read. */
    statusReason: text("status_reason"),
    quarantineKey: text("quarantine_key").notNull(),
    /** The R2 multipart upload, while the file is still arriving. */
    multipartUploadId: text("multipart_upload_id"),
    /** Where a clean file is copied, in MEDIA or EVIDENCE according to its purpose. */
    destinationKey: text("destination_key").notNull(),
    altText: text("alt_text").notNull().default(""),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    /** When the file was passed or refused; failures are removed 30 days after this. */
    scannedAt: integer("scanned_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("media_asset_purpose_idx").on(table.purpose, table.createdAt),
    index("media_asset_status_idx").on(table.status, table.updatedAt),
  ],
);

/** The parts of a multipart upload received so far, so an interrupted upload can resume. */
export const mediaUploadPart = sqliteTable(
  "media_upload_part",
  {
    assetId: text("asset_id")
      .notNull()
      .references(() => mediaAsset.id),
    partNumber: integer("part_number").notNull(),
    etag: text("etag").notNull(),
    size: integer("size").notNull(),
  },
  (table) => [primaryKey({ columns: [table.assetId, table.partNumber] })],
);

/**
 * A visitor's report that a Resource's link is broken. No personal details: the reporter is only a
 * keyed hash of their address and the day, so one person counts once a day.
 */
export const linkReport = sqliteTable(
  "link_report",
  {
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItem.id),
    reporterKey: text("reporter_key").notNull(),
    reportedAt: integer("reported_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.contentItemId, table.reporterKey] })],
);
