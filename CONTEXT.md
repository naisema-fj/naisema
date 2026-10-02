# Na iSema

A digital connection and learning platform for Fijians abroad, open to all. It connects people with cultural stories, media, existing learning providers, creators and optional video-based language learning.

The product name is written **Na iSema**. Lower-case `naisema` appears only in technical identifiers (domains, repository, Worker, database and bucket names), which cannot contain spaces.
_Avoid_: NAISEMA, Naisema, NaiSema

## Content and learning

**Content Item**:
A canonical piece of published cultural or editorial material (story, article, Voices episode, resource) with one URL and a primary area. Its type is Article, Resource, Episode, Creator Profile or Page; all share Revisions and review.
_Avoid_: Cultural item, post, page (for content other than a Page)

**Resource**:
A Content Item a visitor downloads (a scanned PDF or audio file) or follows (an external link with a last-checked date), shown with its language, age guidance, accessibility and usage terms first.

**Episode**:
A Na iSema Voices recording published as a Content Item in the Voices area: its audio, host, guests, the music and archive clips it uses, recording date, length, approved distribution links and a reviewed transcript. Video Episodes follow the video pipeline.
_Avoid_: Podcast (until distribution to podcast apps is approved), show

**Usage Terms**:
What a Resource tells visitors they may do with it, in plain words (for example "free to print for teaching"). Not a Permitted Use, which is what a Rights Record grants Na iSema.

**Page**:
A Content Item backing one of the fixed site pages in the footer (About, Privacy and so on), at `/{slug}`, outside the primary areas and Topics.

**Learning Layer**:
An optional, separately reviewed language-learning overlay attached to a video Content Item, covering either the whole video or one Excerpt, with its own level, segments, annotations, activities and completion rule. A Content Item may have several.
_Avoid_: Lesson, VideoLearningObject, learning object, practice unit

**Segment**:
A timed span of a Learning Layer's clip holding the Fijian text, English translation and optional speaker for that span.
_Avoid_: Cue, caption line (for the record)

**Expression**:
A reviewed word or multiword phrase, with its general meaning, that Annotations point to and Learners save.
_Avoid_: Vocab item, word (when a phrase or idiom is meant)

**Annotation**:
A link from a range of tokens in one Segment to an Expression, carrying the contextual meaning at that moment.
_Avoid_: Tooltip, gloss

**Activity**:
A practice or comprehension task in a Learning Layer, with reviewed answers or a model response, feedback and an accessible alternative.
_Avoid_: Quiz, exercise

**Completion Rule**:
The Educator-defined condition under which a Learner has completed a Learning Layer; by default every required activity attempted with feedback viewed (or its accessible equivalent). Watching alone never satisfies it, and real-world use is never required.
_Avoid_: Finished, mastered, passed

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
An ordered step inside a later-phase bundle or Pathway; not a synonym for Learning Layer.
_Avoid_: Lesson

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

**Carried-forward Approval**:
A new Review Approval on a later revision that explicitly references an earlier one because none of the fields its Review Type covers changed. Never implicit.

**Rights Record**:
The legal permission attached to a media asset or contributed work: rights holder, evidence, expiry, withdrawal and a set of Permitted Uses. A record can cover the whole item or one part an Episode lists with rights of its own (a speaker or guest, a piece of music, an archive clip).
_Avoid_: Licence (for the record), consent (for rights)

**Permitted Use**:
One specific use a Rights Record grants: publish, excerpt, translate, transcribe, educational adaptation, commercial or AI training. Each is granted separately; none implies another.

**Review Link**:
A signed, view-only, expiring and revocable link to one exact Revision, used to show material to a reviewer or Knowledge Holder without an account.
_Avoid_: Preview URL, share link

**Knowledge Holder**:
A person or authority with standing to permit use of culturally sensitive knowledge; permission from a Knowledge Holder is separate from legal rights and from founder approval.
_Avoid_: Elder (as a role), cultural reviewer

**Knowledge Holder Approval**:
A cultural Review Approval given by a Knowledge Holder and recorded by an editor on their behalf, stating how it was given, the exact revision seen and any conditions.

## People and roles

**Contributor**:
Anyone whose story, recording or knowledge appears in Na iSema content; a rights and credit relationship, not necessarily an account.
_Avoid_: Author (for non-staff), participant

**Creator**:
A Contributor with a public Creator Profile and their own channel of work. A Creator Profile is a Content Item in Connect: their chosen public name, biography, a general location, languages, kinds of work, a consented portrait and one free sample.
_Avoid_: Influencer, channel owner

**Learner**:
An adult (18+) using Learn; may browse and practise without an account.

**Learner Account**:
An optional, self-declared 18+ account that holds a Learner's private saves, history and progress. No under-18 accounts exist; families use the platform through a caregiver's account or without one.
_Avoid_: Member profile, child account

**Role Assignment**:
A staff role granted to a person by an administrator, optionally scoped to a Review Type and, for language reviewers, a Language Variety. Revoked, never deleted.
_Avoid_: Permission, group

**Educator**:
A staff or contracted role, granted by an administrator, that may author Learning Layers on assigned drafts. Authoring confers no publication approval and no public profile.
_Avoid_: Tutor, teacher (for this role)

**Verified Educator**:
A person who has passed educator verification for a stated scope and may hold a public teaching profile or have learner contact.
_Avoid_: Approved tutor

## Operations

**Submission**:
Anything a member of the public sends through a form (enquiry, contribution proposal, educator interest, consultation interest); never published automatically.
_Avoid_: Post, entry

**Consent Record**:
The stored fact that a person agreed to one purpose under one notice version, with time, source and any withdrawal; kept apart from the Submission it came with.

**Notice**:
The words shown beside a consent box for one purpose, kept as numbered versions. New wording is a new version; earlier versions are never changed, so a Consent Record always names words that can still be read.
_Avoid_: Privacy policy (the Privacy page is a Page, not a Notice)

**Upload Link**:
A single-use, expiring link an editor emails to someone whose contribution proposal they want, through which that person uploads into quarantine. The only public way to upload.

**Case**:
A restricted, audited record of a report, rights concern or data request that moves through received, triaged, actioned and reviewed/closed with one owner.
_Avoid_: Ticket, complaint (as the record)

## Discovery

**Topic**:
A subject that Content Items are tagged with (at least one each, except Pages), with its own page at `/topics/{slug}`. Topics cut across the primary areas. A Topic may sit under one broader Topic as a **Subtopic** (one level only), and may have a **Lead Feature**: one item shown first on its page.
_Avoid_: Tag, category

**Related Items**:
The other Content Items, of any type, an editor links from an item's Revision; shown only while each is public.

**Provider**:
Any organisation or person whose learning Offering is listed on Na iSema. Listing implies no endorsement or partnership.
_Avoid_: Partner (unless an agreement exists)

**Partner**:
A Provider with a recorded Partnership Agreement in force. Only then is "Partner" shown, and only a Partner's Offering can be shown or hosted on Na iSema.

**Offering**:
A listed programme, course, resource or class belonging to a Provider, with one explicit access mode.
_Avoid_: Programme (unqualified), partner programme

**Radio Programme**:
A scheduled show on a listed radio station.
_Avoid_: Programme (unqualified)
