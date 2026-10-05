# Phase 1a defaults

Recommendations adopted without grilling on 29 September 2026 at the founder's and developer's request. Each item is the working decision for the Phase 1a build and can be reopened by either party; reopening one means recording the change in `docs/decision-log.md`. Items marked **(adviser)** still need the named outside advice before launch. Vocabulary follows `CONTEXT.md`; architectural choices are in `docs/adr/`.

## 1. Upload safety (TECH-02, resource behaviour)

- Only staff (Educators, editors) upload files in 1a. Public forms take no attachments.
- Allowlist: MP4, MOV (video masters); MP3, M4A (audio); PDF; JPEG, PNG, WebP (images). Everything else is rejected before upload starts, and the file's magic bytes must match its declared type.
- Every upload lands in a private **quarantine** R2 bucket. A Queue message triggers a ClamAV scan running in Cloudflare Containers; only clean files are copied to their destination bucket. Failed or infected files stay quarantined, are visible to staff with the reason, and are deleted after 30 days. See ADR-0010.
- Images are re-encoded through Cloudflare Images on the way out, which strips metadata (including location) and neutralises malformed image payloads.
- PDFs are served with `Content-Disposition: attachment` and a restrictive content security policy so they never run in the site's origin.

## 2. Learning Layer structure (VID, VCMS-02/03)

- **Segment:** stable ID, `start_ms`/`end_ms` relative to the clip (plus source offset for an Excerpt), optional speaker, Fijian text, English translation, ordered tokens.
- **Anchoring:** Fijian text is split into tokens with stable IDs; an Annotation points at a start and end token ID within one Segment. Editing text re-tokenises with a diff so unchanged tokens keep their IDs; an Annotation whose tokens disappear is flagged for revalidation, never silently re-pointed. See ADR-0011.
- **Expression:** a reusable, reviewed word or multiword phrase with its general meaning, grammar note and pronunciation guidance. An Annotation links a token range to an Expression and adds the contextual meaning for that moment. Saved vocabulary is keyed on user, Expression and source Revision.
- **Activity types in 1a:** listen and repeat; comprehension (multiple choice); listening discrimination; "what would you say next?" (options or model response); optional real-world prompt with private reflection. Every type stores a prompt, reviewed answers or model response, feedback, whether it is required, and an accessible text alternative, and is on one Segment or the whole clip (listen and repeat always on a Segment). Listen and repeat carries Educator-approved pronunciation guidance; nothing uses the microphone.
- **Completion Rule:** every required Activity attempted with its feedback viewed, by the standard or text route; watching never counts, a real-world prompt is never required, and a Learning Layer with nothing required can't be completed.
- **Timeline editor:** time-entry fields plus "set start/end at playhead", ±100 ms keyboard nudges, segment replay and WebVTT import/export. A waveform view is a SHOULD for later. Validation reports the exact Segment and field (start < end, within duration, ordered, overlaps only when marked intentional).

## 3. Editorial workflow (CMS-02, editorial controls)

- **Revision states:** draft → submitted → approved (all required Review Approvals present) → superseded. **Content Item publication states:** unpublished → published → withdrawn → archived. Only an approved Revision with current rights can be published (ADR-0007).
- **Content Flags**, set by the editor on each Revision, determine the required Review Types:

  | Content Flag | Required review |
  | --- | --- |
  | Language instruction | Language review for the stated Language Variety |
  | Sensitive cultural material | Knowledge Holder Approval |
  | Identifiable children | Safeguarding review plus documented guardian permission |
  | Disability-specific advice | Review by a person with relevant lived or professional experience |
  | Historical claims | Sources attached; editorial review |
  | Opinion or personal experience | Visible label only |

- **Public Review Labels** are generated from the approvals that actually exist ("Language reviewed · Standard Fijian · 12 Oct 2026", "Cultural context reviewed", "Contributor perspective", "Opinion"). There is no generic "verified" badge.
- Required fields before submission: title, summary, primary area, at least one topic, credit, accessible media alternatives, Rights Record, Content Flags.

## 4. Forms, consent and intake (PUB-05, PUB-06, DATA-02)

- All public forms use Cloudflare Turnstile and the Workers rate-limiting binding. A form shows success only after the record is stored; email confirmation is sent after that.
- **Submission** types in 1a: enquiry, contribution proposal, educator interest, consultation interest. Submissions go to a staff queue and never publish automatically.
- Contribution proposals collect a description and contact details only. If the editor wants the material, they send a single-use, expiring upload link that drops files into quarantine (section 1).
- Educator interest collects the EDU-01 category, languages and varieties, experience and intended scope. No evidence is collected until teaching is planned.
- **Consent Record:** purpose, notice version, timestamp, source form and withdrawal time, stored separately from the Submission. Notice versions are stored as content so the exact wording shown is recoverable.
- **Newsletter:** an external double-opt-in newsletter tool (for example Buttondown), with the notice version recorded as a subscriber tag and the tool documented under DATA-04. It is kept separate from operational email (ADR-0004).

## 5. Site structure and URLs

- Six primary areas (Learn, Voices, Discover, Connect, E-zine, Resources) in the header, with a mobile menu. About, Inclusion, Partners, Contact, Privacy and Community standards go in the footer.
- Canonical URLs are `/{area}/{slug}`, plus `/topics/{slug}` for Topic pages. Changing a slug records the old one and serves a 301 redirect.
- Breadcrumbs follow the primary area. Related items are curated by hand.
- The homepage follows the PRD order: purpose and welcome, explore areas, featured content, ways to participate, updates signup, and partners where authorised.
- Generate a sitemap from eligible Revisions. Drafts, Review Links and learner pages are marked `noindex`.

## 6. Accessibility and visual design (A11Y-01–04, §28)

- The target is WCAG 2.2 AA. axe-core runs in Playwright on every pull request.
- Manual passes before release: NVDA with Firefox, VoiceOver on macOS and iOS, TalkBack on Android, keyboard only, 200% zoom and 320 px reflow.
- The founder recruits lived-experience testers, paid for their time, through the Advisory Circle or Community Panel. An accessibility statement page lists known issues and a feedback route.
- Visual direction follows §28 (clean typography, off-white and deep teal, restrained tapa-inspired depth). Build the design system with the repo's `impeccable` skill. Placeholder imagery is labelled as such until commissioned, culturally reviewed artwork arrives.

## 7. Security, operations and delivery (TECH-01–05)

- **CI/CD:** GitHub Actions. Every pull request runs typecheck, lint, Vitest (`@cloudflare/vitest-pool-workers`), Playwright with axe and gitleaks. Merges to `main` deploy to staging. Tagged releases deploy to production after manual approval. D1 migrations run through `wrangler d1 migrations`.
- **Authorisation tests:** the permissions matrix in section 11 is encoded as a table-driven test suite against the domain authorisation module (ADR-0005).
- **Hardening:**
  - a strict content security policy
  - secure, HttpOnly, SameSite cookies
  - CSRF protection on state-changing forms
  - Tiptap JSON rendered through an allowlist renderer
  - secrets held only in `wrangler secret`
  - MFA on Cloudflare, GitHub and email admin accounts
  - Cloudflare's free managed WAF rules enabled
- **Dependencies:** Renovate or Dependabot with weekly batches. Security updates are applied within 7 days, and within 48 hours for criticals.
- **Pre-launch security test:**
  - run the OWASP ZAP baseline scan against staging
  - work through an OWASP ASVS Level 2 checklist
  - explicitly test the PRD's list: access-control bypass, unsafe uploads, script injection, form abuse, expired rights and review states, secret exposure
- **Monitoring:**
  - Workers Observability for logs and errors, with personal details redacted before logging
  - a scheduled Worker that emails the technical owner when error rate, failed email sends, failed Stream processing or failed backups cross a threshold
  - an external uptime monitor as a deliberate exception to the all-Cloudflare rule (ADR-0012)
- **Performance:** server rendering with edge caching, responsive images through Cloudflare Images, and no client JavaScript on pages that don't need it. Load test with k6 at 50 concurrent visitors and 5,000 items before launch.
- **Incident runbook:** detection, containment, evidence preservation, assessment, notification duties and recovery, rehearsed once on staging before launch (PRD §11).

## 8. Saving progress on a poor connection (VTECH-05)

- The client gives every progress event (position, stage, support choices, attempt, save/remove) a UUID and queues it in IndexedDB. Queued events are sent in batches with retries.
- The server ignores duplicate event IDs.
- Conflict rules:
  - Watch position and stage: the latest server-received update wins.
  - Activity completions and saved vocabulary merge; completions never un-complete except under the Revision rules in ADR-0006.
- A "Not yet saved" indicator shows while anything is queued. A save is never reported as successful before the server acknowledges it.

## 9. Voices audio

Cloudflare Stream does not accept audio-only files, so:
- Voices audio lives in R2 and is served by the Worker with byte-range support to a native `<audio>` player.
- A reviewed transcript is required before publication (A11Y-03).
- An RSS podcast feed is generated only once distribution to podcast apps is approved.
- Episodes that are video use the Stream pipeline (ADR-0008).

## 10. Handover (OWN-01–04, AC-08, VAC-10)

A `docs/handover/` folder is maintained from the start, not written at the end. It holds:
- a runbook: deploy, rollback, restore, incident, rotating secrets
- an admin guide for the founder
- an authoring guide for Educators
- a data dictionary generated from the Drizzle schema
- the vendor and account inventory
- the monthly cost report
- the dependency and licence list (MOU §5)

Before launch, the founder rehearses AC-08 unaided: sign in, publish an eligible item, export data, find the runbook.

## 11. Roles and permissions

| Role | Can | Cannot |
| --- | --- | --- |
| Administrator | Manage accounts, role assignments, site settings, feature flags; reset a staff member's two-factor | Read Case contents or evidence; approve reviews by virtue of the role; reset their own two-factor |
| Editor | Create/edit Content Items, Learning Layers and Expressions, assign Educators to Videos and Learning Layers, set Content Flags, request reviews, issue Review Links, record Knowledge Holder Approvals, publish/withdraw eligible Revisions | Approve a Revision they authored or edited; publish without required approvals and rights |
| Educator | Upload; add Learning Layers to Videos they are assigned to, and author the Learning Layers they are assigned to; add Expressions, and change the ones they added while no Learning Layer they aren't assigned to uses them (a change reaches a Learning Layer, and its review, only when that layer is next saved); submit for review | Edit unassigned drafts; publish; see learner records |
| Reviewer | Approve or reject assigned Revisions for their Review Type and Language Variety | Approve outside their scope or their own work |
| Safeguarding lead | Triage and action report Cases, view restricted evidence, hide content pending review | Handle their own appeal decisions (goes to the backup) |
| Privacy contact | Handle data-request Cases, run exports and deletions | Read safeguarding Cases |
| Learner | Read and export their own saves, history and progress; delete their account | Read anyone else's data |

One person may hold several roles (Natasha holds most). Every elevated action is audited. The no-self-approval rule applies across all roles.

## 12. MOU loose ends

- **Governing law (§14) (adviser):** proposed as the law of the Australian state where the founder resides, with remote mediation first (§13). To be confirmed after cross-border advice for Australia and Fiji.
- **Component approvals (§5):** the founder approves in writing, recorded here:
  - Better Auth (MIT)
  - React Router (MIT)
  - Drizzle ORM (Apache-2.0)
  - hls.js (Apache-2.0)
  - Tiptap core (MIT only; no paid Pro extensions)
  - ClamAV (GPL-2.0, run as a separate container and not linked into the app)
  - Cloudflare Workers paid plan, Stream, Images and Containers, within the AUD 100/month ceiling

## 13. People and governance

- **Reviewer and Knowledge Holder compensation:** agree scope, fee or other culturally appropriate recognition in writing before each substantial review. Record it against the review assignment, not the approval, so payment never appears to buy an approval.
- **Advisory Circle:** start with three or four members for 1a under a written remit and conflicts process, including at least one person able to act as backup safeguarding lead and appeal reviewer (clears that launch blocker). Grow toward the PRD's 6–8 over the first term.
- **Content readiness:** an inventory sheet owned by the founder with one row per launch item (area, owner, rights status, reviews needed, status). Launch needs the AC-01 minimum: two approved items per area, one provider listing, one consented Creator Profile with a free sample. External curated resources count.
- **Voices operations:** until the intended interview lead confirms availability, permissions and responsibilities in writing, Voices launches with curated or founder-produced items only.
- **ADR-0005 rationale:** stands as recorded unless the founder or developer corrects it.

## 14. Deliberately deferred

Phase 1b (radio timetables, marketplace directory, E-zine issues), P2 (subscriptions, entitlements, creator publishing, ledger and payouts, parent/heritage/holiday bundles), P3 (forums, cohorts, marketplace orders), P4 (child exchange) and the commercial decisions at the end of PRD §34 each get their own grilling session before their change note. The 1a schema reserves only what the PRD asks to settle early: stable catalogue identifiers and access/rights metadata on every Content Item (§29), and entitlements modelled separately from roles when they arrive.
