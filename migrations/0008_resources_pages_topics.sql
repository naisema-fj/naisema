CREATE TABLE `link_report` (
	`content_item_id` text NOT NULL,
	`reporter_key` text NOT NULL,
	`reported_at` integer NOT NULL,
	PRIMARY KEY(`content_item_id`, `reporter_key`),
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `topic` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `topic` ADD `parent_topic_id` text REFERENCES topic(id);--> statement-breakpoint
ALTER TABLE `topic` ADD `lead_item_id` text REFERENCES content_item(id);