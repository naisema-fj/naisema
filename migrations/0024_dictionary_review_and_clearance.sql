ALTER TABLE `dictionary_entry` ADD `imported_by` text;--> statement-breakpoint
ALTER TABLE `dictionary_entry` ADD `content_fingerprint` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `dictionary_entry` ADD `approved_fingerprint` text;--> statement-breakpoint
ALTER TABLE `dictionary_entry` ADD `approved_by` text;--> statement-breakpoint
ALTER TABLE `dictionary_entry` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `dictionary_source` ADD `cleared_by` text;--> statement-breakpoint
ALTER TABLE `dictionary_source` ADD `cleared_at` integer;--> statement-breakpoint
ALTER TABLE `dictionary_source` ADD `clearance_note` text;