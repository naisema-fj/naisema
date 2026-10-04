CREATE TABLE `learning_layer` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`language_variety` text NOT NULL,
	`current_draft_revision_id` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_draft_revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_layer_item_idx` ON `learning_layer` (`content_item_id`);--> statement-breakpoint
CREATE TABLE `learning_layer_educator` (
	`learning_layer_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` integer NOT NULL,
	PRIMARY KEY(`learning_layer_id`, `user_id`),
	FOREIGN KEY (`learning_layer_id`) REFERENCES `learning_layer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_layer_educator_user_idx` ON `learning_layer_educator` (`user_id`);--> statement-breakpoint
CREATE TABLE `learning_layer_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`learning_layer_id` text NOT NULL,
	`number` integer NOT NULL,
	`snapshot` text NOT NULL,
	`fingerprints` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`learning_layer_id`) REFERENCES `learning_layer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_layer_revision_number_idx` ON `learning_layer_revision` (`learning_layer_id`,`number`);--> statement-breakpoint
CREATE TABLE `video_educator` (
	`content_item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` integer NOT NULL,
	PRIMARY KEY(`content_item_id`, `user_id`),
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `video_educator_user_idx` ON `video_educator` (`user_id`);--> statement-breakpoint
-- Learning Layer Revisions are write-once, like Content Item Revisions (ADR-0006).
CREATE TRIGGER `learning_layer_revision_immutable` BEFORE UPDATE ON `learning_layer_revision`
BEGIN
	SELECT RAISE(ABORT, 'Revisions are immutable');
END;
