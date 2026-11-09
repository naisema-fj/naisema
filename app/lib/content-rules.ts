import type { ArticleBody, Block } from "./article-body";
import { formatDay, type RightsFacts, rightsProblems } from "./rights-rules";

/**
 * What a Content Item is, what it must carry, which reviews it needs and whether a Revision of it
 * may be public (ADR-0003, ADR-0007, ADR-0015). Pure, so the admin and public sides share one rule.
 */

export const AREAS = ["learn", "voices", "discover", "connect", "ezine", "resources"] as const;
export type Area = (typeof AREAS)[number];
/** Where an item lives: one of the six areas, or "pages" for a footer Page at `/{slug}`. */
export type Place = Area | "pages";

export const CONTENT_KINDS = ["article", "episode", "resource", "video", "creator", "provider", "page"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const isContentKind = (value: string): value is ContentKind =>
  (CONTENT_KINDS as readonly string[]).includes(value);

export type FieldType = "text" | "textarea" | "url" | "audio" | "image" | "video" | "document" | "item";
export type FieldSpec = { name: string; label: string; type: FieldType; hint?: string; neededToPublish?: boolean };

/** Each kind's name, the places it may live and the fields it adds to every Revision's own. */
export const KINDS: Record<ContentKind, { name: string; places: readonly Place[]; fields: readonly FieldSpec[] }> = {
  article: {
    name: "Article",
    places: AREAS,
    fields: [{ name: "coverMediaId", label: "Cover image", type: "image" }],
  },
  episode: {
    name: "Voices Episode",
    places: ["voices"],
    fields: [
      { name: "audioMediaId", label: "Recording (MP3 or M4A)", type: "audio", neededToPublish: true },
      {
        name: "transcript",
        label: "Transcript",
        type: "textarea",
        hint: 'One paragraph per line, starting "Name: " when the speaker changes.',
        neededToPublish: true,
      },
      { name: "guests", label: "Host and guests", type: "text" },
      { name: "links", label: "Listen elsewhere (one address per line)", type: "textarea" },
    ],
  },
  resource: {
    name: "Resource",
    places: ["resources", "learn"],
    fields: [
      { name: "fileMediaId", label: "File (PDF or audio)", type: "document" },
      { name: "externalUrl", label: "Or an address elsewhere", type: "url" },
      { name: "usageTerms", label: "What visitors may do with it", type: "text", neededToPublish: true },
      { name: "language", label: "Language", type: "text" },
      { name: "ageGuidance", label: "Age guidance", type: "text" },
      { name: "accessibility", label: "Accessibility", type: "text" },
    ],
  },
  video: {
    name: "Video",
    places: AREAS,
    fields: [
      {
        name: "videoMediaId",
        label: "Footage (MP4, H.264)",
        type: "video",
        hint: "Up to 95 MB. The Educator guide has the command that makes one.",
        neededToPublish: true,
      },
      { name: "posterMediaId", label: "Still shown before it plays", type: "image" },
    ],
  },
  creator: {
    name: "Creator Profile",
    places: ["connect"],
    fields: [
      { name: "portraitMediaId", label: "Portrait", type: "image" },
      { name: "sampleItemId", label: "Free sample (a published NAISEMA item)", type: "item" },
      { name: "links", label: "Their own links (one per line)", type: "textarea" },
    ],
  },
  provider: {
    name: "Provider",
    places: ["connect"],
    fields: [
      { name: "website", label: "Website", type: "url", neededToPublish: true },
      { name: "location", label: "Where (or online)", type: "text" },
      { name: "offerings", label: "Classes and courses (one per line)", type: "textarea" },
      { name: "contact", label: "How to get in touch", type: "text" },
    ],
  },
  page: { name: "Page", places: ["pages"], fields: [] },
};

/** A Revision's kind-specific fields, by name. Media and item fields hold IDs. */
export type KindFields = Record<string, string>;

export const MEDIA_FIELD_TYPES: readonly FieldType[] = ["audio", "image", "video", "document"];

/** Content Flags an editor sets on each Revision; they decide the reviews it needs. */
export const CONTENT_FLAGS = ["language-instruction", "sensitive-cultural", "identifiable-children", "opinion"] as const;
export type ContentFlag = (typeof CONTENT_FLAGS)[number];
export const FLAG_NAMES: Record<ContentFlag, string> = {
  "language-instruction": "Teaches language",
  "sensitive-cultural": "Sensitive cultural material",
  "identifiable-children": "Shows identifiable children",
  opinion: "Opinion or personal experience",
};
export const isContentFlag = (value: string): value is ContentFlag =>
  (CONTENT_FLAGS as readonly string[]).includes(value);

export const REVIEW_TYPES = ["editorial", "language", "knowledge-holder", "safeguarding"] as const;
export type ReviewType = (typeof REVIEW_TYPES)[number];
export const REVIEW_TYPE_NAMES: Record<ReviewType, string> = {
  editorial: "Editorial review",
  language: "Language review",
  "knowledge-holder": "Knowledge Holder Approval",
  safeguarding: "Safeguarding review",
};
export type ReviewDecision = "approved" | "changes-requested";

export type ItemState = "draft" | "published" | "withdrawn" | "archived";

/**
 * The reviews a Revision needs. Editorial always; language for anything that teaches language,
 * which every Video with a Learning Layer and everything in Learn does; a Knowledge Holder for
 * sensitive cultural material; safeguarding where children can be identified.
 */
export function requiredReviews(input: { place: Place; flags: ContentFlag[]; hasLayer: boolean }): ReviewType[] {
  const needs: ReviewType[] = ["editorial"];
  if (input.hasLayer || input.place === "learn" || input.flags.includes("language-instruction")) needs.push("language");
  if (input.flags.includes("sensitive-cultural")) needs.push("knowledge-holder");
  if (input.flags.includes("identifiable-children")) needs.push("safeguarding");
  return needs;
}

export type ReviewFacts = {
  type: ReviewType;
  decision: ReviewDecision;
  reviewerEmail: string;
  createdAt: Date;
};

/**
 * Each required review's standing on a Revision: its latest decision, ignoring any by the
 * Revision's own author, who never approves their own work.
 */
export function reviewStanding(required: ReviewType[], reviews: ReviewFacts[], authorEmail: string) {
  const counted = reviews
    .filter((review) => review.reviewerEmail.toLowerCase() !== authorEmail.toLowerCase())
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return required.map((type) => {
    const latest = counted.filter((review) => review.type === type).at(-1) ?? null;
    return { type, latest, approved: latest?.decision === "approved" };
  });
}

/** What the rules need to know about a Revision. */
export type RevisionFacts = {
  kind: ContentKind;
  place: Place;
  flags: ContentFlag[];
  fields: KindFields;
  hasLayer: boolean;
  layerReady: string[];
  authorEmail: string;
};

/** Fields a kind needs before a Revision can be public, by label. */
export function missingFields(kind: ContentKind, fields: KindFields): string[] {
  const missing = KINDS[kind].fields.filter((field) => field.neededToPublish && !fields[field.name]?.trim());
  const problems = missing.map((field) => `${field.label} is missing.`);
  if (kind === "resource" && !fields.fileMediaId && !fields.externalUrl)
    problems.push("A Resource needs a file or an address elsewhere.");
  return problems;
}

/**
 * Whether a Revision may be public on `today`, and if not, every reason why, in words for staff.
 * Asked on every public request (ADR-0007): approvals on this exact Revision, current rights for
 * it and each media file it shows, its kind's fields, and its Learning Layer's readiness.
 */
export function eligibility(input: {
  revision: RevisionFacts;
  reviews: ReviewFacts[];
  itemRights: RightsFacts[];
  media: { id: string; name: string; records: RightsFacts[] }[];
  held?: boolean;
  today: string;
}): { eligible: boolean; reasons: string[] } {
  const { revision } = input;
  const required = requiredReviews(revision);
  const reasons = [
    ...missingFields(revision.kind, revision.fields),
    ...revision.layerReady,
    ...reviewStanding(required, input.reviews, revision.authorEmail)
      .filter((standing) => !standing.approved)
      .map((standing) =>
        standing.latest?.decision === "changes-requested"
          ? `${REVIEW_TYPE_NAMES[standing.type]} asked for changes.`
          : `It needs ${REVIEW_TYPE_NAMES[standing.type].replace(/^./, (c) => c.toLowerCase())}.`,
      ),
    ...rightsProblems({
      itemRecords: input.itemRights,
      media: input.media,
      needsGuardianPermission: revision.flags.includes("identifiable-children"),
      hasLayer: revision.hasLayer,
      today: input.today,
    }),
    ...(input.held ? ["It is held while a report about it is looked into."] : []),
  ];
  return { eligible: reasons.length === 0, reasons };
}

/**
 * The public Review Labels for a Revision, generated only from approvals it actually has: never a
 * generic "verified" badge (PUB-02).
 */
export function reviewLabels(input: {
  flags: ContentFlag[];
  approvals: { type: ReviewType; createdAt: Date }[];
  languageName?: string;
}): string[] {
  const labels: string[] = [];
  const latest = (type: ReviewType) =>
    input.approvals.filter((approval) => approval.type === type).sort((a, b) => +b.createdAt - +a.createdAt)[0];
  const language = latest("language");
  if (language)
    labels.push(
      ["Language reviewed", input.languageName, formatDay(language.createdAt.toISOString().slice(0, 10))]
        .filter(Boolean)
        .join(" · "),
    );
  if (latest("knowledge-holder")) labels.push("Cultural context reviewed");
  if (input.flags.includes("opinion")) labels.push("Opinion");
  return labels;
}

/** The media IDs a body shows: images uploaded to NAISEMA, at `/media/images/{id}/…`. */
export function bodyMediaIds(body: ArticleBody): string[] {
  const ids: string[] = [];
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === "image") {
        const match = /^\/media\/images\/([\w-]+)\//.exec(block.attrs.src);
        if (match) ids.push(match[1]);
      }
      if ("content" in block && Array.isArray(block.content)) walk(block.content as Block[]);
    }
  };
  walk(body.content);
  return [...new Set(ids)];
}

/** Every media ID a Revision shows: its kind's media fields and its body's images. */
export function revisionMediaIds(kind: ContentKind, fields: KindFields, body: ArticleBody) {
  const fromFields = KINDS[kind].fields
    .filter((field) => MEDIA_FIELD_TYPES.includes(field.type) && fields[field.name])
    .map((field) => fields[field.name]);
  return [...new Set([...fromFields, ...bodyMediaIds(body)])];
}

/** A public item's address. */
export const itemPath = (item: { area: string; slug: string }) =>
  item.area === "pages" ? `/${item.slug}` : `/${item.area}/${item.slug}`;
