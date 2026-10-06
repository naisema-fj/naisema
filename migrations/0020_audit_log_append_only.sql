-- The audit log (CMS-05) is only ever added to: nobody, staff or code, can change or remove what
-- it says happened. Written by hand: drizzle-kit does not generate triggers. Pruning events after
-- their retention period (the life of their object plus 2 years) will need a migration of its own.
CREATE TRIGGER `audit_event_no_update` BEFORE UPDATE ON `audit_event`
BEGIN
	SELECT RAISE(ABORT, 'The audit log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_event_no_delete` BEFORE DELETE ON `audit_event`
BEGIN
	SELECT RAISE(ABORT, 'The audit log is append-only');
END;
