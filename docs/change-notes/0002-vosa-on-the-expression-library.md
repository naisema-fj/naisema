# Change note 0002: Vosa on the Expression library

**Status:** agreed by the founder on 15 November 2026, with the decisions recorded under "Decisions".
**Date:** 15 November 2026
**Changes:** the v1 scope in the decision log ("v1 launch rewrite"), which dropped the Vosa dictionary pages, and the 14 November entry "The Fijian apps join NAISEMA", which brought them back as a static preview.
**Design:** ADR-0017, "Expressions carry their own language review, so Vosa can be built on them".

## Why this note exists

Since 14 November, Vosa is on NAISEMA as a copy of the apps site: its markup, scripts and a 1 MB data file under `/apps/dictionary/`. Staff can't edit it, nothing in it can be reviewed on NAISEMA, and an approved "suggest a word" has nowhere to go, so the Suggest → Review → Publish steps the page promises stop at Review. Learning Layers already keep an Expression library, and change note 0001 says Lessons must point to it. This note moves Vosa onto that library, so there is one Fijian word list, reviewed once, used by the dictionary, the Learning Layers and the Lessons.

This is the first of three steps for the Fijian apps, each with its own issue: this one (#116), Lessons (change note 0001, #117) and the remaining apps: pronunciation, Icavuti and community translation (#118).

## The change

Every Vosa entry and saying becomes an **Expression** in the Standard Fijian library, with its own language review (ADR-0017). The public dictionary is then built from the library, on the server, instead of from the apps site's data file.

What Vosa holds today, and where it goes:

| On the apps site | On NAISEMA |
| --- | --- |
| 1,352 dictionary senses | Expressions (headword, general meaning, notes), with what Vosa adds: English part of speech, Tuvavosa role, examples, related words, a comparison, scientific name, image links and search words |
| 161 sayings (Vosavosavakaviti) | Expressions of kind "saying", with their literal meaning |
| 67 Tuvavosa grammar terms and their tables | Expressions of kind "grammar term", with their explanation and example |
| 228 sources, cited by page | Citations on each Expression. The two documents NAISEMA hosts (the volavosa scan and the 1893 handbook) get Rights Records |
| Word themes (Fish of Fiji, Calendar and so on) | Themes on each Expression. Not Topics: Topics tag Content Items, and an Expression is not one |
| "Needs review" / "English checked" states | Brought over as notes on each draft. No entry starts out reviewed on NAISEMA, because no NAISEMA Language Reviewer has approved it yet |
| The quizzes ("inquiries"), about 600 KB of hand-written script tied to entries | Kept as code for now, keyed to the Expression's id, and shown on its entry page |

## What is new to build

1. **Schema:** the extra Expression fields above, the Expression's kind (word, saying, grammar term), its citations and themes, and a record of each language Review Approval on an Expression's exact wording (reviewer, Language Variety, wording fingerprint, date). The migration, and the data dictionary regenerated.
2. **Import:** a one-off import of the dataset as the dictionary page shows it, after the repairs its script makes when it loads (the `ensure…` functions in `public/apps/dictionary/app.js`), not the raw data file. Entries keep their apps-site ids, so links and quizzes still find them.
3. **Staff Expressions screen:** list, search and filter by review state; edit an Expression, which clears its approval when the wording changes; a Language Reviewer approves it. Each action goes in the audit log.
4. **From a Submission to an Expression:** from a "suggest a word" or "correct a dictionary entry" Submission, staff make a draft Expression or open the one it is about. This is the step the suggestion form promises.
5. **Public dictionary:** server-rendered from the library. Search works without JavaScript, every Expression has its own address, and the dictionary's views (themes, Tuvavosa, sayings) are listings of the library. Each entry says plainly whether it has been reviewed and for what, in the words the Review Labels use. The quizzes are the page's one interactive part, under the same strict content security policy.
6. **Retire the copy:** `/apps/dictionary/` sends people to the new addresses, and Vosa's data file and dictionary scripts leave `public/apps`. The pronunciation library, the Vakavanua guide and Icavuti stay on the preview until the third step.

## What is not in this change

- Learning Layers: their Annotations, their copies of Expressions and their review are unchanged (ADR-0017, "Consequences").
- Turning the quizzes into Activities. That can follow Lessons, which add new Activity kinds.
- Other Language Varieties. Vosa is Standard Fijian.
- Pronunciation recordings, the Vakavanua guide, Icavuti and community translation (the third step).

## Effect on launch

None. NAISEMA is live and Vosa is already public as a preview; this replaces that preview.

## Acceptance

This change is done when:

- every entry, saying and grammar term from the apps site is in the library with its citations, themes and quiz, and none is lost or duplicated, as counted against the dictionary page;
- an Expression shows as reviewed only while a Language Reviewer's approval matches its current wording, and editing it shows it as a draft again;
- a "suggest a word" Submission can become a draft Expression, and an approved one appears in the public dictionary;
- the public dictionary searches, lists and shows entries without JavaScript, and each entry page passes the axe and reflow checks the other pages pass;
- the old `/apps/dictionary/` addresses lead to the new ones;
- tests cover the review fingerprint, the import counts, the Submission step and the public search, at the level the Content Item rules have.

## Decisions (founder, 15 November 2026)

- **Drafts on the public site:** shown, labelled "not reviewed yet". Reviewed entries come first in results.
- **Who reviews:** the founder, as Language Reviewer for Standard Fijian. They need the Language Reviewer role for Standard Fijian on the staff list. As for Revisions, nobody approves an Expression whose current wording they wrote.
- **Address:** `/vosa/`, with one address per headword (`/vosa/{word}`).
- **Rights:** yes: Rights Records are to be made for the two hosted source documents (the volavosa scan and the 1893 handbook). The image links stay links to other sites, so they need none.
- **Time and cost:** built by Claude Code at the founder's request.

## Risks

- One Language Reviewer for both Learning Layers and 1,580 dictionary entries is a bottleneck; the dictionary would stay mostly drafts for a long time.
- The import must reproduce what the page shows after its repairs; a raw import of the data file would show older meanings for some entries.
- The quizzes are hand-written code tied to entry ids; renaming or merging an Expression can orphan its quiz.

## As built (15 November 2026)

What differs from the plan above, and why:

- **The quizzes** became data, not code: the apps site's quiz scripts were run once and their result kept in `app/lib/vosa-data/word-play.json`, keyed by headword as before. The server renders them, so they work without JavaScript; one small script (`public/vosa/quiz.js`) answers a choice at once. A quiz shows on the sense the apps site showed it on, the first whose English it had checked.
- **The import** is four migrations (`0005` to `0008`), made from the dictionary page's own data after its load-time repairs, so production gets the library when it deploys. Each Expression keeps the apps site's id, and its record from the apps site (whether its English had been checked there, and its working notes) is kept for staff; it isn't a NAISEMA review.
- **Addresses:** each headword has one page at `/vosa/{word}`, keeping macrons and a trailing hyphen (`vūtū` and `vutu`, `vaka-` and `vaka` are different pages). Vosa's views are `/vosa?view=themes`, `tuvavosa` and `sayings`, so no word's address is taken by a view.
- **The old copy:** `/apps/dictionary/` sends people to `/vosa`, except its Vakavanua and Icavuti views, which stay on the preview until #118. Their scripts still read the apps site's data file, so that file stays in `public/apps` until then.
- **Data dictionary:** v1 has no generated data dictionary (it was dropped in the rewrite), so the new columns and the `expression_review` table are described in `db/schema.ts` and `migrations/0004_vosa_expressions.sql`. The weekly backup and `pnpm db:export` copy the whole database, so they include them.
- **Staff screens:** **Expressions (Vosa)** on the staff site, for editors (who change wording) and Language Reviewers (who approve it). An approval carries the fingerprint of the wording the reviewer was shown, so a wording changed in the meantime is never approved by mistake.

## Sign-off

This change takes effect when both lines are completed, and the decision log gets a line pointing here.

| | Name | Date | Agreed |
| --- | --- | --- | --- |
| Founder | The founder (in a Claude Code session) | 15 November 2026 | Yes |
| Developer | | | |

The founder asked for the build to start on these decisions. The developer line is left for the Founding Developer, if the MOU needs it for a change built by Claude Code at the founder's request.
