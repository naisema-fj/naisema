import { describe, expect, it } from "vitest";
import { EMPTY_ARTICLE_BODY } from "~/lib/article-body";
import type { ArticleSnapshot } from "~/lib/article-fields";
import { mediaAssetIdsIn } from "~/lib/media-in-use";

const A = "0b6f1c1e-8f1d-4f6a-9a51-6f0c1f2b3c4d";
const B = "1c7a2d2f-9e2e-4b7b-8b62-7a1d2a3c4d5e";
const C = "2d8b3e3a-af3f-4c8c-9c73-8b2e3b4d5e6f";

const snapshot = (overrides: Partial<ArticleSnapshot>): ArticleSnapshot => ({
  title: "T",
  summary: "S",
  credit: "C",
  topicIds: [],
  body: EMPTY_ARTICLE_BODY,
  sources: "",
  flags: [],
  languageVariety: null,
  ...overrides,
});

const image = (src: string) => ({ type: "image" as const, attrs: { src, alt: "A view" } });

describe("mediaAssetIdsIn: the media library files a Revision shows or offers", () => {
  it("finds images served from the media library, once each, at any width or origin", () => {
    const body = {
      type: "doc" as const,
      content: [
        image(`https://naisema.com/media/images/${A}/960`),
        image(`https://staging.naisema.com/media/images/${A}/320`),
        {
          type: "blockquote" as const,
          content: [image(`https://naisema.com/media/images/${B}/640`)],
        },
        image("https://example.org/photo.jpg"),
      ],
    };

    expect(mediaAssetIdsIn(snapshot({ body: body as ArticleSnapshot["body"] }))).toEqual([A, B]);
  });

  it("includes a Resource's file and an Episode's audio", () => {
    expect(mediaAssetIdsIn(snapshot({ resource: { source: { kind: "file", assetId: C } } as never }))).toEqual([C]);
    expect(mediaAssetIdsIn(snapshot({ episode: { audioAssetId: C } as never }))).toEqual([C]);
    expect(
      mediaAssetIdsIn(snapshot({ resource: { source: { kind: "link", url: "https://example.org" } } as never })),
    ).toEqual([]);
  });

  it("ignores addresses that only look similar", () => {
    const body = {
      type: "doc" as const,
      content: [
        image(`https://naisema.com/media/images/not-an-id/960`),
        image(`https://naisema.com/x/media/images/${A}`),
      ],
    };

    expect(mediaAssetIdsIn(snapshot({ body: body as ArticleSnapshot["body"] }))).toEqual([]);
  });
});
