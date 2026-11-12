# Vendors and accounts

Every external service NAISEMA v1 depends on (ADR-0015), who holds the account, and what breaks without it. Setup steps are in `docs/handover/runbook.md`.

**The "Who holds the account" column is for the founder to fill in.** Never write a password, API key or recovery code here; those belong in the NAISEMA password manager. The agreed cost ceiling is **AUD 100 a month**, and Cloudflare's invoice is the record.

## Cloudflare (one account, "NAISEMA", Oceania location hint)

**Who holds the account:** _founder to fill in_. If Cloudflare is lost, nothing else here keeps the site running.

| Product | Used for | Cost | What breaks without it |
| --- | --- | --- | --- |
| Workers (paid plan) | The public and staff sites | USD 5 a month | Everything |
| D1 | The database; Time Travel gives 30 days of point-in-time recovery | Within the plan at v1's size | Everything that stores or reads data |
| R2 | One private bucket per environment: media and Rights Record evidence | USD 0.015 per GB a month above 10 GB free | Media and evidence (the weekly backup has a copy) |
| Images | Re-encodes images on delivery and strips their metadata | Within the plan at v1's size | Images can't be shown |
| Email Service | Staff sign-in links and form notifications from `no-reply@naisema.com` | Check the dashboard for sending prices | Nobody can sign in to the staff site (anyone already signed in carries on), and the team isn't told about new forms |
| Turnstile | Bot check on every public form | Free | Every public form refuses to send |
| Web Analytics | Cookieless traffic counts | Free | No traffic counts |
| Workers Observability | Redacted request and error logs | Within the plan | Harder troubleshooting |
| DNS and custom domains | `naisema.com`, `admin.`, `staging.` and `admin.staging.` | Free plan | The site isn't reachable by name |
| Billing notifications | Alerts at 50% and 80% of the ceiling | Free | Overspending goes unnoticed |

## Other services

| Service | Used for | Who holds the account | Cost | What breaks without it |
| --- | --- | --- | --- | --- |
| GitHub (`naisema-fj`) | The code, CI, deploys, and the weekly backup, kept encrypted for 35 days | _founder to fill in_ | Depends on the plan | No deploys or backups. The deployed site is unaffected |
| Buttondown | The newsletter: its own sign-up page, double opt-in and unsubscribes | _founder to fill in_ | Check Buttondown's plan | The newsletter page says it isn't open yet |
| UptimeRobot | Checks `/` and `/health` every 5 minutes from outside Cloudflare (ADR-0012) | _founder to fill in_ | Free tier | A full outage goes unnoticed |
| Domain registrar for `naisema.com` | Owns the domain; its nameservers point at Cloudflare | _founder to fill in_ | Yearly renewal | The site and every address on it stop |
| NAISEMA Drive | Original clip files (#64) | _founder to fill in_ | Existing plan | The masters the clips were made from are lost |
| Password manager | Recovery details for the accounts above, and the backup passphrase | _founder to fill in_ | Existing plan | Accounts can't be recovered, and no backup can be read |
| npm registry | Libraries installed by `pnpm install` (licences in `THIRD_PARTY_LICENSES`) | Public | Free | Fresh builds fail; the deployed site is unaffected |

## Secrets and settings to look for

Names only.

| Name | Held in | For |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Worker secret | Turnstile |
| `PREVIEW_SECRET` | Worker secret | Signing preview links |
| `NOTIFY_EMAILS` | Worker secret | Who hears about new forms |
| `TURNSTILE_SITE_KEY`, `NEWSLETTER_FORM_URL` | `wrangler.jsonc` (not secret) | The forms' widget and the newsletter link |
| `CLOUDFLARE_API_TOKEN` | GitHub environment secret, one per environment | Deploys, and (read only, in `production-backup`) the weekly backup |
| `BACKUP_PASSPHRASE` | GitHub `production-backup` environment secret, and the password manager | Encrypting the weekly backup |
