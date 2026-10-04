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
import type { AppealOutcome, CaseOutcome, CaseState, Severity } from "../app/lib/case-rules";
import type {
  AccessMode,
  AgeSuitability,
  Cost,
  HandledBy,
  Level,
  OfferingAccess,
  OfferingFormat,
  OrganisationType,
} from "../app/lib/listing-fields";
import type { CaseKind } from "../app/lib/permissions";
import type { PermittedUse, RightsPartKind } from "../app/lib/rights-rules";
import type { ConsentPurpose, SubmissionFields, SubmissionStatus, SubmissionType } from "../app/lib/submission-fields";
import type { MediaStatus, UploadPurpose, UploadType } from "../app/lib/upload-rules";
import type { Orientation, VideoProviderName, VideoState } from "../app/lib/video-rules";

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

// --- Providers, Offerings and Partnership Agreements (PART-01–03) ---

/**
 * An organisation or person whose learning Offerings are listed (CONTEXT.md, Provider). A plain
 * listing editors keep: empty text means not known. Listing implies no partnership or endorsement.
 */
export const provider = sqliteTable("provider", {
  id: text("id").primaryKey(),
  /** Its address under /connect/providers/; fixed when the Provider is added. */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  organisationType: text("organisation_type").$type<OrganisationType>().notNull(),
  location: text("location").notNull().default(""),
  website: text("website").notNull().default(""),
  contactRoute: text("contact_route").notNull().default(""),
  lastCheckedOn: text("last_checked_on").notNull(),
  /** Shown on the public site. */
  listed: integer("listed", { mode: "boolean" }).notNull().default(false),
  /** Who sponsors this listing, disclosed wherever it is shown; null when nobody does. */
  sponsoredBy: text("sponsored_by"),
  /** Why editors feature it (PUB-04); featured exactly when this is set. */
  featureRationale: text("feature_rationale"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/** A programme, course, resource or class a Provider offers, with exactly one access mode (PART-02). */
export const offering = sqliteTable(
  "offering",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => provider.id),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    languageVariety: text("language_variety").notNull().default(""),
    level: text("level").$type<Level>().notNull(),
    ageSuitability: text("age_suitability").$type<AgeSuitability>().notNull(),
    accessibility: text("accessibility").notNull().default(""),
    format: text("format").$type<OfferingFormat>().notNull(),
    cost: text("cost", { mode: "json" }).$type<Cost>().notNull(),
    /** Kept beside `cost` so the listing can filter on it. */
    costKind: text("cost_kind").$type<Cost["kind"]>().notNull(),
    startsOn: text("starts_on").notNull().default(""),
    endsOn: text("ends_on").notNull().default(""),
    access: text("access", { mode: "json" }).$type<OfferingAccess>().notNull(),
    /** Kept beside `access` so the listing can filter on it. */
    accessMode: text("access_mode").$type<AccessMode>().notNull(),
    enrolmentBy: text("enrolment_by").$type<HandledBy>().notNull(),
    supportBy: text("support_by").$type<HandledBy>().notNull(),
    listed: integer("listed", { mode: "boolean" }).notNull().default(false),
    sponsoredBy: text("sponsored_by"),
    featureRationale: text("feature_rationale"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("offering_provider_idx").on(table.providerId)],
);

/**
 * A recorded Partnership Agreement (CONTEXT.md, Partner): while one is in force, and only then,
 * the Provider is shown as a Partner. Ended early by setting `endedAt`, never deleted.
 */
export const partnershipAgreement = sqliteTable(
  "partnership_agreement",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => provider.id),
    /** Where the signed agreement is kept, in words: "MOU signed 3 Sept 2026, founder's files". */
    reference: text("reference").notNull(),
    startsOn: text("starts_on").notNull(),
    /** Its last day, or null when it runs until ended. */
    endsOn: text("ends_on"),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    endedBy: text("ended_by"),
    recordedBy: text("recorded_by").notNull(),
    recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("partnership_agreement_provider_idx").on(table.providerId)],
);

// --- Submissions and Consent Records (PUB-05, PUB-06, DATA-02) ---

/**
 * Anything a member of the public sends through a form (CONTEXT.md, Submission). It goes to the
 * staff queue and is never published. The consents given with it are kept apart, in consent_record.
 */
export const submission = sqliteTable(
  "submission",
  {
    id: text("id").primaryKey(),
    type: text("type").$type<SubmissionType>().notNull(),
    /** A key the form was rendered with: sending the same form twice stores it once. */
    formKey: text("form_key").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    fields: text("fields", { mode: "json" }).$type<SubmissionFields>().notNull(),
    status: text("status").$type<SubmissionStatus>().notNull().default("new"),
    /** The staff member working it. */
    ownerId: text("owner_id"),
    /** The day, YYYY-MM-DD, it should be answered by. */
    dueOn: text("due_on").notNull(),
    /** When the confirmation email went; null if it couldn't be sent. */
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("submission_queue_idx").on(table.status, table.dueOn)],
);

/**
 * The wording a person is shown when asked to consent to one purpose, one row per version. A new
 * version is added, never an old one changed, so the exact words anyone agreed to are recoverable.
 */
export const notice = sqliteTable(
  "notice",
  {
    id: text("id").primaryKey(),
    purpose: text("purpose").$type<ConsentPurpose>().notNull(),
    version: integer("version").notNull(),
    wording: text("wording").notNull(),
    publishedBy: text("published_by"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("notice_purpose_version_idx").on(table.purpose, table.version)],
);

/**
 * That a person agreed to one purpose under one notice version (CONTEXT.md, Consent Record): when,
 * on which form, and when they withdrew. Kept apart from the Submission it came with, which it
 * outlives: deleting a Submission leaves the record of what was agreed.
 */
export const consentRecord = sqliteTable(
  "consent_record",
  {
    id: text("id").primaryKey(),
    purpose: text("purpose").$type<ConsentPurpose>().notNull(),
    noticeId: text("notice_id")
      .notNull()
      .references(() => notice.id),
    email: text("email").notNull(),
    /** The form it was given on: a Submission type, or "newsletter". */
    sourceForm: text("source_form").notNull(),
    /** The Submission it came with, if any; not a foreign key, so the Submission can be deleted. */
    submissionId: text("submission_id"),
    givenAt: integer("given_at", { mode: "timestamp_ms" }).notNull(),
    withdrawnAt: integer("withdrawn_at", { mode: "timestamp_ms" }),
    /** How it was withdrawn: the person's own link, an unsubscribe, or staff on their request. */
    withdrawnVia: text("withdrawn_via").$type<"link" | "unsubscribe" | "staff">(),
  },
  (table) => [index("consent_record_email_idx").on(table.email, table.purpose)],
);

/** Newsletter changes, written here instead of sent to the newsletter tool in local development and tests. */
export const newsletterOutbox = sqliteTable("newsletter_outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").$type<"subscribe" | "unsubscribe">().notNull(),
  email: text("email").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * A single-use, expiring link an editor sends so a contributor can upload the material they
 * proposed (docs/phase-1a-defaults.md §4). Files go to quarantine and are scanned like any upload;
 * the link stops working once the contributor finishes or it expires. Only the token's hash is kept.
 */
export const uploadLink = sqliteTable(
  "upload_link",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submission.id),
    tokenHash: text("token_hash").notNull().unique(),
    issuedBy: text("issued_by").notNull(),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("upload_link_submission_idx").on(table.submissionId)],
);

/** The files that arrived through an upload link. */
export const uploadLinkFile = sqliteTable("upload_link_file", {
  assetId: text("asset_id")
    .primaryKey()
    .references(() => mediaAsset.id),
  linkId: text("link_id")
    .notNull()
    .references(() => uploadLink.id),
});

// --- Cases (SAFE-01–03, DATA-03) ---

/**
 * A restricted, audited record of a report, rights concern or data request (CONTEXT.md, Case). Only
 * the role that handles its kind can read it (permissions.ts), and every view and change is
 * audited. A decision can be appealed once, and someone else decides the appeal.
 */
export const caseRecord = sqliteTable(
  "case_record",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<CaseKind>().notNull(),
    /** The key its form was rendered with: sending the same form twice opens one Case. */
    formKey: text("form_key").unique(),
    state: text("state").$type<CaseState>().notNull().default("received"),
    /** What the person said was wrong, or asked for (case-rules.ts). */
    reason: text("reason").notNull(),
    details: text("details").notNull(),
    /** The content it is about, from the report link on the item's page. */
    contentItemId: text("content_item_id").references(() => contentItem.id),
    /** Who it is about, in the case team's words: a creator, a person in a recording, the requester. */
    affectedPerson: text("affected_person").notNull().default(""),
    reporterName: text("reporter_name").notNull().default(""),
    /** Null for an anonymous report. */
    reporterEmail: text("reporter_email"),
    severity: text("severity").$type<Severity>(),
    ownerId: text("owner_id"),
    outcome: text("outcome").$type<CaseOutcome>(),
    action: text("action"),
    rationale: text("rationale"),
    decidedBy: text("decided_by"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    appealReasons: text("appeal_reasons"),
    appealedAt: integer("appealed_at", { mode: "timestamp_ms" }),
    appealOutcome: text("appeal_outcome").$type<AppealOutcome>(),
    appealRationale: text("appeal_rationale"),
    appealDecidedBy: text("appeal_decided_by"),
    appealDecidedAt: integer("appeal_decided_at", { mode: "timestamp_ms" }),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("case_record_queue_idx").on(table.kind, table.state, table.receivedAt)],
);

/** Restricted evidence a case team adds to a Case: scanned like any upload, kept in EVIDENCE. */
export const caseEvidence = sqliteTable(
  "case_evidence",
  {
    assetId: text("asset_id")
      .primaryKey()
      .references(() => mediaAsset.id),
    caseId: text("case_id")
      .notNull()
      .references(() => caseRecord.id),
    addedBy: text("added_by").notNull(),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("case_evidence_case_idx").on(table.caseId)],
);

/**
 * A Content Item hidden from the public while a Case about it is reviewed (SAFE-03). While a hold
 * is in place the item is not eligible (ADR-0007), whatever its reviews and rights; lifting the
 * hold brings it back. Holds are lifted, never deleted.
 */
export const contentHold = sqliteTable(
  "content_hold",
  {
    id: text("id").primaryKey(),
    contentItemId: text("content_item_id")
      .notNull()
      .references(() => contentItem.id),
    caseId: text("case_id")
      .notNull()
      .references(() => caseRecord.id),
    placedBy: text("placed_by").notNull(),
    placedAt: integer("placed_at", { mode: "timestamp_ms" }).notNull(),
    liftedBy: text("lifted_by"),
    liftedAt: integer("lifted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("content_hold_item_idx").on(table.contentItemId),
    // At most one hold in place per item, so lifting it always shows the item again.
    uniqueIndex("content_hold_active_idx").on(table.contentItemId).where(sql`${table.liftedAt} IS NULL`),
  ],
);

/**
 * A Video Asset (ADR-0008): a scanned video master kept in the private VIDEO_MASTERS bucket as
 * Na iSema's original, and the copy a video provider (Cloudflare Stream) made of it for delivery.
 * It shares its ID with the media library upload it came from. Its length and picture size are
 * read from the master itself; the provider's reports only move its state forwards.
 */
export const videoAsset = sqliteTable(
  "video_asset",
  {
    id: text("id")
      .primaryKey()
      .references(() => mediaAsset.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    /** The master's key in VIDEO_MASTERS. */
    masterKey: text("master_key").notNull(),
    /** Which provider holds the delivery copy ("stream", or "local" in development and tests). */
    provider: text("provider").$type<VideoProviderName>().notNull(),
    /** The provider's ID for its copy, such as a Stream video UID, once one was asked for. */
    providerId: text("provider_id"),
    state: text("state").$type<VideoState>().notNull(),
    /** Why processing failed, for staff to read; never carries addresses or credentials. */
    stateReason: text("state_reason"),
    durationMs: integer("duration_ms").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    orientation: text("orientation").$type<Orientation>().notNull(),
    /** The environment that sent it (development, staging or production), as one Stream account serves them all. */
    environment: text("environment").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    readyAt: integer("ready_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("video_asset_provider_idx").on(table.provider, table.providerId),
    index("video_asset_state_idx").on(table.state, table.updatedAt),
  ],
);
