-- A Review Link can now show a Content Item Revision as well as a Learning Layer Revision, exactly
-- one of the two, so `revision_id` loses its NOT NULL. SQLite can only do that by rebuilding the table.
-- D1 ignores PRAGMA foreign_keys, and other tables' rows point at review_link, so the rows are kept
-- aside, the table dropped and recreated, and the rows put back, with the foreign key checks
-- deferred to the end of the migration, by when every row they point at is back.
PRAGMA defer_foreign_keys = on;--> statement-breakpoint
CREATE TABLE `review_link_keep` AS SELECT * FROM `review_link`;--> statement-breakpoint
DROP TABLE `review_link`;--> statement-breakpoint
CREATE TABLE `review_link` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text,
	`content_revision_id` text,
	`token_hash` text NOT NULL,
	`recipient` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`revoked_by` text,
	FOREIGN KEY (`revision_id`) REFERENCES `learning_layer_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`content_revision_id`) REFERENCES `revision`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "review_link_one_revision" CHECK((`revision_id` IS NULL) != (`content_revision_id` IS NULL))
);
--> statement-breakpoint
INSERT INTO `review_link`("id", "revision_id", "token_hash", "recipient", "created_by", "created_at", "expires_at", "revoked_at", "revoked_by") SELECT "id", "revision_id", "token_hash", "recipient", "created_by", "created_at", "expires_at", "revoked_at", "revoked_by" FROM `review_link_keep`;--> statement-breakpoint
DROP TABLE `review_link_keep`;--> statement-breakpoint
CREATE UNIQUE INDEX `review_link_token_idx` ON `review_link` (`token_hash`);--> statement-breakpoint
CREATE INDEX `review_link_revision_idx` ON `review_link` (`revision_id`);--> statement-breakpoint
CREATE INDEX `review_link_content_revision_idx` ON `review_link` (`content_revision_id`);--> statement-breakpoint
ALTER TABLE `review_approval` ADD `review_link_id` text REFERENCES review_link(id);--> statement-breakpoint
ALTER TABLE `review_approval` ADD `evidence_asset_id` text REFERENCES media_asset(id);--> statement-breakpoint
ALTER TABLE `review_approval` ADD `evidence_key` text;--> statement-breakpoint
ALTER TABLE `review_approval` ADD `evidence_name` text;--> statement-breakpoint
ALTER TABLE `review_approval` ADD `evidence_type` text;
--> statement-breakpoint
-- The rebuild dropped the table's trigger: a Review Link is still only ever revoked, once (ADR-0006).
-- Written by hand: drizzle-kit does not generate triggers.
CREATE TRIGGER `review_link_revoke_only` BEFORE UPDATE ON `review_link`
WHEN OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_by IS NULL
	OR NEW.id IS NOT OLD.id OR NEW.revision_id IS NOT OLD.revision_id OR NEW.content_revision_id IS NOT OLD.content_revision_id
	OR NEW.token_hash IS NOT OLD.token_hash
	OR NEW.recipient IS NOT OLD.recipient OR NEW.created_by IS NOT OLD.created_by
	OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at
BEGIN
	SELECT RAISE(ABORT, 'A Review Link can only be revoked');
END;
