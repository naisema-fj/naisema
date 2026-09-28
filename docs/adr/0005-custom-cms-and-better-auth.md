# Build a custom CMS on Workers, with Better Auth for identity

We build the CMS ourselves on Cloudflare Workers rather than adopting Payload CMS on Workers (the official D1/R2 template) or a hosted headless CMS. The core of NAISEMA is not generic publishing but exact-revision review gates (ADR-0003), rights records, Learning Layer authoring (timeline, segments, annotations, activities) and private learner data; owning that model end to end was preferred over bending a CMS's revision and access-control model to fit it, and over depending on a young Payload-on-Workers integration. Authentication, sessions and roles use Better Auth on D1.

## Consequences

- The PRD's "editor-friendly CMS the founder can operate without developer assistance" (CMS-01, AC-08) becomes our own build scope: page/article editing, media library, revisions and rollback, redirects, navigation and exports are all ours to deliver and maintain.
- This substantially enlarges pro bono Phase 1 scope under the Founding Developer Agreement.
- Stack: one Worker using React Router v7 (framework mode) with server rendering for the public site and a separate admin hostname in the same codebase; Drizzle ORM on D1.
- Better Auth owns identity only: sessions, email magic links, two-factor (TOTP) and coarse roles. All resource-level authorisation (Educator assignment, reviewer Review Type and variety scope, no self-approval, per-learner data) lives in one domain authorisation module called server-side on every read and write. There is one user table; a Learner is a user with no staff role, and a staff role is inactive until two-factor is enrolled.
