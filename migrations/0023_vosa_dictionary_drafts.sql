CREATE TABLE `dictionary_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`headword` text NOT NULL,
	`headword_key` text NOT NULL,
	`meaning` text NOT NULL,
	`literal_meaning` text,
	`part_of_speech` text DEFAULT '' NOT NULL,
	`themes` text NOT NULL,
	`source_ids` text NOT NULL,
	`apps_status` text DEFAULT '' NOT NULL,
	`review_state` text DEFAULT 'needs_review' NOT NULL,
	`details` text NOT NULL,
	`import_batch` text NOT NULL,
	`imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dictionary_entry_headword_idx` ON `dictionary_entry` (`headword_key`);--> statement-breakpoint
CREATE TABLE `dictionary_source` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`coverage` text DEFAULT '' NOT NULL,
	`pages` integer,
	`web_url` text,
	`import_batch` text NOT NULL,
	`imported_at` integer NOT NULL
);
