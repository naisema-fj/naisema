CREATE TABLE `review_approval` (
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
	`carried_forward_from_id` text,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`carried_forward_from_id`) REFERENCES `review_approval`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_approval_revision_idx` ON `review_approval` (`revision_id`);--> statement-breakpoint
CREATE TABLE `review_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`review_type` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` integer NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_assignment_item_type_reviewer_idx` ON `review_assignment` (`content_item_id`,`review_type`,`reviewer_id`);--> statement-breakpoint
CREATE TABLE `revision_submission` (
	`revision_id` text PRIMARY KEY NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `revision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `content_item` ADD `publication_state` text DEFAULT 'unpublished' NOT NULL;--> statement-breakpoint
ALTER TABLE `revision` ADD `fingerprints` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Review Approvals are write-once, like Revisions (ADR-0006). Written by hand: drizzle-kit does not generate triggers.
CREATE TRIGGER `review_approval_immutable` BEFORE UPDATE ON `review_approval`
BEGIN
	SELECT RAISE(ABORT, 'Review Approvals are immutable');
END;
