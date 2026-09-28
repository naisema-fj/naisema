# Decision log

Non-architectural decisions, agreed amendments and launch blockers from the PRD v5.0 grilling session. Architectural decisions live in `docs/adr/`; vocabulary lives in `CONTEXT.md`.

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

## Phase 1a product scope

- **Content types in 1a:** Page, Article (E-zine), Episode (Voices), Resource, Provider and Offering (plain listings), Creator Profile with one free sample, Topic, and video Content Items with Learning Layers.
- **Deferred to 1b:** Radio Station and Radio Programme with timetables, Marketplace listing (MKT-01), E-zine Issue, featured slots, richer Offering filters.
- **Language Variety for the Seed Collection:** Standard Fijian only. Variety is still recorded on every Learning Layer and language Review Approval.
- **Consultation (GOV-01, GOV-02):** an approved external survey tool and an access-controlled NAISEMA-owned spreadsheet register in 1a; storage location and deletion documented under DATA-04.
- **Reports and data requests (SAFE-03, DATA-03):** one in-app Case queue covering reports, rights concerns and data requests.
- **Search (PUB-03):** D1 full-text search (FTS5) built from eligible Revisions.
- **Rich text:** article and page bodies are stored as Tiptap/ProseMirror JSON with a small fixed block set (headings, lists, links, quotes, images with required alt text, embedded Content Items, callouts); exported as JSON and HTML.
- **Analytics:** Cloudflare Web Analytics (cookieless) for traffic; Workers Analytics Engine for server-side product events carrying item/area IDs only, never learner IDs. Privacy adviser to confirm whether a consent banner is needed.

## Agreed amendments to the Founding Developer Agreement / MOU

1. **§3 scope:** "NAISEMA Overall Web App PRD v5.0 (28 September 2026), Phase 1a as defined in ADR-0002, together with ADRs 0001 onward." Phase 1b needs a separate written change note.
2. **§1 purpose:** replace "a proposed digital platform for iTaukei identity, language and connection" with the PRD's purpose statement (designed especially for Fijians abroad and open to all).
3. **§10 support:** agree a defined post-launch support period in writing before 1a launch (proposed: 3 months, best-effort, Fiji business hours) and amend PRD TECH-04 targets to what that support can deliver.
4. **§4 assignment:** add "or a NAISEMA entity nominated by the Founder in writing" as assignee.

## Phase 1a launch blockers

- [ ] Backup Safeguarding Lead and independent appeal reviewer named (owner: Natasha Mar).
- [ ] Backup technical owner for alerts named (owner: Natasha Mar).
- [ ] Qualified Language Reviewer confirmed, with qualification and language variety recorded (LEARN-01) (owner: Natasha Mar).
- [ ] At least one Educator other than the Language Reviewer named to author the Seed Collection (owner: Natasha Mar).
- [ ] Written post-launch support agreement (MOU §10) (owners: Natasha Mar, Taia Tiniyara).
- [ ] Privacy adviser sign-off on overseas-processing disclosure (ADR-0004).
