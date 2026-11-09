# Change note 0001: Lessons in Learn

**Status:** proposed, not yet agreed. Nothing below is built, and nothing should be built until the sign-off at the end is complete.
**Date:** 9 November 2026
**Changes:** the Phase 1a scope in ADR-0002 (decision log, MOU amendment 1: "Phase 1a as defined in ADR-0002, together with ADRs 0001 onward").
**Design:** ADR-0014, "Lessons are Content Items of their own, not Learning Layers" (in pull request 88 until merged).

## Why this note exists

ADR-0002 scopes Phase 1a to the CMS with rights and review gates, video immersion, Learner Accounts, public browsing of the six areas and minimal directories. Lessons that are not built on a video are not in that list. The decision log says changes to scope need a written change note, and ADR-0014 says the same of itself. This is that note: it says what would be added, what would not, and what has to be true before it is built.

## The change

Add a **Lesson**: an interactive Content Item in Learn, at `/learn/{slug}`, that is not built on a video (CONTEXT.md, **Lesson**). The first Lessons are the ones previewed on apps.naisema.com: body words and possession, and the drua and the vale vakaviti.

A Lesson is a Content Item, so it gets what the others have without new rules:

- immutable Revisions with review fingerprints (ADR-0006);
- Review Approvals scoped by Review Type (ADR-0003): language review always, and Knowledge Holder Approval when it is flagged culturally sensitive;
- Rights Records for its images and sources;
- the single eligibility decision at request time (ADR-0007), so a withdrawn right takes it down at once;
- search, the sitemap, the review label and the audit log, as for any Content Item.

It reuses the Activity model and the Completion Rule from Learning Layers. A Learner's progress is keyed to the Lesson Revision, as it is for a Learning Layer Revision. Its Fijian points to reviewed Expressions, never to dictionary drafts.

## What is new to build

1. **Content type and schema:** a Lesson type, its Revision body (ordered blocks of text, pictures and Activities) and the migration for it. The data dictionary is regenerated.
2. **Authoring:** staff pages for an Educator to create, edit and submit a Lesson, and the Educator guide section that goes with them.
3. **New Activity kinds** as the first Lessons need them: labelling a picture, and building a word or sentence from blocks. Each declares in `KIND_RULES` whether it has choices, a model response and an accessible text alternative, like the existing kinds.
4. **Review and publishing:** the existing review and publishing pages extended to Lessons, with the publish checklist naming what is missing.
5. **Learner page:** a server-rendered Lesson page with one small interactive island for its Activities. Public pages otherwise ship no JavaScript; this is the one exception, and it must run under the strict content security policy with no inline scripts or styles (PRODUCT.md).
6. **Progress:** Lesson progress saved through the existing learner event queue and shown on the learner's private page, including export and deletion with the Learner Account.

## What is not in this change

- Lessons with video. Those stay Learning Layers.
- Courses, pathways, bundles, paid lessons or entitlements (P2 and later).
- Any use of the apps.naisema.com content without NAISEMA's own review and rights. Its material is not served from NAISEMA until it has been through review (the `/apps` hub says so under PUB-01).
- Speech recording or scoring. Listen-and-repeat stays unrecorded, as for Learning Layers.
- Phase 1b modules (ADR-0002).

## Effect on Phase 1a launch

None, if this is agreed as a **post-launch** addition. The recommendation is to launch Phase 1a as scoped and treat Lessons as the first change after launch, because:

- the launch blockers (#5 to #10) are about people, and Lessons would add a second stream of content for the same single Language Reviewer (#7) and Educator (#8);
- the interactive island is the first client-side JavaScript on a public content page, and deserves its own accessibility checks (see below) rather than a rush before launch.

Until a Lesson is built and published, `/apps` keeps saying Lessons are not open yet.

## Acceptance

A Lesson is done when:

- an Educator can create one, an editor can assign review, and it publishes only with every required approval and current rights, with the page listing what is missing;
- unpublishing or withdrawing a right removes it from the public site, search and the sitemap within the 15-minute target already tested for other items (AC-03);
- every Activity works without JavaScript for reading, and has an accessible text alternative; the interactive island is keyboard operable and passes the axe checks and reflow checks already run on the other pages;
- a Learner's progress survives a later Revision of the Lesson, and is exported and deleted with their account;
- the page sets no cookies beyond what other pages set, and analytics carry item IDs only;
- tests cover eligibility, review fingerprints, progress keyed to the Revision, and each new Activity kind, at the level the existing Content Item types have.

## Open decisions for the founder

- **When:** immediately after launch, or later? (Recommended: after launch.)
- **Who writes the first two Lessons**, and are they the Seed Collection Educator (#8) or someone else?
- **Who reviews them:** the same Language Reviewer (#7)? Is a second reviewer wanted if volume grows?
- **Rights:** whose pictures and recordings do the first Lessons use, and is a Rights Record in hand for each?
- **Scope of the first release:** only the two previewed Lessons, or the authoring tool for Educators to add more?
- **Time and cost** of the build: _to be estimated by the developer once the scope above is agreed._
- **Under 18s:** Lessons are likely to be used by families together (CONTEXT.md, caregiver). Confirm no change to the 18+ accounts policy.

## Risks

- A single Language Reviewer becomes the bottleneck for both Learning Layers and Lessons.
- The interactive island can regress accessibility or break the content security policy; the checks above are the guard.
- The apps.naisema.com previews may suggest content is already approved; each Lesson is reviewed on its own Revision before NAISEMA says it is reviewed.

## Sign-off

This change takes effect when both lines are completed, and the decision log gets a line pointing here.

| | Name | Date | Agreed |
| --- | --- | --- | --- |
| Founder | | | |
| Developer | | | |
