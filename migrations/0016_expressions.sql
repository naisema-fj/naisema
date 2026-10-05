CREATE TABLE `expression` (
	`id` text PRIMARY KEY NOT NULL,
	`language_variety` text NOT NULL,
	`headword` text NOT NULL,
	`headword_key` text NOT NULL,
	`general_meaning` text NOT NULL,
	`grammar_note` text DEFAULT '' NOT NULL,
	`pronunciation` text DEFAULT '' NOT NULL,
	`literal_meaning` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expression_headword_idx` ON `expression` (`language_variety`,`headword_key`);