# Runbook

How to run, deploy, recover and look after NAISEMA v1 (ADR-0015). The reasons are in `docs/adr/` and `docs/decision-log.md`. The full Phase 1a system, with Stream, the scanner, backups and Learner Accounts, is kept at the git tag `v0-full`.

## Stack at a glance

There is one Cloudflare Worker (React Router 8) serving two hosts:
- the public site, `naisema.com`
- the staff site, `admin.naisema.com`, behind Cloudflare Access

Storage is one D1 database (nine tables, `db/schema.ts`) and one R2 bucket (`naisema-<env>-media`). The bucket holds media under `media/`, Rights Record evidence under `evidence/` and weekly exports under `backups/`.

The Worker also uses Cloudflare Images (re-encoding images on delivery), Email Service (form notifications), Turnstile and a rate limit (public forms). There are no crons, queues or containers.

## Run locally

```bash
pnpm install
pnpm db:migrate:local
pnpm staff:grant local you@example.org "Your Name" admin,editor
pnpm dev
```

- The public site is at `http://localhost:5173` and the staff site at `http://admin.localhost:5173/admin`.
- There is no Cloudflare Access locally. Send your address in the `X-Dev-Staff-Email` header, for example with a browser extension that sets request headers. Only `ENVIRONMENT = "development"` with no Access settings accepts the header (`app/lib/staff.server.ts`).

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e --trace off
```

- `pnpm test` builds the Worker, then runs the unit tests and the integration journeys (`tests/integration/journeys.test.ts`) against a local D1.
- `pnpm test:e2e` runs the browser journeys with axe at 320 px and 200% zoom, on desktop and phone.

## One-time provisioning, per environment (staging, then production)

`bash scripts/setup-environment.sh staging` (then `production`) walks you through every step below. It opens each page, says what to click, captures the values, fills them into `wrangler.jsonc`, sets the Worker and GitHub secrets, deploys, and opens a pull request with the settings. It is safe to re-run. It retires the Phase 1a Worker of the same name first, which can't be updated in place because it ran the ClamAV container. The steps by hand:

1. **D1:** `pnpm wrangler d1 create naisema-v1-staging --location oc`. Put its ID in `wrangler.jsonc` under `env.staging`. v1 starts from migration 0000 on a fresh database, so don't reuse a Phase 1a database.
2. **R2:** `pnpm wrangler r2 bucket create naisema-staging-media --location oc`. It stays private: the Worker serves files itself.
3. **Cloudflare Access:** in Zero Trust, add a self-hosted application for `admin.staging.naisema.com`:
   - Use the One-time PIN (email code) login.
   - Add a policy allowing only the staff addresses.
   - Put the team domain (`<team>.cloudflareaccess.com`) in `ACCESS_TEAM_DOMAIN` and the application's Audience (AUD) tag in `ACCESS_AUD`, in `wrangler.jsonc`.

   Every staff request is then checked twice: Access lets the address in, and the Worker checks Access's signed JWT and the `staff` table.
4. **Secrets:**
   ```bash
   pnpm wrangler secret put TURNSTILE_SECRET_KEY --env staging
   pnpm wrangler secret put PREVIEW_SECRET --env staging
   pnpm wrangler secret put NOTIFY_EMAILS --env staging
   ```
   - `PREVIEW_SECRET` is a long random string.
   - `NOTIFY_EMAILS` is the comma-separated addresses that hear about new enquiries and offers.
   - Production also needs its real Turnstile site key in `wrangler.jsonc`.
5. **Email Service:** verify `naisema.com` as a sending domain, so `no-reply@naisema.com` can send.
6. **The first administrator:**
   ```bash
   pnpm staff:grant staging founder@example.org "Name" admin,editor
   ```
   Add later staff at `/admin/staff` (audited), and to the Access allowlist.
7. **GitHub:**
   - Set the repository variable `CLOUDFLARE_ACCOUNT_ID`.
   - Give the `staging` and `production` environments `CLOUDFLARE_API_TOKEN`: Workers deploy, D1 edit and R2 edit for that environment only.
   - Give `production` a required reviewer.
8. **Uptime:** in UptimeRobot (free), check `https://naisema.com/` and `https://naisema.com/health` every 5 minutes. Email the technical owner (ADR-0012). `/health` answers `ok` only after reading D1.
9. **Billing:** set Cloudflare billing notifications at 50% and 80% of AUD 100 a month.

## Deploy

- **Staging:** every push to `main` deploys there after CI passes (`.github/workflows/deploy.yml`). Migrations apply first.
- **Production:** push a tag and approve the `production` deployment:
  ```bash
  git tag v1.0.0 && git push origin v1.0.0
  ```
- The deploy refuses to run while `wrangler.jsonc` still has `REPLACE_WITH_` placeholders for that environment.

## Roll back

`pnpm wrangler rollback --env production` returns to the previous Worker version. A migration isn't undone by a rollback. Write a new migration instead.

## Staff sign-in and roles

- Cloudflare Access decides who reaches the admin host. The `staff` table decides what they may do (`app/lib/roles.ts`).
- To stop someone, remove them from the Access policy **and** untick them at `/admin/staff`. Either alone is enough to lock them out.
- **Sign out:** `/cdn-cgi/access/logout`.
- Access's session length is set on the Access application (24 hours is a good start).

## Publishing, in one paragraph

An item is public only while its published Revision has every review it needs, each approved on that exact Revision by someone other than its author. It also needs a current Rights Record granting Publish, for the item and for each media file it shows.

- A Video with a Learning Layer also needs Translate, Transcribe and Educational adaptation, and a language review.
- This is decided on every request (`eligibility` in `app/lib/content-rules.ts`). Withdrawing a right, or a right passing its last day, takes the item down on the next request. No cache needs purging.

## Media

- Staff upload MP4 (H.264), MP3, M4A, PDF, JPEG, PNG and WebP of up to 95 MB at `/admin/media`.
- The type is checked by name and again by the file's first bytes. There's no virus scan in v1, because only staff upload (ADR-0015).
- A file is delivered publicly only while a Rights Record of its own grants Publish.
- Keep the original of every clip in the NAISEMA Drive as well (decision log, #64).
- To make a clip that fits, use H.264 at 720p, with the index at the front so it starts playing at once:

  ```bash
  ffmpeg -i original.mov -c:v libx264 -crf 23 -preset slow -vf "scale='min(1280,iw)':-2" -c:a aac -b:a 128k -movflags +faststart clip.mp4
  ```

## Preview links

An editor makes one from an item's page. It shows that exact version, with its media, for 14 days, to anyone with the address, and is never indexed. Rotating `PREVIEW_SECRET` ends every preview link at once.

## Forms

- Every form is stored first, in the `submission` table, with the version of the privacy notice it showed.
- The right people are then emailed a link, never the contents:
  - enquiries and offers go to `NOTIFY_EMAILS`
  - reports go to staff with the Safeguarding Lead role
  - privacy requests go to administrators
- Read and close them at `/admin/submissions`. Opening one is audited.
- A changed privacy notice needs a new `NOTICE.version` in `app/lib/forms.ts`.

## Backups and restoring

- **D1 Time Travel:** any minute in the last 30 days.
  ```bash
  pnpm wrangler d1 time-travel restore DB --env production --timestamp <ISO time>
  ```
  Restoring replaces the whole database, so first note what changed after that time.
- **Weekly export:** `.github/workflows/backup.yml` exports production to SQL every Monday and keeps it in the media bucket under `backups/`. To restore one into a fresh database:
  ```bash
  pnpm wrangler d1 execute DB --remote --env production --file backup.sql
  ```
  Download the file from R2 first.
- **Media:** R2 holds the only copy the site serves. The NAISEMA Drive holds the clip originals.

Before launch, restore staging once from Time Travel and once from an export, and record how long each took.

## Monitoring

- The uptime monitor watches the site from outside Cloudflare.
- Errors are in Workers Observability. There is one redacted line per request, with no query strings or personal fields (`app/lib/log.server.ts`).
- Cloudflare's billing notifications watch cost.

## Secrets

| Name | What it is | Rotating it |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Turnstile's secret | New key in the Turnstile dashboard, then `wrangler secret put` |
| `PREVIEW_SECRET` | Signs preview links | `wrangler secret put` with a new random value; every preview link stops |
| `NOTIFY_EMAILS` | Who hears about new forms | `wrangler secret put` |
| `CLOUDFLARE_API_TOKEN` | GitHub deploys and exports | New token in Cloudflare, then the GitHub environment |

## Incidents

1. **Contain:** withdraw the item, or the Rights Record. Either takes effect on the next request. For a compromised staff account, remove it from Access and untick it at `/admin/staff`.
2. **Keep the evidence:** export the database (`pnpm db:export production`) and note the audit events (`/admin/audit`).
3. **Assess what was exposed, and tell the privacy contact.** They decide on notification duties.
4. **Recover** from Time Travel if data was damaged, then write down what happened and what changes.
