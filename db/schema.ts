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
import type { PermittedUse } from "../app/lib/rights-rules";

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
    rightsHolder: text("rights_holder").notNull(),
    permittedUses: text("permitted_uses", { mode: "json" }).$type<PermittedUse[]>().notNull(),
    guardianPermission: integer("guardian_permission", { mode: "boolean" }).notNull().default(false),
    evidenceKey: text("evidence_key").notNull(),
    evidenceName: text("evidence_name").notNull(),
    evidenceType: text("evidence_type").notNull(),
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
