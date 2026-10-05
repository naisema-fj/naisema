CREATE TABLE `email_failure` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subject` text NOT NULL,
	`failed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_failure_failed_at_idx` ON `email_failure` (`failed_at`);--> statement-breakpoint
CREATE TABLE `job_run` (
	`id` text PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`ok` integer,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `job_run_job_idx` ON `job_run` (`job`,`started_at`);--> statement-breakpoint
CREATE TABLE `monitor_alert` (
	`check` text PRIMARY KEY NOT NULL,
	`failing_since` integer NOT NULL,
	`last_alerted_at` integer NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage_month` (
	`month` text PRIMARY KEY NOT NULL,
	`stored_minutes` real NOT NULL,
	`delivered_minutes` real NOT NULL,
	`r2_bytes` integer NOT NULL,
	`projected_aud` real NOT NULL,
	`recorded_at` integer NOT NULL,
	`budget_alert_percent` integer DEFAULT 0 NOT NULL
);
