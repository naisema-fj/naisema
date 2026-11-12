-- A Safeguarding Lead can hold a Content Item off the public site while a Report about it is
-- looked into, without withdrawing it; releasing the hold puts it back if it is still eligible.
ALTER TABLE `content_item` ADD `held_at` integer;
--> statement-breakpoint
ALTER TABLE `content_item` ADD `held_by` text;
--> statement-breakpoint
ALTER TABLE `content_item` ADD `held_reason` text;
