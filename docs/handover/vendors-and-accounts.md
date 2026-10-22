# Vendors and accounts

Every external service NAISEMA depends on, found in the code, `wrangler.jsonc`, the CI workflows and the decision log. For each: what it is used for, who holds the account, what it costs, and what breaks without it. Setup steps are in `docs/handover/runbook.md`; the reasons are in `docs/decision-log.md` and the ADRs.

**The "Who holds the account" column is for the founder to fill in** wherever the repository can't know it. Never write a password, API key or recovery code here; those belong in the NAISEMA password manager. The names of the secrets are listed at the end so you know what to look for.

## How costs are known

The only cost figures in the repository are the prices in `app/lib/usage-rules.ts` (`PRICES_USD`), which drive the cost report at `/admin/usage` and the 50% and 80% budget emails. They are Cloudflare list prices in US dollars, converted at 1.55 AUD per USD, and are an estimate: **Cloudflare's invoice is the record.** The agreed ceiling is **AUD 100 a month**. Where a service has no price in the report, this page says so rather than guessing.

## Cloudflare

All of NAISEMA's own infrastructure sits in one Cloudflare account, "NAISEMA", with the Oceania location hint (ADR-0004). **Who holds the account:** _founder to fill in_. If Cloudflare is lost, nothing else here keeps the site running.

| Product | Used for | Cost | What breaks without it |
| --- | --- | --- | --- |
| Workers (paid plan) | Runs the public site, the staff site, the scheduled jobs and the queue consumer | USD 5 a month, counted in the cost report | Everything |
| D1 | The database (`db/schema.ts`; see `data-dictionary.md`); Time Travel gives 30 days of point-in-time recovery | Within the plan at Phase 1a's size; not in the report | Everything that stores or reads data |
| R2 | Six private buckets per environment: media, evidence, quarantine, video masters, backups, the deletion ledger | USD 0.015 per GB a month above 10 GB free, in the report | Uploads, media, evidence files, backups, the deletion ledger. Video masters exist only here (see ticket #64) |
| Queues | Hands each finished upload to the virus scan | Within the plan; not in the report | Uploads stay in quarantine and never publish |
| Containers | Runs ClamAV (the Scanner) for upload scanning | Within the plan at 1a's size; not in the report | Same as Queues: files can't pass their scan |
| Stream | Stores, encodes and delivers Videos | USD 5 per 1,000 minutes stored and USD 1 per 1,000 minutes delivered, in the report | Videos can't be processed or played. Stream has no account yet (runbook, Video) |
| Images | Re-encodes images on delivery and strips their metadata | Within the plan; not in the report | Images can't be served |
| Email Service | Sends sign-in links, alerts and confirmations from `no-reply@naisema.com` | Not in the report; check the dashboard for current sending prices | Staff and learners can't sign in, and alert emails fail too |
| Turnstile | Bot check on every public form | Free | Every public form refuses to send |
| Workers Analytics Engine | Product events with IDs only (`EVENTS`) | Within the plan; not in the report | No event counts; the site keeps working |
| Web Analytics | Cookieless traffic counts (decision log, analytics) | Free | No traffic counts |
| Workers Observability | Redacted request and error logs | Within the plan | Harder troubleshooting; the monitor reads its error counts from the Cloudflare API |
| Rate limiting binding | At most 5 form sends a minute from one address | Included | Public forms lose their rate limit |
| DNS and custom domains | The `naisema.com` zone, with `staging.` and `admin.` names | Free plan | The site isn't reachable by name |
| Cloudflare API tokens | Deploys (one per environment, in GitHub), the read-only usage token, and optional cache purge | Free | Deploys fail; cost report and monitor go blind |
| Billing alerts | Cloudflare's own alerts at 50% and 80% of the ceiling | Free | Only the app's projected-cost emails remain |

## Other services

| Service | Used for | Who holds the account | Cost | What breaks without it |
| --- | --- | --- | --- | --- |
| GitHub (`naisema-fj` organisation) | The code, CI, Dependabot updates, the deploy workflow and its `staging` and `production` environments with their secrets | _founder to fill in_ | Not known to the repository (depends on the GitHub plan) | No deploys, no CI, no history. The code is also on the technical owner's machine |
| Buttondown | The newsletter list: double opt-in, unsubscribes, tags for the notice each person agreed to. Production only; staging writes sign-ups to a table | _founder to fill in_ | Not known to the repository; check Buttondown's plan | New newsletter sign-ups are refused with a plain message, and the newsletter consent just given is removed |
| Uptime monitor (UptimeRobot or Better Stack; the runbook asks for the choice to be recorded in `docs/decision-log.md`) | Checks the public URLs every 5 minutes from outside Cloudflare (ADR-0012) | _not chosen yet; founder to record the choice_ | Not known to the repository; the free tiers of both are the usual start | A full outage goes unnoticed, because the in-app monitor runs on the same Worker |
| Domain registrar for `naisema.com` | Owns the domain; its nameservers point at Cloudflare | _founder to fill in_ | Not known to the repository (yearly renewal) | If the domain lapses, the whole site and every email address on it stop |
| Password manager ("NAISEMA password manager") | Holds the backup encryption key and recovery details, apart from Cloudflare | _founder to fill in_ | Not known to the repository | Backups can't be decrypted if the key is lost with Cloudflare access |
| External survey tool and spreadsheet register | Consultation sign-ups (decision log, GOV-01 and GOV-02) | _founder to fill in; the tool is not named in the repository_ | Not known to the repository | Consultation records can't be collected or looked up |
| Docker Hub (`clamav/clamav`) and ClamAV signature servers | The base image for the Scanner, and the virus signatures its container downloads while running | Public; no account | Free | The Scanner image can't be built, or its signatures go stale |
| npm registry and package maintainers | Libraries installed by `pnpm install` (licences in `THIRD_PARTY_LICENSES`) | Public; no account | Free | Fresh installs and builds fail; the deployed site is unaffected |
| GitHub releases of gitleaks | Downloaded by CI for the secret scan, checked against a pinned hash | Public; no account | Free | The secret scan job fails |

Fonts are installed from npm and served from NAISEMA's own site; no font service is called at run time.

## Secrets and settings to look for

Names only. Set with `pnpm wrangler secret put NAME --env <env>`, or in a GitHub environment for the CI ones.

| Name | Held in | For |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Worker secret | Signs sign-in sessions |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Worker secrets | Turnstile |
| `BACKUP_ENCRYPTION_KEY` | Worker secret, plus a copy in the password manager | Encrypts backups |
| `BUTTONDOWN_API_KEY` | Worker secret (production) | Newsletter |
| `STREAM_WEBHOOK_SECRET`, `STREAM_API_TOKEN`, `STREAM_CUSTOMER_CODE`, `STREAM_SIGNING_KEY_ID`, `STREAM_SIGNING_KEY_JWK`, `R2_MASTERS_ACCESS_KEY_ID`, `R2_MASTERS_SECRET_ACCESS_KEY` | Worker secrets, once Stream is in use | Video |
| `MONITORING_API_TOKEN` | Worker secret | Read-only token for the cost report and the monitor's error counts |
| `CACHE_PURGE_TOKEN` (optional) | Worker secret | Purging cached pages in every data centre |
| `ALERT_EMAILS` | Worker secret or variable | Who the monitor and budget emails go to |
| `CLOUDFLARE_API_TOKEN` | GitHub environment secret, one per environment | Deploys |
