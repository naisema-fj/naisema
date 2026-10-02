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

- **Rights evidence before the scan pipeline (1a-06, 30 September 2026):** until the quarantine and ClamAV pipeline exists (issue #14, ADR-0010), rights evidence is stored straight in the private `EVIDENCE` bucket. To limit the risk it must be a PDF, JPEG, PNG or WebP of at most 10 MB whose first bytes, declared type and file extension agree; it is served only to editors, only as a sandboxed download that is never cached; and every download is audited. #14 must route rights evidence through quarantine like every other upload. **Done in 1a-09 (1 October 2026):** evidence is now quarantined and scanned like every upload, and can't be downloaded until it passes. Evidence recorded before then stays where it is, unscanned.
- **What a Rights Record covers before the media library (1a-06):** a Content Item's own Rights Record covers everything in it, including images in an Article body. Media assets get their own Rights Records, checked by `isEligible`, when the media library arrives (#14). **Done (1 October 2026, completing #17):** every media library file an item uses needs a current Rights Record of its own granting Publish; the item's record covers its words and images from other sites.
- **Public site design (1a-07, 1 October 2026):** the "Letters home" direction (`DESIGN.md`) follows PRD §28. It adds two self-hosted typefaces, Jost and Literata (SIL Open Font License 1.1). **Founder approval of these components under MOU §5 is still to be recorded here.** The footer's masi-style strip is a labelled placeholder until commissioned, culturally reviewed artwork replaces it.
- **Production origin (1a-07):** cache purges for production assume the public site is served at `https://naisema.com` (`PUBLIC_ORIGINS` in `wrangler.jsonc`). Change it if production uses another hostname, such as `www.naisema.com`.
- **Edge cache freshness (1a-07):** until a zone purge token is set (runbook, "Public site"), a withdrawn page can still be served from another Cloudflare data centre for up to 5 minutes. Eligibility is still checked on every uncached request.
- **Search, listings and the index (1a-08, 1 October 2026):** search, area pages, the homepage and the sitemap all read one FTS5 index. The index is rebuilt for an item on every public change, and daily for expired rights. A SQL pre-filter on current Publish rights keeps counts, Topic options and the sitemap up to date. Every item shown on a page is re-checked by the eligibility decision (ADR-0007). The sitemap is not re-checked, because it only suggests addresses and each page enforces eligibility itself. Area pages list the newest 20 and link to search for the rest, so cached pages never depend on a query string. The `search_performed` event records IDs, filters and counts only. A search page runs the eligibility decision for up to 20 items, about 165 D1 queries, which is within the Workers Paid limit of 1,000 per request but not the Free plan's 50.
- **Search words in request logs (1a-08):** search words are in the URL, so they don't reach analytics, but they do appear in Workers Logs request URLs (`observability` in `wrangler.jsonc`) for Cloudflare's log retention period. The privacy adviser should confirm this is acceptable, or the logs should drop query strings, as part of #10.
- **D1 export and FTS5 (1a-08):** D1 export does not support virtual tables. Backups (#34) must use Time Travel, or drop and rebuild `search_fts` around an export.
- **Media delivery before media Rights Records (1a-09):** a media library file is served to anyone with its unguessable address as soon as it passes its scan. Its own Rights Records come later; the library shows a placeholder until then. Images and PDFs are only reachable through content that links them. Delivered files are edge-cached for up to 5 minutes and nothing purges them yet, because a ready file can't be withdrawn yet; withdrawing media must purge `/media/...` when it arrives. **Done (completing #17):** a file is delivered only while a Rights Record of its own grants Publish, and a change to its records purges its addresses and the items using it. A file shows publicly only once its rights are recorded, so editors record them before using the file. Delivery asks the same rule as `isEligible` (`isPublishable` in `rights-rules.ts`), one level down: a file has no review or publication state of its own, only rights. Each item shown that uses media library files costs two more D1 queries, so a search page can now exceed the "about 165" counted for 1a-08; still well within Workers Paid. The daily job reindexes every item using a file whose record expired.
- **Scanner signatures and internet access (1a-09):** the scanner container keeps internet access so freshclam can update ClamAV's signatures; the image is rebuilt with fresh signatures on every deploy. ClamAV reports files it can't fully scan (over its size limits, encrypted, broken executables), and those are refused rather than passed. That includes password-protected PDFs.
- **Resources, Pages and Topic pages (1a-18, 1 October 2026):** Resources and Pages share the Article's Revision model and editor rather than having their own, and the admin section is now "Content". Resource files are limited to PDF and audio (MP3, M4A) from the media library, scanned clean, and are downloaded only through their Resource, which decides eligibility on every download (ADR-0007); audio has no media address of its own. Video Resources wait for the video pipeline (#16). Pages are one per footer page and sit outside the six areas. Topics allow one level of subtopics. `content_opened` is counted with a beacon image, because public pages run no JavaScript and are cached at the edge; it records the item ID only, and only while the item is eligible. Anyone can request the beacon, so view counts are indicative, not audited. A Resource's "usage terms" are plain words for visitors, distinct from the Permitted Uses a Rights Record grants (CONTEXT.md). Broken-link reports keep no addresses, only an HMAC of the IP address and the day (keyed with `BETTER_AUTH_SECRET`, so rotating it resets that day's de-duplication).
- **Voices Episodes (1a-19, 1 October 2026):** Episodes are a content type on the shared Revision model and always sit in the Voices area, whose page is the series landing page. 1a ships audio Episodes only; video Episodes come with the video pipeline (#16, blocked by the #4 Stream spike). The "reviewed transcript" of A11Y-03 is an accessibility review that every Episode needs. It covers the audio and the transcript, and the public Review Label reads "Transcript reviewed for accessibility". Audio is streamed through the Episode with byte ranges and is never cached, so a withdrawal or lapsed right stops it at once, at the cost of repeat downloads. An Episode's Revision lists its speakers, music and archive clips, and a Rights Record can cover one of those parts. The Episode still needs its own record, and each part the published Revision lists that has records needs a current one granting Publish; cutting a part in a new Revision lifts its rights rather than leaving the Episode blocked by a record that can't be deleted. Distribution links are part of the Revision, so the editor who publishes it approves them, and an editorial review covers them whenever one is required. There is no RSS feed (§9).
- **Providers, Offerings and Creator Profiles (1a-20, 1 October 2026):** the listings live under **Connect**, not Discover as #26 first said. The founder chose this on 1 October 2026, because Connect is "Classes, courses and people who teach". Providers and Offerings are plain audited listings (decision: content types in 1a), with no Revisions or reviews. Creator Profiles are Content Items, so consent, the portrait's rights and review go through the usual gates. "Partner" depends only on a recorded Partnership Agreement in force; the agreement records where the signed document is kept, not the document itself. Authorised embeds are shown as labelled links in 1a: embedding another site's page would need a per-site `frame-src` in the content security policy, and is left until a Partner asks for it. A Creator's free sample must be a public Na iSema item; every Na iSema item is free in 1a. When an item changes, the items showing it (related, embedded, or as a sample) are refreshed one level deep, which replaces the 5-minute wait accepted for related items in 1a-18. Partnership Agreement days are Fiji's (UTC+12), the calendar Na iSema's agreements are made in. Creator Profiles carry no sponsorship or feature fields: they are Content Items, featured the way other content is (a Topic's lead feature), and sponsored creators aren't part of 1a; a Provider's or Offering's sponsor is always disclosed.
- **Public forms, Submissions and Consent Records (1a-21, 2 October 2026):** the EDU-01 educator categories aren't written down in this repository, so 1a uses "First-language or fluent speaker", "Qualified language teacher", "Community, church or cultural educator", "Linguist or researcher" and "Something else" (`EDUCATOR_CATEGORIES` in `app/lib/submission-fields.ts`). Replace them if the PRD's list differs. Three consent purposes each have their own notice and Consent Record: replying to what was sent (needed on every form), being contacted about consultations (needed on the consultation form), and the newsletter (optional). Their first wordings, in migration 0011, follow the retention defaults above; **the privacy adviser should confirm them (#10)**, and the privacy contact publishes changes at `/admin/notices`. A Submission is due 7 days after it arrives, in Fiji's days, and an upload link works for 7 days; editors can change either. Forms allow 5 sends a minute per address and form. Turnstile's widget is the only script a form page runs. The newsletter tool is Buttondown, to be documented under DATA-04. Staging writes newsletter sign-ups to a table rather than sending them. Someone who unsubscribes through Buttondown's own link is not yet marked withdrawn in their Consent Record, because that needs Buttondown's webhook; the privacy contact reconciles the two on request. Consultation sign-ups feed the external survey tool and spreadsheet register decided above, which are not replaced.

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
