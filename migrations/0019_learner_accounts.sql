CREATE TABLE `activity_attempt` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`learning_layer_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`activity_fingerprint` text NOT NULL,
	`correct` integer,
	`attempted_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learning_layer_id`) REFERENCES `learning_layer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_attempt_layer_idx` ON `activity_attempt` (`user_id`,`learning_layer_id`);--> statement-breakpoint
CREATE TABLE `bookmark` (
	`user_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`saved_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `content_item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deletion_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject_hash` text NOT NULL,
	`reason` text NOT NULL,
	`deleted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learner_account` (
	`user_id` text PRIMARY KEY NOT NULL,
	`adult_declared_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`inactivity_warned_at` integer,
	`preferences` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `learner_account_last_active_idx` ON `learner_account` (`last_active_at`);--> statement-breakpoint
CREATE TABLE `learner_event` (
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`received_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `learner_event_received_idx` ON `learner_event` (`received_at`);--> statement-breakpoint
CREATE TABLE `learner_rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learner_rate_limit_key_unique` ON `learner_rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `learner_sign_in_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_hash` text NOT NULL,
	`sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learner_sign_in_link_email_idx` ON `learner_sign_in_link` (`email_hash`,`sent_at`);--> statement-breakpoint
CREATE TABLE `learner_video_state` (
	`user_id` text NOT NULL,
	`learning_layer_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`stage` text NOT NULL,
	`position_ms` integer DEFAULT 0 NOT NULL,
	`segment_id` text,
	`visited` text DEFAULT '[]' NOT NULL,
	`captions` text DEFAULT '{}' NOT NULL,
	`real_world` text DEFAULT '{}' NOT NULL,
	`completed_at` integer,
	`completed_revision_id` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `learning_layer_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`learning_layer_id`) REFERENCES `learning_layer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learner_video_state_updated_idx` ON `learner_video_state` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `saved_vocabulary` (
	`user_id` text NOT NULL,
	`expression_id` text NOT NULL,
	`source_revision_id` text NOT NULL,
	`learning_layer_id` text NOT NULL,
	`saved_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `expression_id`, `source_revision_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expression_id`) REFERENCES `expression`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`learning_layer_id`) REFERENCES `learning_layer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- The deletion ledger is only ever added to (ADR-0009). Written by hand: drizzle-kit does not generate triggers.
CREATE TRIGGER `deletion_ledger_no_update` BEFORE UPDATE ON `deletion_ledger`
BEGIN
	SELECT RAISE(ABORT, 'The deletion ledger is only added to');
END;
--> statement-breakpoint
CREATE TRIGGER `deletion_ledger_no_delete` BEFORE DELETE ON `deletion_ledger`
BEGIN
	SELECT RAISE(ABORT, 'The deletion ledger is only added to');
END;
