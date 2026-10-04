CREATE TABLE `consent_record` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`notice_id` text NOT NULL,
	`email` text NOT NULL,
	`source_form` text NOT NULL,
	`submission_id` text,
	`given_at` integer NOT NULL,
	`withdrawn_at` integer,
	`withdrawn_via` text,
	FOREIGN KEY (`notice_id`) REFERENCES `notice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consent_record_email_idx` ON `consent_record` (`email`,`purpose`);--> statement-breakpoint
CREATE TABLE `newsletter_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`email` text NOT NULL,
	`tags` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notice` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`version` integer NOT NULL,
	`wording` text NOT NULL,
	`published_by` text,
	`published_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notice_purpose_version_idx` ON `notice` (`purpose`,`version`);--> statement-breakpoint
CREATE TABLE `submission` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`form_key` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`fields` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`owner_id` text,
	`due_on` text NOT NULL,
	`confirmed_at` integer,
	`received_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_form_key_unique` ON `submission` (`form_key`);--> statement-breakpoint
CREATE INDEX `submission_queue_idx` ON `submission` (`status`,`due_on`);--> statement-breakpoint
CREATE TABLE `upload_link` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`issued_by` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`submission_id`) REFERENCES `submission`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_link_token_hash_unique` ON `upload_link` (`token_hash`);--> statement-breakpoint
CREATE INDEX `upload_link_submission_idx` ON `upload_link` (`submission_id`);--> statement-breakpoint
CREATE TABLE `upload_link_file` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`link_id` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `media_asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`link_id`) REFERENCES `upload_link`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- Notices are content: a new version is added, and none is ever changed or removed, so the exact
-- wording anyone agreed to stays recoverable (docs/phase-1a-defaults.md §4).
CREATE TRIGGER `notice_never_changes` BEFORE UPDATE ON `notice`
BEGIN
	SELECT RAISE(ABORT, 'Notices are never changed: publish a new version');
END;
--> statement-breakpoint
CREATE TRIGGER `notice_never_removed` BEFORE DELETE ON `notice`
BEGIN
	SELECT RAISE(ABORT, 'Notices are never removed');
END;
--> statement-breakpoint
-- A Consent Record only ever gains its withdrawal.
CREATE TRIGGER `consent_record_withdraw_only` BEFORE UPDATE ON `consent_record`
WHEN OLD.withdrawn_at IS NOT NULL OR NEW.withdrawn_at IS NULL OR NEW.withdrawn_via IS NULL
	OR NEW.id IS NOT OLD.id OR NEW.purpose IS NOT OLD.purpose OR NEW.notice_id IS NOT OLD.notice_id
	OR NEW.email IS NOT OLD.email OR NEW.source_form IS NOT OLD.source_form
	OR NEW.submission_id IS NOT OLD.submission_id OR NEW.given_at IS NOT OLD.given_at
BEGIN
	SELECT RAISE(ABORT, 'Consent Records can only be withdrawn');
END;
--> statement-breakpoint
-- The first version of each notice (docs/decision-log.md, consent notices), until the privacy
-- contact publishes another.
INSERT INTO `notice` (`id`, `purpose`, `version`, `wording`, `published_by`, `published_at`) VALUES
	('notice-reply-1', 'reply', 1, 'Na iSema keeps what you send on this form, with your name and email address, so that we can read it and reply to you. Only Na iSema staff see it, and it is never published. We delete it 12 months after we have dealt with it, or sooner if you ask. You can withdraw this agreement at any time with the link in the email we send you, and ask to see or delete what we hold through our Privacy page.', NULL, 1790812800000),
	('notice-consultation-1', 'consultation', 1, 'Na iSema may email you to invite you to take part in its consultations, in the ways you have chosen. Taking part is always your choice. We keep your details for this until you withdraw, and what you tell us in a consultation for 12 months after we have analysed it. You can withdraw at any time with the link in the email we send you.', NULL, 1790812800000),
	('notice-newsletter-1', 'newsletter', 1, 'Na iSema will add your email address to its newsletter list, which is kept by an outside newsletter service. The service will email you first to check you want the newsletter, and nothing is sent unless you confirm. Every newsletter has a link to unsubscribe, and you can also unsubscribe on our Newsletter page at any time.', NULL, 1790812800000);
