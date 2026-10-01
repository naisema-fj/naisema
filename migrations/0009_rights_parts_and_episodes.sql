ALTER TABLE `rights_record` ADD `part_kind` text;--> statement-breakpoint
ALTER TABLE `rights_record` ADD `part_name` text;--> statement-breakpoint
-- The withdraw-only rule (migrations/0004, 0007) now also covers part_kind and part_name. Written by
-- hand: drizzle-kit does not generate triggers.
DROP TRIGGER `rights_record_withdraw_only`;--> statement-breakpoint
CREATE TRIGGER `rights_record_withdraw_only` BEFORE UPDATE ON `rights_record`
WHEN OLD.withdrawn_at IS NOT NULL OR NEW.withdrawn_at IS NULL
	OR NEW.id IS NOT OLD.id OR NEW.subject_type IS NOT OLD.subject_type OR NEW.subject_id IS NOT OLD.subject_id
	OR NEW.part_kind IS NOT OLD.part_kind OR NEW.part_name IS NOT OLD.part_name
	OR NEW.rights_holder IS NOT OLD.rights_holder OR NEW.permitted_uses IS NOT OLD.permitted_uses
	OR NEW.guardian_permission IS NOT OLD.guardian_permission OR NEW.evidence_key IS NOT OLD.evidence_key
	OR NEW.evidence_name IS NOT OLD.evidence_name OR NEW.evidence_type IS NOT OLD.evidence_type
	OR NEW.evidence_asset_id IS NOT OLD.evidence_asset_id
	OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'Rights Records can only be withdrawn');
END;
