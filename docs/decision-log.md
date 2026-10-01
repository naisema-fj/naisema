# Decision log

Non-architectural decisions, agreed amendments and launch blockers from the PRD v5.0 grilling session. Architectural decisions live in `docs/adr/`; vocabulary lives in `CONTEXT.md`; the working defaults adopted without grilling live in `docs/phase-1a-defaults.md`.

## Operational owners (PRD §34 decision 3)

| Role | Owner | Backup |
| --- | --- | --- |
| Editor | Natasha Mar | — |
| Education Lead | Natasha Mar | — |
| Language Reviewer | Natasha Mar (qualification and variety not yet recorded) | — |
| Safeguarding Lead | Natasha Mar | **Launch blocker** |
| Privacy contact | Natasha Mar | — |
| Technical owner | Taia Tiniyara | **Launch blocker** |

No-self-approval is enforced in code from day one: nobody approves a Revision they authored or edited.

Administrators may grant roles to themselves (decided 29 September 2026). With one person holding every editorial role, blocking self-grants would only add friction; every grant is audited, and the no-self-approval rule above still applies to the roles an administrator holds.

## Phase 1a product scope

- **Content types in 1a:** Page, Article (E-zine), Episode (Voices), Resource, Provider and Offering (plain listings), Creator Profile with one free sample, Topic, and video Content Items with Learning Layers.
- **Deferred to 1b:** Radio Station and Radio Programme with timetables, Marketplace listing (MKT-01), E-zine Issue, featured slots, richer Offering filters.
- **Language Variety for the Seed Collection:** Standard Fijian only. Variety is still recorded on every Learning Layer and language Review Approval.
- **Consultation (GOV-01, GOV-02):** an approved external survey tool and an access-controlled Na iSema-owned spreadsheet register in 1a; storage location and deletion documented under DATA-04.
- **Reports and data requests (SAFE-03, DATA-03):** one in-app Case queue covering reports, rights concerns and data requests.
- **Search (PUB-03):** D1 full-text search (FTS5) built from eligible Revisions.
- **Rich text:** article and page bodies are stored as Tiptap/ProseMirror JSON with a small fixed block set (headings, lists, links, quotes, images with required alt text, embedded Content Items, callouts); exported as JSON and HTML.
- **Analytics:** Cloudflare Web Analytics (cookieless) for traffic; Workers Analytics Engine for server-side product events carrying item/area IDs only, never learner IDs. Privacy adviser to confirm whether a consent banner is needed.

## Data and age policy (PRD §34 decision 4)

- **Accounts:** 18+ self-declared Learner Accounts only; no under-18 accounts.
- **Hosting:** Cloudflare with Oceania location hints; overseas processing disclosed (ADR-0004).
- **Learner data:** history clearing is immediate; account deletion removes live data immediately and leaves backups within 35 days; accounts inactive for 24 months are deleted after a 30-day warning email; self-service JSON export from the private learning page.
- **Retention defaults:** PRD §11 defaults adopted (unsuccessful educator evidence 90 days; routine enquiries 12 months; identifiable consultation data 12 months after analysis). Closed Cases kept 2 years after closure, then reviewed for deletion or de-identification. Audit events kept for the life of their object plus 2 years. All subject to privacy adviser confirmation.
- **Backups:** D1 Time Travel (30 days) plus nightly D1 export to a private R2 bucket kept 35 days; deletion ledger replayed after any restore (ADR-0009); restore drill on staging before launch.

## Video implementation decisions (PRD §34 "Video implementation decisions")

- **Seed Collection:** three clips of 30–120 seconds, at least one vertical and one landscape, across at least two everyday or cultural contexts; Standard Fijian.
- **Upload limits:** 2 GB and 15 minutes per source master; MP4 and MOV only, validated at upload start. Longer sources are used through Excerpts.
- **Caption authoring:** Segments are the source of truth; WebVTT import/export; machine transcripts only as unreviewed drafts (ADR-0008).
- **Default Completion Rule:** every required activity attempted with feedback viewed, or its accessible equivalent; viewing alone never completes; real-world use is optional.
- **Cost envelope:** about AUD 100/month ceiling for 1a, with Cloudflare billing alerts at 50% and 80% and media usage visible in the VAC-10 cost report.
- **Test profile:** PRD profile (1.5 Mbps down, 150 ms latency, five cold runs, first frame within 5 s in at least 4) on one mid-range Android (Moto G / Samsung A class) and one older iPhone (SE class), plus Playwright with the same throttling in CI on player changes. Exact device models to be recorded here.

## Interim decisions during the 1a build

- **Rights evidence before the scan pipeline (1a-06, 30 September 2026):** until the quarantine and ClamAV pipeline exists (issue #14, ADR-0010), rights evidence is stored straight in the private `EVIDENCE` bucket. To limit the risk it must be a PDF, JPEG, PNG or WebP of at most 10 MB whose first bytes, declared type and file extension agree; it is served only to editors, only as a sandboxed download that is never cached; and every download is audited. #14 must route rights evidence through quarantine like every other upload.
- **What a Rights Record covers before the media library (1a-06):** a Content Item's own Rights Record covers everything in it, including images in an Article body. Media assets get their own Rights Records, checked by `isEligible`, when the media library arrives (#14).
- **Public site design (1a-07, 1 October 2026):** the "Letters home" direction (`DESIGN.md`) follows PRD §28. It adds two self-hosted typefaces, Jost and Literata (SIL Open Font License 1.1). **Founder approval of these components under MOU §5 is still to be recorded here.** The footer's masi-style strip is a labelled placeholder until commissioned, culturally reviewed artwork replaces it.
- **Production origin (1a-07):** cache purges for production assume the public site is served at `https://naisema.com` (`PUBLIC_ORIGINS` in `wrangler.jsonc`). Change it if production uses another hostname, such as `www.naisema.com`.
- **Edge cache freshness (1a-07):** until a zone purge token is set (runbook, "Public site"), a withdrawn page can still be served from another Cloudflare data centre for up to 5 minutes. Eligibility is still checked on every uncached request.
- **Search, listings and the index (1a-08, 1 October 2026):** search, area pages, the homepage and the sitemap read one FTS5 index that is rebuilt per item on every public change and daily for expired rights. Every item shown is re-checked by the eligibility decision (ADR-0007). Area pages list the newest 20 and link to search for the rest, so cached pages never depend on a query string. The `search_performed` event records IDs, filters and counts only.
- **D1 export and FTS5 (1a-08):** D1 export does not support virtual tables. Backups (#34) must use Time Travel, or drop and rebuild `search_fts` around an export.

## Agreed amendments to the Founding Developer Agreement / MOU

1. **§3 scope:** "Na iSema Overall Web App PRD v5.0 (28 September 2026), Phase 1a as defined in ADR-0002, together with ADRs 0001 onward." Phase 1b needs a separate written change note.
2. **§1 purpose:** replace "a proposed digital platform for iTaukei identity, language and connection" with the PRD's purpose statement (designed especially for Fijians abroad and open to all).
3. **§10 support:** agree a defined post-launch support period in writing before 1a launch (proposed: 3 months, best-effort, Fiji business hours) and amend PRD TECH-04 targets to what that support can deliver.
4. **§4 assignment:** add "or a Na iSema entity nominated by the Founder in writing" as assignee.

## Phase 1a launch blockers

- [ ] Backup Safeguarding Lead and independent appeal reviewer named, proposed from the initial Advisory Circle (owner: Natasha Mar). #5
- [ ] Backup technical owner for alerts named (owner: Natasha Mar). #6
- [ ] Qualified Language Reviewer confirmed, with qualification and language variety recorded (LEARN-01) (owner: Natasha Mar). #7
- [ ] At least one Educator other than the Language Reviewer named to author the Seed Collection (owner: Natasha Mar). #8
- [ ] Written post-launch support agreement (MOU §10) (owners: Natasha Mar, Taia Tiniyara). #9
- [ ] Privacy adviser sign-off on overseas-processing disclosure (ADR-0004). #10

## Backlog

Phase 1a work is tracked as GitHub issues in naisema-fj/naisema, titled with a stable `[1a-NN]` ID.

| ID | Issue | Title |
| --- | --- | --- |
| 1a-00 | #3 | Confirm Phase 1a scope and component approvals in writing (human; blocks 1a-01) |
| 1a-01 | #11 | Walking skeleton |
| 1a-02 | #4 | Spike: Stream playback and segment timing (Phase 0) |
| 1a-03 | #12 | Staff sign-in, two-factor and the permission module |
| 1a-04 | #13 | Articles with immutable Revisions |
| 1a-05 | #15 | Review gates |
| 1a-06 | #17 | Rights Records and Permitted Uses |
| 1a-07 | #18 | Public site shell |
| 1a-08 | #21 | Public search |
| 1a-09 | #14 | Upload safety pipeline |
| 1a-10 | #16 | Video asset pipeline |
| 1a-11 | #19 | Learning Layer authoring: Segments |
| 1a-12 | #22 | Learning Layer authoring: Annotations |
| 1a-13 | #23 | Learning Layer authoring: Activities |
| 1a-14 | #28 | Learning Layer review and publishing |
| 1a-15 | #29 | Learner player |
| 1a-16 | #31 | Progressive immersion flow |
| 1a-17 | #33 | Learner Accounts |
| 1a-18 | #24 | Resources, Pages and Topic pages |
| 1a-19 | #25 | Voices Episodes |
| 1a-20 | #26 | Providers, Offerings and Creator Profiles |
| 1a-21 | #27 | Public forms and consent |
| 1a-22 | #30 | Case queue |
| 1a-23 | #32 | Exports and audit log |
| 1a-24 | #34 | Backups and deletion ledger |
| 1a-25 | #20 | Monitoring and cost report |
| 1a-26 | #41 | Administrator resets a staff member's two-factor |
| 1a-B1–B6 | #5–#10 | Launch blockers (human) |

## Open, not blocking the build baseline

- **Content readiness and Voices operations (PRD §34 decisions 6 and 8):** process adopted in `docs/phase-1a-defaults.md` §13; the actual inventory and the interview lead's confirmation are still outstanding.
- **MOU governing law (§14):** proposal in `docs/phase-1a-defaults.md` §12, pending cross-border legal advice.
- **Commercial model, growth and measurement (PRD §34 decisions 9–10):** out of 1a scope; decide before P2 and after beta baselines respectively.
- **Phase 1b and P2–P4 modules:** not grilled in this session; each needs its own session before its change note.
- **PRD housekeeping:** page headers read "PRD v2.0" while the title is Version 5.0; §15 refers to itself ("as specified in section 15").
