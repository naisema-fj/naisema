import type { ContentFlag, ReviewType } from "./content-rules";
import type { PermittedUse } from "./rights-rules";
import type { Role } from "./roles";

/**
 * The words behind the staff site's "What's this?" help (docs/handover/admin-guide.md and
 * educator-guide.md say the same things at more length). Each is a Record over the type it
 * explains, so a new role, flag, review or permitted use won't compile until someone says what it
 * means. The rules themselves live in content-rules.ts, rights-rules.ts and roles.ts; this only
 * describes them, so check these against those when a rule changes.
 */

/** What each Staff Role lets a person do, in the words of the Staff page. */
export const ROLE_DOES: Record<Role, string> = {
  admin: "Adds and changes people on the staff list, reads the audit log, and reads messages and privacy requests.",
  editor:
    "Adds and edits content, makes preview links, does editorial review, records Knowledge Holder Approvals, manages Rights Records and media, reads messages, and publishes and withdraws.",
  educator: "Writes Videos and their Learning Layers and uploads media. Never publishes.",
  reviewer: "Reviews the language of items and Learning Layers, for the one Language Variety on their staff record.",
  safeguarding: "Does safeguarding reviews, and is the only person who reads reports.",
};

/** What ticking each Content Flag changes. */
export const FLAG_HELP: Record<ContentFlag, string> = {
  "language-instruction": "Adds a language review.",
  "sensitive-cultural": "Adds a Knowledge Holder Approval, which an editor records.",
  "identifiable-children":
    "Adds a safeguarding review, and needs a Rights Record that records the guardian's permission.",
  opinion: "Adds the public label “Opinion”. It needs no extra review.",
};

/** What each review is, who does it, and when an item needs it. */
export const REVIEW_HELP: Record<ReviewType, string> = {
  editorial: "Every item needs one, from an editor who didn't write this version.",
  language:
    "Needed for anything in Learn, anything flagged as teaching language, and every Learning Layer. A Language Reviewer checks the Fijian, the translations, the word meanings and the answers.",
  "knowledge-holder":
    "Needed for sensitive cultural material. After the Knowledge Holder has seen this exact version (a preview link works), an editor records their name, how they approved and any conditions.",
  safeguarding: "Needed where children can be identified. The Safeguarding Lead decides.",
};

/** What each Permitted Use grants. Each is granted separately; none implies another. */
export const PERMITTED_USE_HELP: Record<PermittedUse, string> = {
  publish: "Show it on NAISEMA. Everything public needs this.",
  excerpt: "Use just a part of it.",
  translate: "Translate it. A Video's Learning Layer needs this.",
  transcribe: "Write out what is said. A Video's Learning Layer needs this.",
  educationalAdaptation: "Turn it into teaching material. A Video's Learning Layer needs this.",
  commercial: "Use it to make money. Not needed to publish.",
  aiTraining: "Use it to train AI systems. Not needed to publish.",
};
