# Change note 0003: The pronunciation library as NAISEMA's own sound guide

**Status:** proposed, not yet agreed. Nothing below is built, and nothing should be built until the sign-off at the end is complete.
**Date:** 15 November 2026
**Changes:** the 14 November entry in the decision log, "The Fijian apps join NAISEMA", which brought the pronunciation library over as a static preview. This is the pronunciation part of issue #118, "Pronunciation, Icavuti and community translation on NAISEMA's model".
**Design:** reuses the review approach proposed in ADR-0017 ("Expressions carry their own language review"), which is itself proposed, not yet accepted.

## Why this note exists

Since 14 November the pronunciation library is on NAISEMA as a copy of the apps site: its markup, a script holding all the letter data, and 24 MP3s (1.3 MB) under `/apps/dictionary/pronunciation/`. It is served as written. Staff can't correct a letter's IPA or English comparison, no recording has a Rights Record, nothing on it can be reviewed on NAISEMA, and the page needs its own script to show anything at all. Issue #118 says what it should become: recordings in the media library with Rights Records naming the speaker, and a letter guide with language review.

This note says what would be built, what would not, and what has to be true before it is.

## What the library holds today

| Item | Today |
| --- | --- |
| Letters | 23: A, B, C, D, E, F, G, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, Y, grouped by the page as 5 vowels and 18 consonants |
| Recordings | 24: one per letter, and one labelled "Dz", each 3.8 to 5.2 seconds, as MP3 |
| Per letter | broad IPA, an English comparison, a short note on how to make the sound, and a status line |
| Review state | "Learning draft": the IPA and English comparisons describe expected sounds and do not certify the recordings. Some recordings are marked "user-supplied". Nothing has had a phonetics review |
| "Dz" | Shown apart, as "Recording under review". It has no IPA and its place in Fijian spelling is unconfirmed |
| Sources named | Schütz's pronunciation guide and _The Fijian Language_ (University of Hawai'i Press), as the basis for the expected sound values |

## The change

Each letter's sound becomes a **Sound** record in Standard Fijian's library, with its own language review. The public page is then built from those records on the server, and its recordings come from the media library under their Rights Records.

### What is new to build

1. **Recordings in the media library.** The 24 MP3s are uploaded as `audio` media with their durations. Each gets a Rights Record naming the speaker as rights holder, with the Permitted Use "publish" and the signed permission attached as evidence where it exists. The public page plays them through the rights-checked media route, so a recording whose permission lapses or is withdrawn stops playing.
2. **A Sound record.** One per letter, holding: the letter as written, its group (vowel or consonant), broad IPA, English comparison, a note on how it is made, its recording, and its Language Variety. "Dz" is a Sound with the group "recording label" and no IPA, as today.
3. **Review of a Sound.** A Language Reviewer for the variety approves a Sound's exact wording, recorded against a fingerprint of that wording (reviewer, variety, fingerprint, date), as Revisions are (ADR-0006). Editing the wording clears the approval until it is approved again. The page says plainly whether each Sound is reviewed or a draft, in the words the Review Labels use. "Dz" keeps its "unconfirmed" label until a reviewer decides what it is.
4. **Staff Sounds screen.** A list with filter by review state, an edit form, and a reviewer's approve action, each audited. It lives beside the other staff screens.
5. **Import.** A one-off import of the 24 entries from the data already in the page's script, so wording is carried over exactly. Every imported Sound starts as a draft, because no NAISEMA Language Reviewer has approved it.
6. **Public page, built on the server.** The page keeps its address, `/apps/dictionary/pronunciation/`, and `#B`-style links to a letter keep working. Every Sound is listed with a plain audio control that works without JavaScript. The present script becomes an optional extra (the large featured letter, the speed button, tap-to-select), under the same strict script policy as now.
7. **Retire the copy.** Once the page is built from the library, the static `audio/` folder and the data in `app.js` leave `public/apps`.

### What is not in this change

- **Linking words to sounds.** Issue #118 allows a link from the Expressions that use a sound, "if wanted". Expressions already have a free-text `pronunciation` field. A real link needs Vosa on the Expression library (change note 0002, #116), which is proposed and not signed off, so this waits for it.
- **Practice activities.** "Listen and repeat" and "listening discrimination" already exist as Learning Layer Activities. Reusing Sounds in them can follow this change.
- **New recordings, other Language Varieties, and letters Standard Fijian spelling may add** (for example, whether "Dz" is one). That is a decision for the reviewer, not this change.
- **The rest of #118:** the Vakavanua guide, Icavuti and community translation each need their own note.

### Why a record of its own, not a Content Item

Making each letter a Content Item with Revisions was considered and rejected. It would add 24 Content Items, each needing an area, a Topic and the publishing steps built for articles and videos, for records of a few lines each, and none of the existing kinds fits: a Resource is a download or a link, and a Page is one of the fixed footer pages. A Sound needs review per letter, and an approval on a fingerprint gives that without the rest. This is the same reasoning ADR-0017 gives for dictionary entries.

## Effect on launch

None. NAISEMA is live and the library is already public as a preview. This replaces that preview and does not remove it until the new page is working.

## Acceptance

This change is done when:

- all 24 recordings are in the media library, each with a Rights Record that names the speaker and has not been withdrawn or expired, and the public page plays each from there;
- a recording whose Rights Record is withdrawn or expired no longer plays, and the page says so instead of failing silently;
- every letter and the "Dz" label appear on the public page with the wording they have today, counted against the preview, none lost or duplicated;
- a Sound shows as reviewed only while a Language Reviewer's approval matches its current wording, and editing it shows it as a draft again;
- the page lists the sounds and plays them with JavaScript turned off, and passes the axe and reflow checks the other pages pass;
- links such as `/apps/dictionary/pronunciation/#Q` still open on that letter;
- tests cover the review fingerprint, the import counts, and the rule that a recording plays only while its rights allow, at the level the Content Item rules have.

## Decisions for the founder

Each has the answer proposed here. They become decisions when the sign-off below is completed.

- **Speakers and permission.** _Founder, 15 November 2026:_ the recordings were made by the NAISEMA team. Still needed before step 1 can be completed: the name of the speaker for each of the 24 recordings, and a short written permission from each to publish their voice (an email saying they agree to NAISEMA publishing their recording of the letters is enough), kept as the Rights Record's evidence. If the speakers are staff or contractors, check whether their agreements already cover it. This does not hold up the rest of the build: Sounds, the staff screen and the page can be built first, and the Rights Records filled in as the names and permissions arrive. Until a recording has a Rights Record it should not be called published under NAISEMA's rules.
- **Own record or Expressions.** Proposed: Sounds are a record of their own. A letter is not a word, and an Expression is a word or phrase with a meaning. It costs one small table, reuses the review rules proposed for Expressions, and does not wait on #116.
- **Drafts on the public site.** Proposed: show every Sound, labelled "not reviewed yet", as the preview does now. The label says exactly what has been checked, and an empty page helps nobody.
- **"Dz".** Proposed: keep it on the page as "recording under review" until the reviewer decides what it is. Hiding it would look like a ruling on Fijian spelling that nobody has made.
- **Who reviews.** Proposed: the same Language Reviewer (#7) who reviews Learning Layers; a second reviewer for 24 sounds is more than is needed. The condition is that the reviewer listens to the recordings and does not review from the IPA alone, because the page says the IPA describes expected sounds, not these recordings. The sign-off should say so.
- **Order of work.** Proposed: build the Sound records, the staff screen and the server-rendered page first, then add rights and review as the speaker names and the reviewer arrive.
- **Time and cost** of the build: _to be estimated by the developer once the founder has agreed the above._

## Risks

- The speakers' names and permissions are the likely blocker. Recordings shown publicly without a Rights Record go against the rule that media is public only while its own rights allow.
- The IPA and English comparisons are an expected-sound guide, not a check of these particular recordings. The page must keep saying so until a reviewer has listened, or a reader may take a draft for a ruling on how Fijian is pronounced.
- Five recordings (K, N, O, S and V) are marked "user-supplied", so their origin is less clear than the rest. The import should carry that status over as a note on the Sound.
- If this goes ahead before change note 0002, two reviews exist side by side for a while (Sounds and Expressions) with different tools.

## Sign-off

This change takes effect when both lines are completed, and the decision log gets a line pointing here.

| | Name | Date | Agreed |
| --- | --- | --- | --- |
| Founder | | | |
| Developer | | | |
