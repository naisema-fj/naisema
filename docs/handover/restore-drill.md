# Restore drill

The rehearsal that proves a restore works and how long it takes (TECH-04, VTECH-06, VAC-09). Do it on **staging** before launch, then once a year and after any change to backups. Procedure: `docs/handover/runbook.md`, "Backups and restoring". This page is the checklist and the place to record the result.

## Before you start

- [ ] Staging has a nightly backup (look at `/admin/restore` on the staging staff site) and the key is in the password manager.
- [ ] You have a learner account on staging with something saved, and you know its email address.
- [ ] Note the time. Every step below has a line for its time.

## The drill

| # | Step | Started | Done | Notes |
| --- | --- | --- | --- | --- |
| 1 | Sign in to staging as that learner, save a video, and note the time (call it T). | | | |
| 2 | Take a backup now (trigger the 14:20 cron from the dashboard) and confirm it appears at `/admin/restore`. | | | |
| 3 | Delete the learner's account from their learning page. Check the deletion ledger holds an entry (`wrangler r2 object list naisema-staging-ledger --remote`). | | | |
| 4 | `pnpm restore:lock --env staging`. Confirm the public site answers "back shortly" within ten seconds. | | | |
| 5a | **Time Travel restore** to a time before step 3 (`wrangler d1 time-travel restore`). Confirm the learner is back in the database (`wrangler d1 execute`). | | | |
| 5b | **Backup restore** into a new empty database migrated to the backup's migration: download, `pnpm backup:decrypt`, `wrangler d1 execute --file`. Point staging at it. Confirm the learner is back. | | | |
| 6 | Sign in to the staging staff site as an administrator. Open `/admin/restore` and press the replay button. | | | |
| 7 | Confirm: the public site is open; the learner is gone from the database; their old sign-in link does not show their saved video; `/admin/audit` shows `restore.replayed` and `learner_account.deleted`. | | | |
| 8 | Search for an article on the public site and open one. | | | |
| 9 | Delete `backup.sql` and `backup.sql.enc` from your computer. | | | |

Do 5a and 5b as two drills (or one each, on different days); the second restores over the first.

## Result

| | Target | Measured |
| --- | --- | --- |
| RPO: age of the data restored, step 5a (Time Travel) | minutes | |
| RPO: age of the data restored, step 5b (nightly backup) | ≤ 24 hours (as amended by #9) | |
| RTO: step 4 start to step 7 done, step 5a | ≤ 8 hours (as amended by #9) | |
| RTO: step 4 start to step 7 done, step 5b | ≤ 8 hours (as amended by #9) | |

- Date of the drill:
- Done by:
- Problems found, and what was changed in the runbook:
- Confirms VAC-09 (restore part): yes / no
