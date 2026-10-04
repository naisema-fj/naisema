CREATE TABLE `media_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`status` text NOT NULL,
	`status_reason` text,
	`quarantine_key` text NOT NULL,
	`multipart_upload_id` text,
	`destination_key` text NOT NULL,
	`alt_text` text DEFAULT '' NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`scanned_at` integer,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_asset_purpose_idx` ON `media_asset` (`purpose`,`created_at`);--> statement-breakpoint
CREATE INDEX `media_asset_status_idx` ON `media_asset` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `media_upload_part` (
	`asset_id` text NOT NULL,
	`part_number` integer NOT NULL,
	`etag` text NOT NULL,
	`size` integer NOT NULL,
	PRIMARY KEY(`asset_id`, `part_number`),
	FOREIGN KEY (`asset_id`) REFERENCES `media_asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `rights_record` ADD `evidence_asset_id` text REFERENCES media_asset(id);--> statement-breakpoint
-- The withdraw-only rule (migrations/0004) now also covers evidence_asset_id. Written by hand:
-- drizzle-kit does not generate triggers.
DROP TRIGGER `rights_record_withdraw_only`;
--> statement-breakpoint
CREATE TRIGGER `rights_record_withdraw_only` BEFORE UPDATE ON `rights_record`
WHEN OLD.withdrawn_at IS NOT NULL OR NEW.withdrawn_at IS NULL
	OR NEW.id IS NOT OLD.id OR NEW.subject_type IS NOT OLD.subject_type OR NEW.subject_id IS NOT OLD.subject_id
	OR NEW.rights_holder IS NOT OLD.rights_holder OR NEW.permitted_uses IS NOT OLD.permitted_uses
	OR NEW.guardian_permission IS NOT OLD.guardian_permission OR NEW.evidence_key IS NOT OLD.evidence_key
	OR NEW.evidence_name IS NOT OLD.evidence_name OR NEW.evidence_type IS NOT OLD.evidence_type
	OR NEW.expires_at IS NOT OLD.expires_at OR NEW.evidence_asset_id IS NOT OLD.evidence_asset_id OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'Rights Records can only be withdrawn');
END;
