---
status: accepted
---

# Expressions carry their own language review, so Vosa can be built on them

Vosa, the Fijian dictionary that came over from apps.naisema.com, is to become the public face of the Expression library: each of its entries and sayings becomes an Expression in a Language Variety's library (change note 0002). Until now an Expression has never been shown on its own. A Learning Layer copies every Expression it uses into its own Revision, and the layer's language review covers that copy (app/routes/admin/layer.tsx), so the library itself needed no review of its own. A dictionary shows each Expression by itself, so an Expression now carries its own language Review Approval: a Language Reviewer for its Language Variety approves its exact current wording, recorded against a fingerprint of that wording as Revisions are (ADR-0006), and any change to the wording leaves the Expression unreviewed again until it is approved anew. An Expression is not a Content Item and has no Revisions: its review state is the approval that matches its current wording, or none.

This changes CONTEXT.md's **Expression** ("a reviewed word or multiword phrase") to a word or phrase that has its own review, and is a draft until it has one. ADR-0014's rule stands: a Lesson's Fijian points only to reviewed Expressions.

## Considered options

- **Each dictionary entry a Content Item with Revisions.** Rejected: about 1,500 Content Items, each needing an area, a Topic and the publishing steps built for articles and videos, for records of a few lines each. Review per entry is what is needed, and an approval on a fingerprint gives it without the rest.
- **One Revision for the whole dictionary** (an edition reviewed as a whole). Rejected: correcting one word would reopen the review of every entry.
- **Leave Vosa as a static copy outside the model** (as served under `/apps` since 14 November 2026). Rejected as an end state: nothing in it can be edited by staff, reviewed or published from an approved suggestion.

## Consequences

- A Learning Layer still records its own copy of each Expression it uses, reviewed with the layer. Approving a Learning Layer does not approve the library's Expression, and approving an Expression does not change a layer already reviewed: the two reviews cover different things (the meaning in that clip, and the general entry).
- Whether drafts are shown publicly, labelled as drafts, is a product decision recorded in change note 0002, not here.
