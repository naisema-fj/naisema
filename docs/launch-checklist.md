# Phase 1a launch checklist

One page listing everything between the current code and a live NAISEMA, as of 9 November 2026. Tick items here and close the matching GitHub issue when each is done. The code for Phase 1a is built; what remains is people, accounts, rehearsals and sign-offs.

Source of truth for each item is the linked issue, `docs/decision-log.md` and `docs/handover/`.

## 1. People and agreements (blockers)

- [ ] **#5** Backup Safeguarding Lead and independent appeal reviewer named, proposed from the initial Advisory Circle. _Owner: Natasha Mar._ Until then appeals wait on one person.
- [ ] **#6** Backup technical owner for alerts named; add them to `ALERT_EMAILS`. _Owner: Natasha Mar._
- [ ] **#7** Qualified Language Reviewer for Standard Fijian confirmed; qualification and variety recorded in the decision log (LEARN-01). _Owner: Natasha Mar._ Without one, nothing in Learn can be reviewed.
- [ ] **#8** Seed Collection Educator named (not the Language Reviewer) and three seed clips secured with Rights Records. _Owner: Natasha Mar._ The Educator uses `docs/handover/educator-guide.md`.
- [ ] **#9** Post-launch support agreement signed (MOU §10); PRD TECH-04 targets amended to match (the restore drill already measures against ≤24 h RPO and ≤8 h RTO "as amended by #9"). _Owners: Natasha Mar, Taia Tiniyara._
- [ ] **#10** Privacy adviser sign-off on the overseas-processing disclosure (ADR-0004), plus their answer on whether the analytics need a consent banner and on the retention defaults. _Owner: Natasha Mar._

## 2. Written scope and legal

- [ ] **#3** Written Phase 1a scope confirmation and the remaining §12 component approvals: hls.js, Tiptap core, ClamAV, Cloudflare Stream, Images and Containers.
- [ ] MOU amendments from the decision log signed: §3 scope, §1 purpose, §10 support, §4 assignment.
- [ ] MOU governing law (§14) settled after cross-border legal advice (proposal in `docs/phase-1a-defaults.md` §12).
- [ ] **#65** Phase 1b scope confirmed in writing (after launch; not a blocker).

## 3. Accounts and production setup

Fill in the "Who holds the account" column of `docs/handover/vendors-and-accounts.md` as you go. Never record a secret there.

- [ ] Cloudflare account holder recorded; Workers paid plan active.
- [ ] **Stream account created.** None exists yet, so the video pipeline cannot run in production.
- [ ] Production secrets set (`pnpm wrangler secret put NAME --env production`): `BETTER_AUTH_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `BACKUP_ENCRYPTION_KEY` (copy in the password manager), `BUTTONDOWN_API_KEY`, the Stream secrets listed in the vendor page, `MONITORING_API_TOKEN`, `ALERT_EMAILS`, and optionally `CACHE_PURGE_TOKEN`.
- [ ] `TURNSTILE_SITE_KEY` in `wrangler.jsonc` is the Cloudflare test key (`1x0000…AA`); confirm production uses the real one.
- [ ] GitHub `production` environment has `CLOUDFLARE_API_TOKEN` and a required reviewer.
- [ ] Domain registrar, GitHub organisation, Buttondown and password-manager owners recorded.
- [ ] Email Service sends from `no-reply@naisema.com`; a sign-in link arrives in a real inbox.
- [ ] Cloudflare billing alerts at 50% and 80% of the AUD 100 monthly ceiling (#20).

## 4. Decisions

- [ ] **#20** External uptime monitor chosen (UptimeRobot or Better Stack), configured on public URLs only every 5 minutes, alerting the technical owner and backup. Record the choice in `docs/decision-log.md` and `docs/handover/vendors-and-accounts.md`. **Open.**
- [x] **#64** Second copy of video masters: **yes**, periodic copy outside Cloudflare (decided 9 November 2026). Still to do: choose the destination, set up the copy, run it once and restore from it. See the decision log and the "Source masters" section of the runbook.

## 5. Rehearsals on staging

- [ ] **#34** Restore drill completed and its result table filled in (`docs/handover/restore-drill.md`). Both Time Travel (5a) and backup (5b) paths.
- [ ] **#62** AC-08 rehearsal completed from the founder admin guide (`docs/handover/admin-guide.md`) by the founder, not the developer.
- [ ] **#21** Search load test passes (p95 ≤ 2 s, 5,000 seeded items) against staging: `pnpm search:load-test`. Parameters are in `scripts/search-load-test.mjs`.
- [ ] **#4** Stream playback and segment-timing spike results reviewed and accepted (`docs/spikes/stream-timing.md`).
- [ ] Staging alert path tested: trigger a monitor failure and confirm the email reaches both the technical owner and the backup.
- [ ] Unpublishing removes search results within 15 minutes (AC-03) checked on staging.

## 6. Content readiness

- [ ] Content inventory taken and the Voices interview lead confirmed (decision log, "Open, not blocking the build baseline"; process in `docs/phase-1a-defaults.md` §13).
- [ ] At least the Seed Collection published through the real review gates: a Language Review Approval on each Learning Layer and a current Rights Record for each clip.
- [ ] Footer Pages (About, Privacy, Terms and so on) written, reviewed and published.
- [ ] Every "coming soon" service (providers, newsletter, forms) says so plainly (PUB-01) rather than looking broken.

## 7. Go-live

- [ ] `main` is green in CI and staging has deployed from it.
- [ ] Open pull requests decided: **#88** (ADR-0014 and the public dictionary; lessons need their own written change note before they are built) and **#85** (21 dependency updates; merge only after CI and an e2e run pass).
- [ ] Tag the release: `git tag v0.1.0 && git push origin v0.1.0`, then approve the `production` deployment.
- [ ] Production indexing on (`ALLOW_INDEXING = "true"` is already set for production); `curl -i https://naisema.com/health` answers `200 ok`.
- [ ] Production smoke test: staff sign-in with two-factor, one form submission, one video playing, one learner account created and deleted.
- [ ] Uptime monitor shows green; a backup appears at `/admin/restore` the next morning.
