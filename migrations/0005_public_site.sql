CREATE TABLE `slug_redirect` (
	`primary_area` text NOT NULL,
	`slug` text NOT NULL,
	`content_item_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`primary_area`, `slug`),
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `content_item` ADD `first_published_at` integer;--> statement-breakpoint
ALTER TABLE `content_item` ADD `last_published_at` integer;