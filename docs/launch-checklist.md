# v1 launch checklist

Everything between the code and a live NAISEMA, as of 9 November 2026, after the v1 rewrite (ADR-0015; decision log, "v1 launch rewrite"). The founder moved #3, #5, #6 and #9 to after launch.

**Progress, 11 November 2026.** Nothing is ticked yet: each account item covers staging and production, and production isn't provisioned (`wrangler.jsonc` still has its production placeholders, and `naisema.com` doesn't answer). Where staging is done, the item says so and how it was checked. Items with no note couldn't be checked from the repository, GitHub or the live staging site, so they may be further along than they show.

## 1. Accounts (technical owner and founder)

`bash scripts/setup-environment.sh staging`, then `production`, does most of this section and opens a pull request with the settings (runbook, "One-time provisioning").

- [ ] Cloudflare Workers paid plan active; account holder recorded in `docs/handover/vendors-and-accounts.md`.
  - The account exists and deploys (its ID is in `wrangler.jsonc`, and `CLOUDFLARE_ACCOUNT_ID` is set in GitHub). The account holder is still "founder to fill in", and the plan couldn't be checked from here.
- [ ] D1 databases `naisema-v1-staging` and `naisema-v1-production` created fresh (the v1 schema starts again at migration 0000), with their IDs set in `wrangler.jsonc`.
  - Staging done: its ID is in `wrangler.jsonc`, each deploy from `main` applies migrations to it, and `https://staging.naisema.com/health`, which reads the database, answers `200 ok`. Production: not created (`REPLACE_WITH_PRODUCTION_DATABASE_ID`).
- [ ] R2 buckets `naisema-staging-media` and `naisema-production-media` created.
  - Staging: the Worker deploys with `naisema-staging-media` bound; an upload on staging would confirm it. Production: to do.
- [ ] The first administrator added with `pnpm staff:grant <env> <email> "<Name>" admin,editor`; everyone else at `/admin/staff`. Everyone turns on two-factor for the email account they sign in with.
- [ ] Real Turnstile keys: `TURNSTILE_SITE_KEY` var and `TURNSTILE_SECRET_KEY` secret.
  - Not yet: staging uses Cloudflare's always-passing test site key (`1x00000000000000000000AA`), and production's is a placeholder.
- [ ] `PREVIEW_SECRET` set (signs preview links for Knowledge Holders), and `NOTIFY_EMAILS` (who hears about new forms).
- [ ] Email Service sends from `no-reply@naisema.com`: a staff sign-in link and a form notification each arrive in a real inbox.
- [ ] Buttondown's embed form address set as `NEWSLETTER_FORM_URL`.
  - Not yet: it is empty for staging and production, so the newsletter page says it isn't open.
- [ ] UptimeRobot (free) checks `https://naisema.com/` and `/health` every 5 minutes and emails the technical owner.
- [ ] Cloudflare billing alerts at 50% and 80% of AUD 100 a month.
- [ ] GitHub `production` environment has `CLOUDFLARE_API_TOKEN` and a required reviewer.
  - Staging's token works (each merge to `main` deploys staging). Production's couldn't be checked from here.

## 2. People and content (founder)

- [ ] **#7 and #8:** a Language Reviewer for Standard Fijian, with their qualification recorded in the decision log, and a different person as Educator.
- [ ] Three seed clips, each with a Rights Record, and the original files kept in the NAISEMA Drive (#64).
- [ ] At least one Learning Layer reviewed and published.
- [ ] Footer Pages written, reviewed and published: About, Privacy, Terms, Accessibility, Community standards, Contact.
- [ ] At least one published item in each area you want to open. Areas with nothing in them say plainly that they are not open yet.
- [ ] **#10:** the one-page privacy notice, and the privacy adviser's sign-off if the founder wants to wait for it.

## 3. Go live

- [ ] `main` is green in CI and staging has deployed from it.
  - True so far: on 11 November, `main` at `222b80d` (#102) passed CI and deployed to staging. Tick this for the commit you tag.
- [ ] Smoke test on staging, on a phone:
  - sign in with the emailed link
  - publish a reviewed item
  - submit a form and receive its notification email
  - play a Learning Layer through all eight stages
- [ ] Tag `v1.0.0` and approve the `production` deployment.
- [ ] `curl -i https://naisema.com/health` answers `200 ok`, and the uptime monitor shows green.
- [ ] Restore staging once from D1 Time Travel and once from a weekly export, and note how long each took (runbook, "Backups and restoring").

## After launch

#3 (component approvals), #5 (backup Safeguarding Lead), #6 (backup technical owner), #9 (support agreement and MOU amendments), #65 (Phase 1b scope), the Vosa dictionary pages, and Lessons (change note 0001).
