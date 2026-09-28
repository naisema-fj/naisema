# A deletion ledger is replayed after every restore

Backups (D1 Time Travel and nightly exports to R2) necessarily contain data for learners and contributors who later asked to be deleted, and PRD §11 requires that a restored backup reapply deletion records. We keep an append-only deletion ledger of hashed user IDs and deleted object IDs, stored separately from the data it governs, and every restore procedure replays it before the restored environment serves traffic. IDs are hashed so the ledger itself does not retain identifiable data about the people who asked to be forgotten.
