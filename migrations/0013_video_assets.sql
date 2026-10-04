CREATE TABLE `video_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`master_key` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text,
	`state` text NOT NULL,
	`state_reason` text,
	`duration_ms` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`orientation` text NOT NULL,
	`environment` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ready_at` integer,
	FOREIGN KEY (`id`) REFERENCES `media_asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_asset_provider_idx` ON `video_asset` (`provider`,`provider_id`);--> statement-breakpoint
CREATE INDEX `video_asset_state_idx` ON `video_asset` (`state`,`updated_at`);--> statement-breakpoint
-- A Video Asset's state only moves forwards (app/lib/video-rules.ts canMoveVideo), whatever order
-- the provider's reports arrive in; a failure may be tried again from the start.
CREATE TRIGGER `video_asset_state_forwards` BEFORE UPDATE OF `state` ON `video_asset`
WHEN NEW.`state` <> OLD.`state` AND NOT (
  (OLD.`state` = 'uploaded' AND NEW.`state` IN ('processing', 'ready', 'failed'))
  OR (OLD.`state` = 'processing' AND NEW.`state` IN ('ready', 'failed'))
  OR (OLD.`state` = 'failed' AND NEW.`state` = 'uploaded')
)
BEGIN
  SELECT RAISE(ABORT, 'A Video Asset''s state only moves forwards.');
END;
