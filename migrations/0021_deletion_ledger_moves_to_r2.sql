-- The deletion ledger moves out of this database, into its own private R2 bucket (ADR-0009,
-- app/lib/deletion-ledger.server.ts), so restoring this database can't roll it back. Before launch
-- there are no real learners, so the few entries made while it lived here are not carried over.
-- Dropping the table drops its append-only triggers with it.
DROP TABLE `deletion_ledger`;
