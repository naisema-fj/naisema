-- Staff sign in with an emailed link (ADR-0016), replacing Cloudflare Access.
CREATE TABLE `sign_in_link` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sign_in_link_email` ON `sign_in_link` (`email`,`created_at`);
--> statement-breakpoint
CREATE TABLE `staff_session` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_session_email` ON `staff_session` (`email`);
