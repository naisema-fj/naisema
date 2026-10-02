CREATE TABLE `case_evidence` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`added_by` text NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `media_asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`case_id`) REFERENCES `case_record`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `case_evidence_case_idx` ON `case_evidence` (`case_id`);--> statement-breakpoint
CREATE TABLE `case_record` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`form_key` text,
	`state` text DEFAULT 'received' NOT NULL,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`content_item_id` text,
	`affected_person` text DEFAULT '' NOT NULL,
	`reporter_name` text DEFAULT '' NOT NULL,
	`reporter_email` text,
	`severity` text,
	`owner_id` text,
	`outcome` text,
	`action` text,
	`rationale` text,
	`decided_by` text,
	`decided_at` integer,
	`appeal_reasons` text,
	`appealed_at` integer,
	`appeal_outcome` text,
	`appeal_rationale` text,
	`appeal_decided_by` text,
	`appeal_decided_at` integer,
	`received_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`closed_at` integer,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_record_form_key_unique` ON `case_record` (`form_key`);--> statement-breakpoint
CREATE INDEX `case_record_queue_idx` ON `case_record` (`kind`,`state`,`received_at`);--> statement-breakpoint
CREATE TABLE `content_hold` (
	`id` text PRIMARY KEY NOT NULL,
	`content_item_id` text NOT NULL,
	`case_id` text NOT NULL,
	`placed_by` text NOT NULL,
	`placed_at` integer NOT NULL,
	`lifted_by` text,
	`lifted_at` integer,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`case_id`) REFERENCES `case_record`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `content_hold_item_idx` ON `content_hold` (`content_item_id`);--> statement-breakpoint
-- A hold is only ever lifted, once (db/schema.ts, contentHold).
CREATE TRIGGER `content_hold_lift_only` BEFORE UPDATE ON `content_hold`
WHEN OLD.lifted_at IS NOT NULL OR NEW.lifted_at IS NULL OR NEW.lifted_by IS NULL
	OR NEW.id IS NOT OLD.id OR NEW.content_item_id IS NOT OLD.content_item_id OR NEW.case_id IS NOT OLD.case_id
	OR NEW.placed_by IS NOT OLD.placed_by OR NEW.placed_at IS NOT OLD.placed_at
BEGIN
	SELECT RAISE(ABORT, 'A hold can only be lifted');
END;
--> statement-breakpoint
CREATE TRIGGER `content_hold_never_removed` BEFORE DELETE ON `content_hold`
BEGIN
	SELECT RAISE(ABORT, 'Holds are lifted, never removed');
END;
