CREATE TABLE `content_item` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`slug` text NOT NULL,
	`primary_area` text NOT NULL,
	`current_draft_revision_id` text,
	`current_published_revision_id` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`current_draft_revision_id`) REFERENCES `revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_published_revision_id`) REFERENCES `revision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_item_area_slug_idx` ON `content_item` (`primary_area`,`slug`);--> statement-breakpoint
CREATE TABLE `revision` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`number` integer NOT NULL,
	`snapshot` text NOT NULL,
	`restored_from_revision_id` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_item_number_idx` ON `revision` (`content_item_id`,`number`);--> statement-breakpoint
CREATE TABLE `topic` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topic_slug_unique` ON `topic` (`slug`);--> statement-breakpoint
-- Revisions are immutable (ADR-0006). Written by hand: drizzle-kit does not generate triggers.
CREATE TRIGGER `revision_immutable` BEFORE UPDATE ON `revision`
BEGIN
	SELECT RAISE(ABORT, 'Revisions are immutable');
END;
