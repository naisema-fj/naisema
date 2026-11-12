-- When a Submission was dealt with, so it can be deleted 12 months later, as the privacy notice
-- says (app/lib/forms.ts, NOTICE). Ones already dealt with count from this migration.
ALTER TABLE `submission` ADD `done_at` integer;
--> statement-breakpoint
UPDATE `submission` SET `done_at` = (unixepoch() * 1000) WHERE `done` = 1;
--> statement-breakpoint
CREATE INDEX `submission_done` ON `submission` (`done`,`done_at`);
