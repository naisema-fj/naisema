# Runbook

How to run, deploy, recover and look after NAISEMA v1 (ADR-0015). The reasons are in `docs/adr/` and `docs/decision-log.md`. The full Phase 1a system, with Stream, the scanner, backups and Learner Accounts, is kept at the git tag `v0-full`.

## Stack at a glance

There is one Cloudflare Worker (React Router 8) serving two hosts:
- the public site, `naisema.com`
- the staff site, `admin.naisema.com`, where staff sign in with an emailed link (ADR-0016)

Storage is one D1 database (eleven tables, `db/schema.ts`) and one R2 bucket (`naisema-<env>-media`). The bucket holds media under `media/` and Rights Record evidence under `evidence/`. The weekly backup is kept outside Cloudflare, on GitHub (see "Backups and restoring").

The Worker also uses Cloudflare Images (re-encoding images on delivery), Email Service (staff sign-in links and form notifications), Turnstile and a rate limit (public forms). There are no crons, queues or containers.

## Run locally

```bash
pnpm install
pnpm db:migrate:local
pnpm staff:grant local you@example.org "Your Name" admin,editor
pnpm dev
```

- The public site is at `http://localhost:5173` and the staff site at `http://admin.localhost:5173/admin`.
- Sign in at `http://admin.localhost:5173/admin/sign-in`. Nothing is emailed locally, so the page shows the sign-in link itself. Tests can also name a staff member with the `X-Dev-Staff-Email` header, which only development accepts (`app/lib/staff.server.ts`).

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
3. **Secrets:**
   ```bash
   pnpm wrangler secret put TURNSTILE_SECRET_KEY --env staging
   pnpm wrangler secret put PREVIEW_SECRET --env staging
   pnpm wrangler secret put NOTIFY_EMAILS --env staging
   ```
   - `PREVIEW_SECRET` is a long random string.
   - `NOTIFY_EMAILS` is the comma-separated addresses that hear about new enquiries and offers.
   - Production also needs its real Turnstile site key in `wrangler.jsonc`.
4. **Email Service:** verify `naisema.com` as a sending domain, so `no-reply@naisema.com` can send. Staff can't sign in without it.
5. **The first administrator:**
   ```bash
   pnpm staff:grant staging founder@example.org "Name" admin,editor
   ```
   They sign in at `https://admin.staging.naisema.com/admin/sign-in`. Add later staff at `/admin/staff` (audited).
6. **GitHub:**
   - Set the repository variable `CLOUDFLARE_ACCOUNT_ID`.
   - Give the `staging` and `production` environments `CLOUDFLARE_API_TOKEN`: Workers deploy, D1 edit and R2 edit for that environment only.
   - Give `production` a required reviewer.
   - For production only, create a `production-backup` environment with no required reviewer, limited to the `main` branch. Give it its own `CLOUDFLARE_API_TOKEN` (D1 Edit and Workers R2 Storage Read only) and a `BACKUP_PASSPHRASE` of at least 32 random characters (`openssl rand -base64 36`), saved in the password manager first.
7. **Uptime:** in UptimeRobot (free), check `https://naisema.com/` and `https://naisema.com/health` every 5 minutes. Email the technical owner (ADR-0012). `/health` answers `ok` only after reading D1.
8. **Billing:** set Cloudflare billing notifications at 50% and 80% of AUD 100 a month.

## Deploy

- **Staging:** every push to `main` deploys there after CI passes (`.github/workflows/deploy.yml`). Migrations apply first.
- **Production:** push a tag and approve the `production` deployment:
  ```bash
  git tag v1.0.0 && git push origin v1.0.0
  ```
- **From GitHub, without a terminal:** Actions > Deploy > Run workflow. Pick the branch or tag, choose `staging` or `production`, and run. CI runs first, and production still waits for approval. Production only deploys a commit that is on `main`, so a feature branch is refused.
- The deploy refuses to run while `wrangler.jsonc` still has `REPLACE_WITH_` placeholders for that environment.

## Roll back

`pnpm wrangler rollback --env production` returns to the previous Worker version. A migration isn't undone by a rollback. Write a new migration instead.

## Staff sign-in and roles

- **Signing in (ADR-0016):** staff type their address at `/admin/sign-in` and get a link by email. It works once, for 15 minutes, and opens a 14-day session. Only addresses on the staff list get a link, and the page says the same thing either way.
- **Roles:** the `staff` table decides what each person may do (`app/lib/roles.ts`).
- **To stop someone:** tick "No longer works on NAISEMA" at `/admin/staff`. That signs them out everywhere at once.
- **Sign out:** the button at the top of every staff page.
- **Two-factor:** anyone who can read a staff member's email can sign in as them, so ask every staff member to turn on two-factor for that email account.

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
- **Retention:** the notice promises deletion 12 months after the team last replies. A Submission is deleted 12 months after it is marked as dealt with (`deleteExpiredSubmissions` in `app/lib/submissions.server.ts`, audited as `retention`). Nothing runs on a schedule, so this happens whenever a form is sent or the inbox is opened. One never marked as dealt with is kept.
- **Privacy requests:** administrators find everything from one address at `/admin/submissions?email=` and delete each one, with a reason. The Safeguarding Lead deletes reports. The steps are in the admin guide, "When someone asks to see or delete their information".

## Backups and restoring

- **D1 Time Travel:** any minute in the last 30 days.
  ```bash
  pnpm wrangler d1 time-travel restore DB --env production --timestamp <ISO time>
  ```
  Restoring replaces the whole database, so first note what changed after that time.
- **Weekly backup, outside Cloudflare:** every Monday `.github/workflows/backup.yml` copies production's database, every media file and every piece of Rights Record evidence out of Cloudflare (`scripts/backup.mjs`). It encrypts them with `BACKUP_PASSPHRASE` and keeps them as that run's artifact on GitHub for 35 days. So losing the Cloudflare account loses at most a week.
  - **Its own environment.** It runs in the `production-backup` GitHub environment, which has no required reviewer, so it never waits for a deploy approval. Its `CLOUDFLARE_API_TOKEN` has only D1 Edit (Cloudflare's export needs it) and Workers R2 Storage Read, and can't deploy. `bash scripts/setup-environment.sh production` sets it up.
  - **Encrypted, because the repository is public.** Anyone can download an artifact, so it is only ever uploaded encrypted, and the job fails rather than run without the passphrase. The passphrase is in the NAISEMA password manager, as "NAISEMA backup passphrase". Without it nobody can read a backup, NAISEMA included.
  - **If it fails,** GitHub emails whoever last changed the schedule in `backup.yml`. Check the Actions tab after the first few Mondays. A run that warns that some files couldn't be copied names them in the backup's `manifest.json`.
  - **To make one by hand,** for example before something risky: `pnpm backup production <folder>`. The folder isn't encrypted, so keep it on your own computer and delete it after.
- **To restore from a weekly backup:**
  1. Download the artifact from that run (Actions > Weekly backup > the run > Artifacts) and unzip it.
  2. Decrypt and unpack it, typing the passphrase when asked:
     ```bash
     mkdir restore && gpg --decrypt naisema-production-<date>.tar.gz.gpg | tar -xz -C restore
     ```
  3. Load the database into a fresh, empty D1 database (`pnpm wrangler d1 create`, then put its ID in `wrangler.jsonc`). Never load it into one that has tables:
     ```bash
     pnpm wrangler d1 execute DB --remote --env production --file restore/database.sql
     ```
  4. Put the files back into the bucket, each under its own key and type:
     ```bash
     pnpm restore:files production restore
     ```
  5. Delete the `restore` folder: it holds personal data.
- **Media:** the weekly backup holds every file the site serves. Keep the original of every clip in the NAISEMA Drive as well (#64): it is the master, at better quality than the clip.
- **Deleted data in backups:** a Submission deleted at someone's request (admin guide) stays in backups made before that until they expire, at most 35 days later, and in D1 Time Travel for 30 days.

Before launch, restore staging once from Time Travel and once from a backup made with `pnpm backup staging <folder>`, and record how long each took.

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
| `CLOUDFLARE_API_TOKEN` | GitHub deploys (`staging`, `production`) and the weekly backup (`production-backup`, read only) | New token in Cloudflare, then the GitHub environment |
| `BACKUP_PASSPHRASE` | Encrypts the weekly backup (`production-backup` environment); a copy is in the password manager | Re-run the production wizard's GitHub stage, or `gh secret set BACKUP_PASSPHRASE --env production-backup`. Keep the old passphrase until the backups it made expire (35 days) |

## Incidents

1. **Contain:** withdraw the item, or the Rights Record. Either takes effect on the next request. While a report is still being looked into, the Safeguarding Lead can hold the item instead, which they alone release (admin guide, "Take it down"). For a compromised staff account, tick "No longer works on NAISEMA" at `/admin/staff`, which signs it out everywhere, and have them secure their email account.
2. **Keep the evidence:** export the database (`pnpm db:export production`) and note the audit events (`/admin/audit`).
3. **Assess what was exposed, and tell the privacy contact.** They decide on notification duties.
4. **Recover** from Time Travel if data was damaged, then write down what happened and what changes.
