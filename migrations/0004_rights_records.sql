CREATE TABLE `contributor` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rights_expiry_warning` (
	`rights_record_id` text NOT NULL,
	`within_days` integer NOT NULL,
	`sent_at` integer NOT NULL,
	PRIMARY KEY(`rights_record_id`, `within_days`),
	FOREIGN KEY (`rights_record_id`) REFERENCES `rights_record`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rights_record` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`rights_holder` text NOT NULL,
	`permitted_uses` text NOT NULL,
	`guardian_permission` integer DEFAULT false NOT NULL,
	`evidence_key` text NOT NULL,
	`evidence_name` text NOT NULL,
	`evidence_type` text NOT NULL,
	`expires_at` integer,
	`withdrawn_at` integer,
	`withdrawn_by` text,
	`withdrawal_reason` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rights_record_subject_idx` ON `rights_record` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `rights_record_contributor` (
	`rights_record_id` text NOT NULL,
	`contributor_id` text NOT NULL,
	PRIMARY KEY(`rights_record_id`, `contributor_id`),
	FOREIGN KEY (`rights_record_id`) REFERENCES `rights_record`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contributor_id`) REFERENCES `contributor`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- A Rights Record is never edited; the only change allowed is withdrawing it, once, with who and why
-- (CMS-03/04). Deleting rows is left to the deletion ledger (ADR-0009).
-- Written by hand: drizzle-kit does not generate triggers.
CREATE TRIGGER `rights_record_withdraw_only` BEFORE UPDATE ON `rights_record`
WHEN OLD.withdrawn_at IS NOT NULL OR NEW.withdrawn_at IS NULL
	OR NEW.id IS NOT OLD.id OR NEW.subject_type IS NOT OLD.subject_type OR NEW.subject_id IS NOT OLD.subject_id
	OR NEW.rights_holder IS NOT OLD.rights_holder OR NEW.permitted_uses IS NOT OLD.permitted_uses
	OR NEW.guardian_permission IS NOT OLD.guardian_permission OR NEW.evidence_key IS NOT OLD.evidence_key
	OR NEW.evidence_name IS NOT OLD.evidence_name OR NEW.evidence_type IS NOT OLD.evidence_type
	OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'Rights Records can only be withdrawn');
END;
