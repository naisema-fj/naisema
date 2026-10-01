CREATE TABLE `search_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_item_id` text NOT NULL,
	`primary_area` text NOT NULL,
	`format` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`tags` text NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_entry_content_item_id_unique` ON `search_entry` (`content_item_id`);--> statement-breakpoint
CREATE INDEX `search_entry_area_idx` ON `search_entry` (`primary_area`,`format`);--> statement-breakpoint
CREATE TABLE `search_entry_topic` (
	`content_item_id` text NOT NULL,
	`topic_id` text NOT NULL,
	PRIMARY KEY(`content_item_id`, `topic_id`),
	FOREIGN KEY (`content_item_id`) REFERENCES `content_item`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topic`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `search_entry_topic_topic_idx` ON `search_entry_topic` (`topic_id`);--> statement-breakpoint
-- The full-text index over search_entry (PUB-03). Written by hand: drizzle-kit does not generate
-- virtual tables or triggers. Diacritics are folded, so "a" finds "ā".
CREATE VIRTUAL TABLE `search_fts` USING fts5(
	title, summary, tags,
	content='search_entry', content_rowid='id',
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `search_entry_fts_insert` AFTER INSERT ON `search_entry`
BEGIN
	INSERT INTO `search_fts` (rowid, title, summary, tags) VALUES (NEW.id, NEW.title, NEW.summary, NEW.tags);
END;
--> statement-breakpoint
CREATE TRIGGER `search_entry_fts_delete` AFTER DELETE ON `search_entry`
BEGIN
	INSERT INTO `search_fts` (`search_fts`, rowid, title, summary, tags) VALUES ('delete', OLD.id, OLD.title, OLD.summary, OLD.tags);
END;
--> statement-breakpoint
CREATE TRIGGER `search_entry_fts_update` AFTER UPDATE ON `search_entry`
BEGIN
	INSERT INTO `search_fts` (`search_fts`, rowid, title, summary, tags) VALUES ('delete', OLD.id, OLD.title, OLD.summary, OLD.tags);
	INSERT INTO `search_fts` (rowid, title, summary, tags) VALUES (NEW.id, NEW.title, NEW.summary, NEW.tags);
END;
--> statement-breakpoint
-- Index what was already published. Eligibility isn't evaluated here: search re-checks every hit
-- and drops any entry that isn't eligible (app/lib/search.server.ts).
INSERT INTO `search_entry` (`content_item_id`, `primary_area`, `format`, `title`, `summary`, `tags`, `published_at`)
SELECT c.`id`, c.`primary_area`, c.`type`,
	json_extract(r.`snapshot`, '$.title'), json_extract(r.`snapshot`, '$.summary'),
	coalesce((SELECT group_concat(t.`name`, ', ') FROM json_each(r.`snapshot`, '$.topicIds') j JOIN `topic` t ON t.`id` = j.`value`), ''),
	c.`last_published_at`
FROM `content_item` c JOIN `revision` r ON r.`id` = c.`current_published_revision_id`
WHERE c.`publication_state` = 'published' AND c.`type` = 'article';
--> statement-breakpoint
INSERT INTO `search_entry_topic` (`content_item_id`, `topic_id`)
SELECT c.`id`, t.`id`
FROM `content_item` c JOIN `revision` r ON r.`id` = c.`current_published_revision_id`
JOIN json_each(r.`snapshot`, '$.topicIds') j JOIN `topic` t ON t.`id` = j.`value`
WHERE c.`publication_state` = 'published' AND c.`type` = 'article';
