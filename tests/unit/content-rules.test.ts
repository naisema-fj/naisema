import { describe, expect, it } from "vitest";
import {
  eligibility,
  type ReviewFacts,
  type RevisionFacts,
  requiredReviews,
  reviewLabels,
  revisionMediaIds,
} from "~/lib/content-rules";
import type { RightsFacts } from "~/lib/rights-rules";

const AUTHOR = "author@naisema.test";
const REVIEWER = "reviewer@naisema.test";
const TODAY = "2026-11-09";

const article = (change: Partial<RevisionFacts> = {}): RevisionFacts => ({
  kind: "article",
  place: "ezine",
  flags: [],
  fields: {},
  hasLayer: false,
  layerReady: [],
  authorEmail: AUTHOR,
  ...change,
});

const approved = (type: ReviewFacts["type"], by = REVIEWER, at = 1): ReviewFacts => ({
  type,
  decision: "approved",
  reviewerEmail: by,
  createdAt: new Date(at),
});

const grants = (change: Partial<RightsFacts> = {}): RightsFacts => ({
  permittedUses: ["publish"],
  guardianPermission: false,
  expiresOn: null,
  withdrawnAt: null,
  ...change,
});

const decide = (input: Partial<Parameters<typeof eligibility>[0]> = {}) =>
  eligibility({
    revision: article(),
    reviews: [approved("editorial")],
    itemRights: [grants()],
    media: [],
    today: TODAY,
    ...input,
  });

describe("the reviews a Revision needs", () => {
  it("is editorial review, plus what its place and flags add", () => {
    expect(requiredReviews({ place: "ezine", flags: [], hasLayer: false })).toEqual(["editorial"]);
    expect(requiredReviews({ place: "learn", flags: [], hasLayer: false })).toEqual(["editorial", "language"]);
    expect(requiredReviews({ place: "discover", flags: [], hasLayer: true })).toEqual(["editorial", "language"]);
    expect(
      requiredReviews({ place: "voices", flags: ["sensitive-cultural", "identifiable-children"], hasLayer: false }),
    ).toEqual(["editorial", "knowledge-holder", "safeguarding"]);
  });
});

describe("whether a Revision may be public", () => {
  it("is eligible with every required approval and a current Publish right", () => {
    expect(decide()).toEqual({ eligible: true, reasons: [] });
  });

  it("never counts an approval by the Revision's own author", () => {
    const result = decide({ reviews: [approved("editorial", AUTHOR)] });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("It needs editorial review.");
  });

  it("takes the latest decision of each Review Type", () => {
    const changes: ReviewFacts = { ...approved("editorial", REVIEWER, 2), decision: "changes-requested" };
    expect(decide({ reviews: [approved("editorial"), changes] }).reasons).toEqual([
      "Editorial review asked for changes.",
    ]);
    expect(decide({ reviews: [changes, approved("editorial", REVIEWER, 3)] }).eligible).toBe(true);
  });

  it("holds a right through its last day and drops it the day after", () => {
    expect(decide({ itemRights: [grants({ expiresOn: TODAY })] }).eligible).toBe(true);
    expect(decide({ itemRights: [grants({ expiresOn: "2026-11-08" })] }).reasons).toEqual([
      "The Rights Record for the item granting Publish has expired.",
    ]);
  });

  it("stops at once when the right is withdrawn, or never granted Publish", () => {
    expect(decide({ itemRights: [grants({ withdrawnAt: new Date() })] }).reasons).toEqual([
      "The Rights Record for the item was withdrawn.",
    ]);
    expect(decide({ itemRights: [grants({ permittedUses: ["translate"] })] }).reasons).toEqual([
      "No Rights Record for the item grants Publish.",
    ]);
  });

  it("needs a Publish right on each media file it shows", () => {
    const media = [{ id: "m1", name: "the file market.jpg", records: [] }];
    expect(decide({ media }).reasons).toEqual(["No Rights Record for the file market.jpg grants Publish."]);
    expect(decide({ media: [{ ...media[0], records: [grants()] }] }).eligible).toBe(true);
  });

  it("needs guardian permission where children can be identified, and a safeguarding review", () => {
    const revision = article({ flags: ["identifiable-children"] });
    const reviews = [approved("editorial"), approved("safeguarding")];
    expect(decide({ revision, reviews }).reasons).toEqual([
      "It shows identifiable children, and no current Rights Record records guardian permission.",
    ]);
    expect(decide({ revision, reviews, itemRights: [grants({ guardianPermission: true })] }).eligible).toBe(true);
  });

  it("needs the Learning Layer's uses, language review and readiness for a Video with one", () => {
    const revision = article({ kind: "video", place: "learn", hasLayer: true, fields: { videoMediaId: "v1" } });
    const result = decide({ revision });
    expect(result.reasons).toEqual([
      "It needs language review.",
      "No Rights Record for the item grants Translate.",
      "No Rights Record for the item grants Transcribe.",
      "No Rights Record for the item grants Educational adaptation.",
    ]);
    const ready = decide({
      revision,
      reviews: [approved("editorial"), approved("language")],
      itemRights: [grants({ permittedUses: ["publish", "translate", "transcribe", "educationalAdaptation"] })],
    });
    expect(ready.eligible).toBe(true);
    expect(
      decide({ revision: { ...revision, layerReady: ["Its Learning Layer has no Segments yet."] } }).reasons[0],
    ).toBe("Its Learning Layer has no Segments yet.");
  });

  it("needs the fields its kind can't be published without", () => {
    const revision = article({ kind: "episode", place: "voices" });
    expect(decide({ revision }).reasons).toEqual(["Recording (MP3 or M4A) is missing.", "Transcript is missing."]);
    expect(
      decide({ revision: article({ kind: "resource", place: "resources", fields: { usageTerms: "Free to print" } }) })
        .reasons,
    ).toEqual(["A Resource needs a file or an address elsewhere."]);
  });
});

describe("Review Labels", () => {
  it("come only from the approvals that exist", () => {
    expect(reviewLabels({ flags: [], approvals: [{ type: "editorial", createdAt: new Date() }] })).toEqual([]);
    expect(
      reviewLabels({
        flags: ["opinion"],
        approvals: [
          { type: "language", createdAt: new Date("2026-10-12T03:00:00Z") },
          { type: "knowledge-holder", createdAt: new Date() },
        ],
        languageName: "Standard Fijian",
      }),
    ).toEqual(["Language reviewed · Standard Fijian · 12 Oct 2026", "Cultural context reviewed", "Opinion"]);
  });
});

describe("the media a Revision shows", () => {
  it("are its kind's media fields and its body's own images", () => {
    expect(
      revisionMediaIds(
        "article",
        { coverMediaId: "cover" },
        {
          type: "doc",
          content: [
            { type: "image", attrs: { src: "/media/images/inline/960", alt: "A canoe" } },
            { type: "image", attrs: { src: "https://example.org/elsewhere.jpg", alt: "Elsewhere" } },
            {
              type: "blockquote",
              content: [{ type: "image", attrs: { src: "/media/images/quoted/640", alt: "Quoted" } }],
            },
          ],
        },
      ),
    ).toEqual(["cover", "inline", "quoted"]);
  });
});
