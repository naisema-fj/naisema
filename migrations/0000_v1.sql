-- The v1 schema (ADR-0015; db/schema.ts). Written by hand to match the Drizzle schema. Applied to
-- fresh databases: v1 does not carry over Phase 1a's tables.

CREATE TABLE `staff` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`roles` text NOT NULL,
	`language_variety` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_item` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`area` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`published_revision_id` text,
	`search_text` text DEFAULT '' NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_item_address` ON `content_item` (`area`,`slug`);
--> statement-breakpoint
CREATE INDEX `content_item_state` ON `content_item` (`state`);
--> statement-breakpoint
CREATE TABLE `revision` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL REFERENCES `content_item`(`id`),
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`credit` text NOT NULL,
	`flags` text NOT NULL,
	`topics` text NOT NULL,
	`body` text NOT NULL,
	`fields` text NOT NULL,
	`layer` text,
	`media_ids` text NOT NULL,
	`author_email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_number` ON `revision` (`item_id`,`number`);
--> statement-breakpoint
-- Revisions are write-once (ADR-0006): an edit is always a new Revision.
CREATE TRIGGER `revision_no_update` BEFORE UPDATE ON `revision`
BEGIN
	SELECT RAISE(ABORT, 'Revisions are write-once');
END;
--> statement-breakpoint
CREATE TABLE `review` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL REFERENCES `revision`(`id`),
	`type` text NOT NULL,
	`decision` text NOT NULL,
	`reviewer_email` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`knowledge_holder` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `review_revision` ON `review` (`revision_id`);
--> statement-breakpoint
CREATE TABLE `rights_record` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`holder` text NOT NULL,
	`permitted_uses` text NOT NULL,
	`guardian_permission` integer DEFAULT false NOT NULL,
	`expires_on` text,
	`evidence_key` text,
	`notes` text DEFAULT '' NOT NULL,
	`withdrawn_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rights_subject` ON `rights_record` (`subject_type`,`subject_id`);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`filename` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`uploaded_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "media_kind" CHECK("media"."kind" in ('image', 'audio', 'video', 'document'))
);
--> statement-breakpoint
CREATE TABLE `expression` (
	`id` text PRIMARY KEY NOT NULL,
	`variety` text NOT NULL,
	`headword` text NOT NULL,
	`general_meaning` text NOT NULL,
	`literal_meaning` text DEFAULT '' NOT NULL,
	`grammar_note` text DEFAULT '' NOT NULL,
	`pronunciation` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expression_variety` ON `expression` (`variety`,`headword`);
--> statement-breakpoint
CREATE TABLE `topic` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`parent` text
);
--> statement-breakpoint
CREATE TABLE `submission` (
	`id` text PRIMARY KEY NOT NULL,
	`form` text NOT NULL,
	`name` text,
	`email` text,
	`fields` text NOT NULL,
	`notice_version` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submission_created` ON `submission` (`created_at`);
--> statement-breakpoint
CREATE TABLE `audit_event` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`details` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_subject` ON `audit_event` (`subject_type`,`subject_id`);
--> statement-breakpoint
-- The audit log is only ever added to.
CREATE TRIGGER `audit_event_no_update` BEFORE UPDATE ON `audit_event`
BEGIN
	SELECT RAISE(ABORT, 'The audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_event_no_delete` BEFORE DELETE ON `audit_event`
BEGIN
	SELECT RAISE(ABORT, 'The audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `revision_no_delete` BEFORE DELETE ON `revision`
BEGIN
	SELECT RAISE(ABORT, 'Revisions are write-once');
END;
