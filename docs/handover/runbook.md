# Runbook

How to run, provision, deploy and roll back Na iSema. Kept current with every change that affects operations (OWN-03).

## Stack at a glance

One Cloudflare Worker serves everything: React Router 8 in framework mode with server rendering, Drizzle ORM over D1, and R2 buckets for media and private evidence (ADR-0004, ADR-0005). Local development, staging and production are named environments in `wrangler.jsonc`, all in the one Na iSema Cloudflare account.

## Run locally

Requires Node 22 and pnpm. The pnpm version is pinned in `package.json`; run `corepack enable` once so your machine uses it. Which dependencies may run install scripts is set in `pnpm-workspace.yaml` (`allowBuilds`).

```sh
pnpm install
pnpm db:migrate:local   # apply migrations to the local D1 in .wrangler/state
pnpm dev                # http://localhost:5173
```

Local D1 and R2 are simulated by Miniflare; nothing touches Cloudflare.

To set the site name or welcome statement locally:

```sh
pnpm wrangler d1 execute DB --local --command \
  "INSERT INTO site_settings (key, value, updated_at) VALUES ('welcome_statement', 'Your text', 0)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value"
```

## Checks

| Command | What it does |
| --- | --- |
| `pnpm lint` | Biome lint and format check |
| `pnpm typecheck` | Regenerates Worker and route types, then runs `tsc -p` on each TypeScript project |
| `pnpm test` | Builds the Worker, then runs integration tests against the built bundle with a fresh, migrated D1 |
| `pnpm test:e2e` | Serves the production build with a migrated, seeded local D1 and runs Playwright + axe on desktop and mobile Chromium |

If the sandbox's Chromium differs from the one Playwright expects, point it at a local binary with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm test:e2e`.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, integration tests, browser tests and a full-history gitleaks secret scan on every pull request. Dependabot opens weekly dependency update pull requests.

## Security headers and client JavaScript

Every server-rendered response carries a nonce-based Content Security Policy and baseline security headers (`app/lib/security-headers.ts`); inline scripts must use the per-response nonce. Pages with nothing interactive export `handle = { hydrate: false }` and ship no client JavaScript.

## Database migrations

1. Change `db/schema.ts`.
2. `pnpm db:generate --name short_description` writes SQL to `migrations/`.
3. Review the SQL, then `pnpm db:migrate:local`.
4. Commit the schema and migration together. Deploys apply pending migrations before the new Worker goes live, so every migration must work with the previous Worker version still running.

Revisions and Review Approvals are immutable (ADR-0006): the `revision_immutable` and `review_approval_immutable` triggers refuse any `UPDATE` on those tables. A migration that genuinely has to rewrite such rows (a backfill, say) must drop the trigger, make the change and recreate the trigger in the same migration, and say why in the migration. drizzle-kit does not generate triggers, so they are written by hand at the end of the migration that needs them.

## One-time Cloudflare provisioning

Done once per environment by someone with admin access to the Na iSema Cloudflare account. Replace `staging` with `production` for production.

```sh
pnpm wrangler login
pnpm wrangler d1 create naisema-staging --location oc
pnpm wrangler r2 bucket create naisema-staging-media --location oc
pnpm wrangler r2 bucket create naisema-staging-evidence --location oc
pnpm wrangler r2 bucket create naisema-staging-quarantine --location oc
pnpm wrangler queues create naisema-staging-upload-scans
```

- When `d1 create` or `r2 bucket create` asks whether to add the resource to your Wrangler configuration, answer **No**. Wrangler would add it to the top level as a *remote* binding, which makes local development and tests talk to real staging or production data.
- Instead, copy the D1 `database_id` printed by `d1 create` into the matching `env.<name>.d1_databases` entry in `wrangler.jsonc` and commit it. Database IDs and the account ID are not secrets. (Staging and production were provisioned on 29 September 2026; their IDs are already in `wrangler.jsonc`.)
- Leave D1 read replication off (the default) per ADR-0004.
- Create one Cloudflare API token per deployed environment with only the permissions deploys need: Workers Scripts: Edit, D1: Edit, Workers R2 Storage: Edit, Queues: Edit, Containers: Edit, Cloudflare Images: Edit, Account Settings: Read, limited to the Na iSema account. Cloudflare tokens cannot be restricted to a single Worker, database or bucket, so the staging token could technically touch production resources. Environments are kept apart by storing each token only in its own GitHub environment, with production behind required reviewers.
- **Development** runs entirely in Miniflare on each developer's machine; there is no remote development Worker, database or bucket, and none is needed until a shared preview environment is wanted.

### Connect GitHub

In the repository settings on GitHub:

1. **Environments:** create `staging` and `production`. On `production`, add required reviewers so every production deploy needs a manual approval.
2. In each environment, add the secret `CLOUDFLARE_API_TOKEN` holding that environment's scoped token.
3. **Variables:** add the repository variable `CLOUDFLARE_ACCOUNT_ID`. Deploy jobs stay skipped until this variable exists.

## Staff sign-in

Staff tools live on their own hostname, served by the same Worker (ADR-0005): `admin.naisema.com` in production, `admin.staging.naisema.com` on staging, and `http://admin.localhost:5173` locally. The public site never answers `/admin` or `/api/auth`.

Staff sign in with an emailed link, then enter a 6-digit code from an authenticator app. Links go only to accounts that hold an active role, at most three per address every 15 minutes, and the sign-in page gives the same reply either way. Two-factor is enforced by the staff gate, not by Better Auth (ADR-0013): a role only counts for a session that has passed the code check, and five wrong codes end the session. Roles are managed by administrators at `/admin/staff`; every grant, revoke, sign-in, code check and two-factor reset is written to the `audit_event` table.

### A lost authenticator app

If a staff member loses the phone with their authenticator app, an administrator resets their two-factor under **Two-factor** at `/admin/staff`. That signs the person out everywhere and emails them to say it happened; at their next sign-in they set up a new authenticator app. Administrators can't reset their own two-factor from the admin site.

If the only administrator has lost their phone, the technical owner resets it from the command line instead. No email is sent this way, so tell the person yourself:

```sh
pnpm staff:reset-two-factor --env production --email natasha@example.com
```

Use `--env staging` for staging, or `--local` locally. The reset is written to `audit_event` with no actor and `"via":"cli"`, like `pnpm staff:grant`.

### Before the first deploy to an environment

1. **Auth secret.** Generate a long random value and store it as a Worker secret:
   `openssl rand -base64 32 | pnpm wrangler secret put BETTER_AUTH_SECRET --env staging --config wrangler.jsonc`
   Changing it signs everyone out and invalidates enrolled authenticator apps, so rotate it only as part of an incident.
2. **Email sending.** In the Cloudflare dashboard go to **Compute → Email Service → Email Sending → Onboard Domain** and onboard `naisema.com`. Cloudflare adds SPF, DKIM, DMARC and bounce MX records; if any address at `@naisema.com` already receives mail, check the proposed MX records before accepting. Sign-in emails come from `no-reply@naisema.com` (`EMAIL_FROM` in `wrangler.jsonc`).
3. **First administrator.** After the deploy has applied migrations, grant the first role from the command line:
   `pnpm staff:grant --env staging --email you@example.com --role administrator`
   That person signs in at the admin site, sets up their authenticator app, and grants everyone else's roles in `/admin/staff`.

### Locally

`pnpm dev` creates `.dev.vars` with a random local secret if it is missing. Open `http://admin.localhost:5173/admin`, grant yourself a role with `pnpm staff:grant --local --email you@example.com --role administrator`, and read sign-in emails from the local outbox:

```sh
pnpm wrangler d1 execute DB --local --config wrangler.jsonc --command "SELECT \"to\", text FROM email_outbox ORDER BY id DESC LIMIT 1"
```

## Rights Records

An item can be published, and later served, only while a current Rights Record grants Publish; items flagged for identifiable children also need a current record marked as documented guardian permission. Eligibility is decided on every request (ADR-0007), so an expiry or withdrawal takes effect immediately and nothing needs unpublishing. Editors record and withdraw Rights Records from an article's Rights Records page; records are never edited, only withdrawn, and a database trigger enforces that.

- **Evidence** (PDF, JPEG, PNG or WebP, up to 10 MB; its first bytes, declared type and extension must agree) is stored in the private `EVIDENCE` bucket under `rights/<record id>/`. It is only ever served to editors, as a download, and every download is audited. Until the upload scan pipeline arrives (issue #14) evidence is not virus-scanned, so open downloads with care (see `docs/decision-log.md`, interim decisions).
- **What a record covers:** until the media library arrives, an item's Rights Record covers everything in it, including images in an Article body.
- **Expiry warnings** run daily at 19:45 UTC (the `triggers.crons` entry in `wrangler.jsonc`, handled by `scheduled` in `workers/app.ts`). Each record expiring within 30 days is emailed once to the editor who recorded it (or to every current editor if they no longer are one), and again inside 7 days. Sent warnings are kept in `rights_expiry_warning`, recorded as each email goes, so a run that fails part-way resends only what wasn't sent; a failed run shows as failed in the Worker's cron events.

## Public site

The public site (`app/routes/public/`, styles in `app/styles/public.css`, design record in `DESIGN.md`) serves the homepage, the six area pages at `/{area}`, Articles at `/{area}/{slug}`, the footer pages, `/sitemap.xml` and `/robots.txt`. Public pages ship no client JavaScript (`script-src 'none'`).

- **What is shown:** only an item's current published Revision, and only while it is eligible (ADR-0007). A withdrawn or archived item answers 410; a draft, a never-published item or one that has lost its rights answers 404. Review Labels come from the approvals actually recorded on the published Revision; there is no "verified" label.
- **Changing an address:** editors change an item's slug from its edit page ("Web address"). The old slug is kept in `slug_redirect` and answers with a 301 to the new address while the item is eligible; no item, including the same one, can take an old slug again, because browsers keep permanent redirects and moving back would loop.
- **Caching:** public HTML and the sitemap are cached at the edge for at most 5 minutes (`Cache-Control: public, max-age=60, s-maxage=300`); errors are never cached and the admin host is never cached. Publishing, withdrawing, archiving, a rights withdrawal or a slug change purges the affected pages (`/`, the area, the item and the sitemap) for every origin in the `PUBLIC_ORIGINS` var in `wrangler.jsonc`; review decisions purge the item's pages too. Staging's `workers.dev` address isn't listed, so it relies on the 5-minute ceiling; add it to `PUBLIC_ORIGINS` if testers use it. Query strings are ignored, so each page has one cached copy. The Worker purges its own data centre through the Cache API; to purge every data centre, set the `CLOUDFLARE_ZONE_ID` var and the `CACHE_PURGE_TOKEN` secret (a token with **Zone › Cache Purge › Purge**, limited to the `naisema.com` zone). Without them, other data centres can serve a page for up to 5 minutes after a change, which is the stated limit. Cached pages are keyed by the deployed Worker version (the `CF_VERSION_METADATA` binding), so a deploy starts with an empty cache and never serves pages that point at the previous build's stylesheet.
- **Sitemap and robots:** `/sitemap.xml` lists the homepage, the six areas and every item in the search index (see Public search). `/robots.txt` disallows everything unless `ALLOW_INDEXING = "true"`, and then disallows only `/admin`.
- **Fonts:** Jost and Literata are self-hosted from the `@fontsource-variable` packages (SIL Open Font License 1.1); nothing is loaded from a font CDN.

## Public search

`/search` searches the titles, summaries and Topic names of public items and filters by area, Topic and format. The search, its filters and the page number all live in the URL. The code is in `app/lib/search.server.ts` and `app/routes/public/search.tsx`.

- **The index** is `search_entry`, mirrored into the FTS5 table `search_fts` by triggers (`migrations/0006_search.sql`). `publicItemChanged` (`app/lib/public-change.server.ts`) reindexes an item, and purges its cached pages, after a publish, withdrawal, archive, review decision, rights change or slug change. The daily cron also reindexes items whose rights expired in the last two days, because expiry is the only change that comes with time. Area pages (the newest 20, then a link to search), the homepage and the sitemap read the same index. A SQL check on current Publish rights keeps counts, Topic options and the sitemap up to date between reindexes.
- **Every result is re-checked** for eligibility before it is shown, and an entry found ineligible is dropped from the index on the spot. So a stale entry can never be shown, only skipped.
- **Search pages are never cached** (`Cache-Control: no-store`) and are `noindex`. A withdrawal therefore disappears from search on the next request.
- **Analytics:** each search writes one `search_performed` data point to the `EVENTS` Analytics Engine dataset (`naisema_<env>_events`). It holds the filters, up to ten result IDs, the result count and the page number, and never the words searched for. The dataset is created on first write.
- **Rebuilding the whole index**, if it is ever lost or suspect: run `DELETE FROM search_entry_topic; DELETE FROM search_entry;` with `wrangler d1 execute`, then re-run the backfill statements at the end of `migrations/0006_search.sql`. The backfill approximates eligibility by requiring current Publish rights; re-checking each item shown drops anything else that isn't eligible.
- **Load test** (#21: p95 ≤ 2 s with 5,000 items): run `pnpm search:load-test seed --env staging --count 5000`, then `run --url https://staging.naisema.com`, then `remove --env staging`. The script refuses production. The plan needs Workers Paid: a search page makes about 165 D1 queries, over the Free plan's 50. A local run measures one worker queueing every request, so its p95 overstates what staging will show; one search takes about 0.2 s locally.
- **Backups:** Cloudflare documents that `wrangler d1 export` does not support virtual tables, which includes `search_fts`. Time Travel is unaffected. An export-based backup must drop `search_fts` first and rebuild it after import (see #34).

## Upload safety

Every upload follows the same path (docs/phase-1a-defaults.md §1, ADR-0010); the code is in `app/lib/upload-rules.ts`, `media.server.ts` and `scan.server.ts`.

1. **Before it starts:** the file's extension, declared type and size are checked against the allowlist: MP4 and MOV up to 2 GB, MP3 and M4A up to 500 MB, PDF up to 50 MB, JPEG, PNG and WebP up to 25 MB, and Rights Record evidence (PDF or image) up to 10 MB. Only editors and Educators can upload, and only on the admin host; the public site has no upload path.
2. **Upload:** the file arrives in 10 MiB parts, as an R2 multipart upload into the private `QUARANTINE` bucket. The first part's leading bytes must match the type, which stops a renamed executable. Choosing the same file again resumes an interrupted upload. Evidence arrives in one go with the Rights Record form.
3. **Scan:** a finished upload is queued on `naisema-<env>-upload-scans`. The Worker consumes the queue, checks the type again, and streams the file to ClamAV running in Cloudflare Containers (`containers/scanner`, instance type `standard-1`, at most two instances). A clean file is copied to `MEDIA` (the media library) or `EVIDENCE` (Rights Record evidence) and marked ready. An infected or unscannable file stays in quarantine, and the media library or rights page shows why. A scanner that can't answer, for example while clamd is still loading its signatures, means a retry with a growing delay. After five deliveries the upload is marked failed. Every step is safe to repeat.
4. **Daily tidy-up** (the 19:45 UTC cron): failed and infected files are deleted 30 days after the scan, uploads unfinished after 7 days are abandoned, and scans with no verdict after an hour are queued again.
5. **Delivery:** ready images are served from `/media/images/<id>/<width>` (320, 640, 960, 1280 or 1920), re-encoded as WebP through the Cloudflare Images binding, which strips metadata. Ready PDFs are served from `/media/files/<id>`, always as a download with a sandboxing content security policy. Audio and video are delivered by their own players when those arrive (#16, #25).

**The scanner image** is the official `clamav/clamav:stable` image, which includes a recent signature database, plus a small Go front end (`containers/scanner/main.go`). Inside the container, freshclam keeps the signatures current, so the container needs internet access. `wrangler deploy` builds the image with Docker, so the deploy runner needs Docker; GitHub's runners have it. To check the image, run `sh scripts/scanner-smoke.sh`, which needs Docker. It builds the image and checks that a clean file passes and the EICAR test file is caught. CI runs it on every pull request.

**Locally and in tests** the container isn't built (`dev.enable_containers: false`), so uploads stay "Being scanned for viruses" while the local queue retries. Integration tests drive the scan step directly with a stand-in scanner. To scan for real locally, set `enable_containers` to `true` with Docker running.

**If uploads stay in scanning:** look at the Worker's queue consumer logs ("Upload scan failed") and at the container's logs in the dashboard (Workers & Pages › Containers). The daily job re-queues stalled scans; to retry at once, re-upload the file.

## Custom domains

Domains are declared in `wrangler.jsonc` so the repository is the source of truth; don't add them in the dashboard. Staging is public so testers anywhere can use it: it serves `staging.naisema.com` and stays reachable at its `workers.dev` address because `env.staging` sets `workers_dev: true` (Wrangler turns that address off by default once an environment has routes). The `workers.dev` address serves only the public site; staff tools answer on `admin.staging.naisema.com` alone.

Prerequisites, done once:

1. `naisema.com` is an **Active** zone in the Na iSema Cloudflare account (Add a domain, Free plan, then point the registrar's nameservers at Cloudflare). Check imported MX/TXT records before switching nameservers if email uses the domain.
2. No existing DNS record for the hostname; Cloudflare creates the record and certificate on deploy.
3. The environment's CI token has **Zone › Workers Routes › Edit** (and **Zone › DNS › Edit** if the deploy reports it cannot create the record), limited to the `naisema.com` zone.

The staging Worker also serves `admin.staging.naisema.com` for staff tools.

To add a domain, add `{ "pattern": "<hostname>", "custom_domain": true }` to that environment's `routes` and merge; the next deploy attaches it. The first request can take a minute or two while the certificate is issued.

## Search engine indexing

Every HTML response carries `X-Robots-Tag: noindex, nofollow` unless the environment sets `ALLOW_INDEXING = "true"`, which only production does. Staging and local builds therefore never appear in search results.

## Deploy

Deploys run from `.github/workflows/deploy.yml`, always after the full CI suite passes:

- **Staging:** automatic on every push to the default branch. The job stops with a clear error while `wrangler.jsonc` still holds the placeholder database ID.
- **Production:** push a tag such as `v0.1.0` on a commit that is on the default branch (other tags are rejected); the job waits for approval in the `production` environment.

The default branch is `main`. The deploy workflow lists it by name; update `.github/workflows/deploy.yml` if the default branch is ever renamed.

```sh
git tag v0.1.0 && git push origin v0.1.0
```

Each deploy builds with `CLOUDFLARE_ENV=<env>`, applies pending D1 migrations with `wrangler d1 migrations apply DB --remote --env <env> --config wrangler.jsonc`, then runs `wrangler deploy`.

To preview a deploy locally without publishing: `CLOUDFLARE_ENV=staging pnpm build && pnpm wrangler deploy --dry-run`.

## Roll back

- **Code:** `pnpm wrangler rollback --env <env>` returns the Worker to its previous version (or pick one with `pnpm wrangler deployments list --env <env>`). Run it with the environment's scoped token.
- **Data:** D1 migrations are not rolled back automatically. Use D1 Time Travel (`pnpm wrangler d1 time-travel restore naisema-<env> --timestamp <ISO time>`) to restore the database to a point before the problem, then replay the deletion ledger once it exists (ADR-0009, issue #34).

## Secrets

Secrets never go in the repository. Runtime secrets are set with `pnpm wrangler secret put NAME --env <env>`; CI secrets live in GitHub environments. Local overrides go in `.dev.vars` (gitignored). CI scans the full history for leaked secrets with gitleaks on every pull request.

### Rotating a secret

1. Create the replacement (a new Cloudflare API token, or a new value for a runtime secret).
2. Update it where it is used: the GitHub environment secret for CI tokens, or `pnpm wrangler secret put NAME --env <env>` for runtime secrets (takes effect immediately, no redeploy needed).
3. Confirm the next deploy or request succeeds.
4. Revoke the old token or value in the Cloudflare dashboard.
5. Rotate immediately, without waiting for step 3, if a secret may have leaked; then follow the incident steps below.

## Incidents

Owner: the technical owner (see `docs/decision-log.md`). Safeguarding or privacy aspects go to the safeguarding lead or privacy contact at the same time.

1. **Detect.** Alerts, a report through the site, or a Cloudflare or GitHub notice. Write down the time and what was seen.
2. **Contain.** Roll back the Worker (below) if a deploy caused it; rotate any exposed secret; withdraw affected content.
3. **Preserve evidence.** Export relevant Workers logs and note deploy IDs before they age out. Do not copy personal data into chats or tickets.
4. **Assess.** What happened, since when, and whether personal information was involved. If it was, the privacy contact decides on notification duties with the privacy adviser (PRD §11).
5. **Recover.** Fix forward or restore (D1 Time Travel), then verify.
6. **Review.** Record the incident, cause and follow-ups in a GitHub issue within a week.

This is a first version; it is rehearsed and expanded before launch (PRD §11).
