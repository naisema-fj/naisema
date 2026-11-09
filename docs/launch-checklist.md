# v1 launch checklist

Everything between the code and a live NAISEMA, as of 9 November 2026, after the v1 rewrite (ADR-0015; decision log, "v1 launch rewrite"). The founder moved #3, #5, #6 and #9 to after launch.

## 1. Accounts (technical owner and founder)

`bash scripts/setup-environment.sh staging`, then `production`, does most of this section and opens a pull request with the settings (runbook, "One-time provisioning").

- [ ] Cloudflare Workers paid plan active; account holder recorded in `docs/handover/vendors-and-accounts.md`.
- [ ] D1 databases `naisema-v1-staging` and `naisema-v1-production` created fresh (the v1 schema starts again at migration 0000), with their IDs set in `wrangler.jsonc`.
- [ ] R2 buckets `naisema-staging-media` and `naisema-production-media` created.
- [ ] Cloudflare Access application on `admin.staging.naisema.com` and `admin.naisema.com`, with an email one-time-code login and an allowlist of staff addresses. Its team domain and audience tag set as `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`.
- [ ] The first administrator added with `pnpm staff:grant <env> <email> "<Name>" admin,editor`; everyone else at `/admin/staff`, and on the Access allowlist.
- [ ] Real Turnstile keys: `TURNSTILE_SITE_KEY` var and `TURNSTILE_SECRET_KEY` secret.
- [ ] `PREVIEW_SECRET` set (signs preview links for Knowledge Holders), and `NOTIFY_EMAILS` (who hears about new forms).
- [ ] Email Service sends from `no-reply@naisema.com`, and a form notification arrives in a real inbox.
- [ ] Buttondown's embed form address set as `NEWSLETTER_FORM_URL`.
- [ ] UptimeRobot (free) checks `https://naisema.com/` and `/health` every 5 minutes and emails the technical owner.
- [ ] Cloudflare billing alerts at 50% and 80% of AUD 100 a month.
- [ ] GitHub `production` environment has `CLOUDFLARE_API_TOKEN` and a required reviewer.

## 2. People and content (founder)

- [ ] **#7 and #8:** a Language Reviewer for Standard Fijian, with their qualification recorded in the decision log, and a different person as Educator.
- [ ] Three seed clips, each with a Rights Record, and the original files kept in the NAISEMA Drive (#64).
- [ ] At least one Learning Layer reviewed and published.
- [ ] Footer Pages written, reviewed and published: About, Privacy, Terms, Accessibility, Community standards, Contact.
- [ ] At least one published item in each area you want to open. Areas with nothing in them say plainly that they are not open yet.
- [ ] **#10:** the one-page privacy notice, and the privacy adviser's sign-off if the founder wants to wait for it.

## 3. Go live

- [ ] `main` is green in CI and staging has deployed from it.
- [ ] Smoke test on staging, on a phone:
  - sign in through Access
  - publish a reviewed item
  - submit a form and receive its notification email
  - play a Learning Layer through all eight stages
- [ ] Tag `v1.0.0` and approve the `production` deployment.
- [ ] `curl -i https://naisema.com/health` answers `200 ok`, and the uptime monitor shows green.
- [ ] Restore staging once from D1 Time Travel and once from a weekly export, and note how long each took (runbook, "Backups and restoring").

## After launch

#3 (component approvals), #5 (backup Safeguarding Lead), #6 (backup technical owner), #9 (support agreement and MOU amendments), #65 (Phase 1b scope), the Vosa dictionary pages, and Lessons (change note 0001).
