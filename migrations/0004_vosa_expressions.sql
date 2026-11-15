-- Vosa on the Expression library (change note 0002, ADR-0017). An Expression gains what Vosa shows
-- (its kind, part of speech, notes, examples and roles, citations and themes), its address under
-- /vosa/, the text a search matches, and who wrote its current wording. Each language review of an
-- Expression is an `expression_review` of one exact wording, held by its fingerprint.
ALTER TABLE `expression` ADD `kind` text DEFAULT 'word' NOT NULL CHECK (`kind` in ('word', 'grammar-term', 'saying'));
--> statement-breakpoint
ALTER TABLE `expression` ADD `slug` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `expression` ADD `part_of_speech` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `expression` ADD `notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `expression` ADD `details` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `expression` ADD `citations` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `expression` ADD `themes` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `expression` ADD `search_text` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `expression` ADD `updated_by` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `expression` SET `updated_by` = `created_by`;
--> statement-breakpoint
-- Expressions made in the Learning Layer editor before this: their address and search text, as near
-- to `vosaSlug` and `searchText` (app/lib/vosa.ts) as SQL can make them. The editor sets both from now on.
UPDATE `expression` SET `slug` = lower(replace(trim(`headword`), ' ', '-')), `search_text` = lower(`headword` || ' | ' || `general_meaning` || ' | ' || `literal_meaning` || ' | ' || `grammar_note`) WHERE `slug` = '';
--> statement-breakpoint
CREATE INDEX `expression_slug` ON `expression` (`variety`,`slug`);
--> statement-breakpoint
CREATE TABLE `expression_review` (
	`id` text PRIMARY KEY NOT NULL,
	`expression_id` text NOT NULL,
	`variety` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reviewer_email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`expression_id`) REFERENCES `expression`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `expression_review_expression` ON `expression_review` (`expression_id`);
