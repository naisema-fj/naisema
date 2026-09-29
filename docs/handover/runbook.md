# Runbook

How to run, provision, deploy and roll back NAISEMA. Kept current with every change that affects operations (OWN-03).

## Stack at a glance

One Cloudflare Worker serves everything: React Router 8 in framework mode with server rendering, Drizzle ORM over D1, and R2 buckets for media and private evidence (ADR-0004, ADR-0005). Local development, staging and production are named environments in `wrangler.jsonc`, all in the one NAISEMA Cloudflare account.

## Run locally

Requires Node 22 and pnpm (the version is pinned in `package.json`).

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
| `pnpm typecheck` | Regenerates Worker and route types, then `tsc -b` |
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

## One-time Cloudflare provisioning

Done once per environment by someone with admin access to the NAISEMA Cloudflare account. Replace `staging` with `production` for production.

```sh
pnpm wrangler login
pnpm wrangler d1 create naisema-staging --location oc
pnpm wrangler r2 bucket create naisema-staging-media --location oc
pnpm wrangler r2 bucket create naisema-staging-evidence --location oc
```

- Copy the D1 `database_id` printed by `d1 create` into the matching `env.<name>.d1_databases` entry in `wrangler.jsonc` (replacing the `REPLACE_WITH_…` placeholder) and commit it. Database IDs are not secrets.
- Leave D1 read replication off (the default) per ADR-0004.
- Create one Cloudflare API token per deployed environment with only the permissions deploys need: Workers Scripts: Edit, D1: Edit, Workers R2 Storage: Edit, Account Settings: Read, limited to the NAISEMA account. Cloudflare tokens cannot be restricted to a single Worker, database or bucket, so the staging token could technically touch production resources. Environments are kept apart by storing each token only in its own GitHub environment, with production behind required reviewers.
- **Development** runs entirely in Miniflare on each developer's machine; there is no remote development Worker, database or bucket, and none is needed until a shared preview environment is wanted.

### Connect GitHub

In the repository settings on GitHub:

1. **Environments:** create `staging` and `production`. On `production`, add required reviewers so every production deploy needs a manual approval.
2. In each environment, add the secret `CLOUDFLARE_API_TOKEN` holding that environment's scoped token.
3. **Variables:** add the repository variable `CLOUDFLARE_ACCOUNT_ID`. Deploy jobs stay skipped until this variable exists.

## Deploy

Deploys run from `.github/workflows/deploy.yml`, always after the full CI suite passes:

- **Staging:** automatic on every push to the default branch. The job stops with a clear error while `wrangler.jsonc` still holds the placeholder database ID.
- **Production:** push a tag such as `v0.1.0` on a commit that is on the default branch (other tags are rejected); the job waits for approval in the `production` environment.

The deploy workflow lists the default branch by name; update `.github/workflows/deploy.yml` if the default branch is renamed.

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
