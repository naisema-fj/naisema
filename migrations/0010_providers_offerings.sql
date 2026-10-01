CREATE TABLE `offering` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`language_variety` text DEFAULT '' NOT NULL,
	`level` text NOT NULL,
	`age_suitability` text NOT NULL,
	`accessibility` text DEFAULT '' NOT NULL,
	`format` text NOT NULL,
	`cost` text NOT NULL,
	`cost_kind` text NOT NULL,
	`starts_on` text DEFAULT '' NOT NULL,
	`ends_on` text DEFAULT '' NOT NULL,
	`access` text NOT NULL,
	`access_mode` text NOT NULL,
	`enrolment_by` text NOT NULL,
	`support_by` text NOT NULL,
	`listed` integer DEFAULT false NOT NULL,
	`sponsored_by` text,
	`feature_rationale` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `offering_provider_idx` ON `offering` (`provider_id`);--> statement-breakpoint
CREATE TABLE `partnership_agreement` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`reference` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`ended_at` integer,
	`ended_by` text,
	`recorded_by` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `partnership_agreement_provider_idx` ON `partnership_agreement` (`provider_id`);--> statement-breakpoint
CREATE TABLE `provider` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`organisation_type` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`contact_route` text DEFAULT '' NOT NULL,
	`last_checked_on` text NOT NULL,
	`listed` integer DEFAULT false NOT NULL,
	`sponsored_by` text,
	`feature_rationale` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_slug_unique` ON `provider` (`slug`);