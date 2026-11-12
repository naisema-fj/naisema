# NAISEMA

A digital connection and learning platform for Fijians abroad, open to all. It connects people with cultural stories, media, existing learning providers, creators and optional video-based language learning.

The product name is written **NAISEMA**. Lower-case `naisema` appears only in technical identifiers (domains, repository, Worker, database and bucket names), which must be lower case.
_Avoid_: Na iSema, Naisema, NaiSema

## Content and learning

**Content Item**:
A canonical piece of published cultural or editorial material (story, article, Voices episode, resource) with one URL and a primary area. Its type is Article, Resource, Episode, Creator Profile, Video or Page; all share Revisions and review.
_Avoid_: Cultural item, post, page (for content other than a Page)

**Resource**:
A Content Item a visitor downloads (a scanned PDF or audio file) or follows (an external link with a last-checked date), shown with its language, age guidance, accessibility and usage terms first.

**Episode**:
A NAISEMA Voices recording published as a Content Item in the Voices area: its audio, host and guests, approved distribution links and a full transcript.
_Avoid_: Podcast (until distribution to podcast apps is approved), show

**Usage Terms**:
What a Resource tells visitors they may do with it, in plain words (for example "free to print for teaching"). Not a Permitted Use, which is what a Rights Record grants NAISEMA.

**Video**:
A Content Item showing one piece of Footage, which its Learning Layer is built on.

**Page**:
A Content Item backing one of the fixed site pages in the footer (About, Privacy and so on), at `/{slug}`, outside the primary areas and Topics.

**Learning Layer**:
An optional language-learning overlay on a Video, covering either the whole video or one Excerpt, with its own level, segments, annotations, activities and completion rule. In v1 a Video has at most one, kept inside the Video's Revision and reviewed with it (ADR-0015).
_Avoid_: Lesson (a Lesson has no video), VideoLearningObject, learning object, practice unit

**Lesson**:
An interactive Content Item in Learn that isn't built on a video (ADR-0014): pictures, words and Activities with its own Completion Rule, reviewed and published by Revision like any Content Item. Its Fijian points to Expressions.
_Avoid_: Learning Layer (that is on a video), course, module

**Segment**:
A timed span of a Learning Layer's clip holding the Fijian text, English translation and optional speaker for that span.
_Avoid_: Cue, caption line (for the record)

**Token**:
One word of a Segment's Fijian text (each part of a hyphenated compound is its own token), with an ID that stays the same when the text around it is edited, so Annotations stay anchored to it.
_Avoid_: Character offset (as an anchor)

**Expression**:
A reviewed word or multiword phrase, with its general meaning, that Annotations point to and Learners save. Expressions are kept in a library for each Language Variety and reused across Learning Layers.
_Avoid_: Vocab item, word (when a phrase or idiom is meant)

**Annotation**:
A link from a range of tokens in one Segment to an Expression, carrying the contextual meaning at that moment.
_Avoid_: Tooltip, gloss

**Context Note**:
A cultural or context note on a whole Learning Layer or one Segment, always with who the knowledge comes from.
_Avoid_: Caption, tooltip

**Vocabulary List**:
The Expressions an Educator chose from a Learning Layer's Annotations, each with the moments it occurs.

**Activity**:
A practice or comprehension task in a Learning Layer, on one Segment or the whole clip, with reviewed answers or a model response, feedback and an accessible text alternative. In 1a: listen and repeat (with the Educator's pronunciation guidance, never recorded), comprehension, listening discrimination, "what would you say next?" and the optional real-world prompt.
_Avoid_: Quiz, exercise

**Completion Rule**:
The Educator-defined condition under which a Learner has completed a Learning Layer; by default every required activity attempted with feedback viewed (or its accessible equivalent). The Educator defines it by marking Activities required; with none required it can't be met. Watching alone never satisfies it, and real-world use is never required.
_Avoid_: Finished, mastered, passed

**Immersion Route**:
The guided order of eight Stages a Learner is led through on a Learning Layer, from watching naturally to using it with someone. Any Stage can be opened, skipped or revisited, and help asked for, without penalty.
_Avoid_: Lesson plan, course

**Stage**:
One step of the Immersion Route, deciding what the player shows (which captions, whether English is on the page at all, meanings, notes) and which Activities are done in it.
_Avoid_: Level, step (in the record; learners read "step")

**Footage**:
The MP4 media file a Video plays, kept in the media library with its length and picture size, served from NAISEMA's own address (ADR-0015). Its original is kept in the NAISEMA Drive.
_Avoid_: Video Asset (Phase 1a's Stream-processed master), clip

**Excerpt**:
A bounded portion of a longer source video, defined by source in/out times, that a Learning Layer is built on.
_Avoid_: Clip (when meaning a portion of a longer source)

**Language Variety**:
A named form of Fijian (for example Standard Fijian) recorded on every Learning Layer and every language Review Approval.
_Avoid_: Dialect, language (when the variety is meant)

**Seed Collection**:
The small, reviewed set of Learning Layers that must exist and pass acceptance before Phase 1a launches.
_Avoid_: Pilot content, sample videos

**Learning Unit**:
An ordered step inside a later-phase bundle or Pathway; not a synonym for Learning Layer or Lesson.
_Avoid_: Lesson (a Lesson is a Content Item a Learning Unit may point to)

**Pathway**:
A described route for a type of learner (heritage, beginner, parent-led) through existing resources and Learning Layers.
_Avoid_: Programme (unqualified)

## Review and approval

**Revision**:
An immutable snapshot of a Content Item or Learning Layer at one save; approvals, publication and learner progress refer to a specific Revision.
_Avoid_: Version (for content), draft (as a noun for a snapshot)

**Review Type**:
A kind of specialist sign-off (language, cultural, editorial, accessibility, safeguarding) that covers a defined set of fields on a revision.

**Review Approval**:
A recorded decision by a reviewer, for one Review Type, on one exact revision.
_Avoid_: Sign-off, badge, verified (for content)

**Content Flag**:
An editor-set marker on a Revision (language instruction, sensitive cultural material, identifiable children, disability-specific advice, historical claims, opinion) that determines which Review Types are required.

**Review Label**:
The public statement of what a published item was actually reviewed for, generated from its Review Approvals.
_Avoid_: Badge, verified

**Rights Record**:
The legal permission attached to a media asset or contributed work: rights holder, evidence, expiry, withdrawal and a set of Permitted Uses. A record can cover the whole item or one part an Episode lists with rights of its own (a speaker or guest, a piece of music, an archive clip).
_Avoid_: Licence (for the record), consent (for rights)

**Permitted Use**:
One specific use a Rights Record grants: publish, excerpt, translate, transcribe, educational adaptation, commercial or AI training. Each is granted separately; none implies another.

**Preview Link**:
A view-only link to one exact Revision, with its media, for a reviewer or Knowledge Holder without an account. It is signed, lasts 14 days, and all of them end when the signing secret is rotated (ADR-0015).
_Avoid_: Review Link (Phase 1a's stored, revocable kind), share link

**Knowledge Holder**:
A person or authority with standing to permit use of culturally sensitive knowledge; permission from a Knowledge Holder is separate from legal rights and from founder approval.
_Avoid_: Elder (as a role), cultural reviewer

**Knowledge Holder Approval**:
A cultural Review Approval given by a Knowledge Holder and recorded by an editor on their behalf, stating how it was given, the exact revision seen and any conditions. In v1 they usually see it through a Preview Link.

## People and roles

**Contributor**:
Anyone whose story, recording or knowledge appears in NAISEMA content; a rights and credit relationship, not necessarily an account.
_Avoid_: Author (for non-staff), participant

**Creator**:
A Contributor with a public Creator Profile and their own channel of work. A Creator Profile is a Content Item in Connect: their chosen public name, biography, a general location, languages, kinds of work, a consented portrait and one free sample.
_Avoid_: Influencer, channel owner

**Learner**:
An adult (18+) using Learn, without an account in v1; their progress stays on their own device.

**Staff Role**:
What a person on the staff list may do: Administrator, Editor, Educator, Language Reviewer (for one Language Variety) or Safeguarding Lead. Only people on the staff list can sign in, with a link emailed to them (ADR-0016); their roles decide what they may do.
_Avoid_: Permission, group

**Educator**:
A staff or contracted role, granted by an administrator, that may author Learning Layers on assigned drafts. Authoring confers no publication approval and no public profile.
_Avoid_: Tutor, teacher (for this role)

**Verified Educator**:
A person who has passed educator verification for a stated scope and may hold a public teaching profile or have learner contact.
_Avoid_: Approved tutor

## Operations

**Submission**:
Anything a member of the public sends through a form (enquiry, contribution offer, offer to teach, consultation interest, report, privacy request, dictionary suggestion), stored with the Notice version it was sent under and never published.
_Avoid_: Post, entry

**Notice**:
The privacy wording shown on every public form, kept as numbered versions. New wording is a new version, so each Submission names words that can still be read.
_Avoid_: Privacy policy (the Privacy page is a Page, not a Notice)

**Report**:
A Submission about something on NAISEMA that is harmful, wrong or used without permission; read only by the Safeguarding Lead, who can put the item on Hold and have it withdrawn. It can be anonymous.
_Avoid_: Case (Phase 1a's workflow record), ticket

**Hold**:
The Safeguarding Lead keeping a Content Item off the public site while a Report about it is looked into. The item stays published, and nothing can be published, until they release it; then it is public again if it is still eligible.
_Avoid_: Suspension, takedown (a takedown is a withdrawal)

## Discovery

**Topic**:
A subject that Content Items are tagged with (at least one each, except Pages), with its own page at `/topics/{slug}`. Topics cut across the primary areas. A Topic may sit under one broader Topic as a **Subtopic** (one level only), and may have a **Lead Feature**: one item shown first on its page.
_Avoid_: Tag, category

**Related Items**:
The other Content Items, of any type, an editor links from an item's Revision; shown only while each is public.

**Provider**:
Any organisation or person whose learning Offering is listed on NAISEMA. Listing implies no endorsement or partnership.
_Avoid_: Partner (unless an agreement exists)

**Partner**:
A Provider with a recorded Partnership Agreement in force. Only then is "Partner" shown, and only a Partner's Offering can be shown or hosted on NAISEMA.

**Offering**:
A programme, course, resource or class a Provider lists; in v1, one line on the Provider's page.
_Avoid_: Programme (unqualified), partner programme

**Radio Programme**:
A scheduled show on a listed radio station.
_Avoid_: Programme (unqualified)
