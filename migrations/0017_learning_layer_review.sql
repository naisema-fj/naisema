CREATE TABLE `learning_layer_approval` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`review_type` text NOT NULL,
	`language_variety` text,
	`decision` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`scope` text,
	`notes` text,
	`knowledge_holder_name` text,
	`knowledge_holder_method` text,
	`conditions` text,
	`review_link_id` text,
	`evidence_asset_id` text,
	`evidence_key` text,
	`evidence_name` text,
	`evidence_type` text,
	`carried_forward_from_id` text,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_link_id`) REFERENCES `review_link`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evidence_asset_id`) REFERENCES `media_asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`carried_forward_from_id`) REFERENCES `learning_layer_approval`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_layer_approval_revision_idx` ON `learning_layer_approval` (`revision_id`);--> statement-breakpoint
CREATE TABLE `learning_layer_review_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`learning_layer_id` text NOT NULL,
	`review_type` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`learning_layer_id`) REFERENCES `learning_layer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_layer_review_assignment_idx` ON `learning_layer_review_assignment` (`learning_layer_id`,`review_type`,`reviewer_id`);--> statement-breakpoint
CREATE INDEX `learning_layer_review_assignment_reviewer_idx` ON `learning_layer_review_assignment` (`reviewer_id`);--> statement-breakpoint
CREATE TABLE `learning_layer_submission` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_link` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`recipient` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	FOREIGN KEY (`revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_link_token_idx` ON `review_link` (`token_hash`);--> statement-breakpoint
CREATE INDEX `review_link_revision_idx` ON `review_link` (`revision_id`);--> statement-breakpoint
CREATE TABLE `review_link_access` (
	`id` text PRIMARY KEY NOT NULL,
	`review_link_id` text NOT NULL,
	`outcome` text NOT NULL,
	`accessed_at` integer NOT NULL,
	FOREIGN KEY (`review_link_id`) REFERENCES `review_link`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_link_access_link_idx` ON `review_link_access` (`review_link_id`);--> statement-breakpoint
ALTER TABLE `learning_layer` ADD `current_published_revision_id` text REFERENCES learning_layer_revision(id);--> statement-breakpoint
ALTER TABLE `learning_layer` ADD `publication_state` text DEFAULT 'unpublished' NOT NULL;--> statement-breakpoint
ALTER TABLE `learning_layer` ADD `first_published_at` integer;--> statement-breakpoint
ALTER TABLE `learning_layer` ADD `last_published_at` integer;--> statement-breakpoint
-- Approvals are write-once, a Review Link is only ever revoked, once, and its access log is only
-- added to (ADR-0006). Deleting rows is left to the deletion ledger (ADR-0009).
-- Written by hand: drizzle-kit does not generate triggers.
CREATE TRIGGER `learning_layer_approval_immutable` BEFORE UPDATE ON `learning_layer_approval`
BEGIN
	SELECT RAISE(ABORT, 'Review Approvals are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `review_link_revoke_only` BEFORE UPDATE ON `review_link`
WHEN OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_by IS NULL
	OR NEW.id IS NOT OLD.id OR NEW.revision_id IS NOT OLD.revision_id OR NEW.token_hash IS NOT OLD.token_hash
	OR NEW.recipient IS NOT OLD.recipient OR NEW.created_by IS NOT OLD.created_by
	OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at
BEGIN
	SELECT RAISE(ABORT, 'A Review Link can only be revoked');
END;
--> statement-breakpoint
CREATE TRIGGER `review_link_access_immutable` BEFORE UPDATE ON `review_link_access`
BEGIN
	SELECT RAISE(ABORT, 'The Review Link access log is only added to');
END;
