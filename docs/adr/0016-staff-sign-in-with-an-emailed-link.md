# Staff sign in with a link the app emails them

The founder found Cloudflare Access too complicated to set up and run: a Zero Trust team, an application per environment, an allowlist kept beside the staff list, and a team domain and audience tag in the configuration. On 9 November 2026 they chose a plain emailed sign-in link instead, which supersedes the Access part of ADR-0015.

Only an address on the `staff` list gets a link. It works once, for 15 minutes, and opening it only shows a button, so a mail scanner that opens links doesn't use it up. Pressing the button starts a 14-day session in an HttpOnly cookie. Only hashes of the link's token and the session's ID are stored. Every request reads the person's roles from the `staff` table, so taking someone off the list, or marking them as no longer working there, signs them out at once. Links are sent through the Email Service that already sends form notifications.

## Consequences

- **The inbox is the only factor.** Anyone who can read a staff member's email can sign in as them. Staff are asked to turn on two-factor for that email account. There is no two-factor in the app: ADR-0013's staff two-factor gate stays superseded.
- **Email sending is required for sign-in.** If Email Service is down, nobody can sign in until it's back; anyone already signed in keeps working.
- **No account outside the app to keep in step.** Adding someone at `/admin/staff` (or with `pnpm staff:grant` for the first administrator) is all it takes.
