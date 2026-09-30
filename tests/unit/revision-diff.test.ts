import { describe, expect, it } from "vitest";
import type { ArticleBody } from "~/lib/article-body";
import { bodyLines, diffLines } from "~/lib/revision-diff";

describe("bodyLines", () => {
  it("reads a body as one line per block, saying what kind of block it is", () => {
    const body: ArticleBody = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Kava" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Drink " },
            { type: "text", text: "slowly", marks: [{ type: "link", attrs: { href: "/learn/kava" } }] },
          ],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Clap once" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Say bula" }] }] },
          ],
        },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Wise words" }] }] },
        { type: "image", attrs: { src: "/media/bowl.jpg", alt: "A tanoa bowl" } },
        { type: "contentItem", attrs: { id: "0b5e3c1a-8d7e-4f8e-9a51-2f1c4d6e7a90" } },
        { type: "callout", content: [{ type: "paragraph", content: [{ type: "text", text: "Note" }] }] },
        { type: "paragraph" },
      ],
    };

    expect(bodyLines(body)).toEqual([
      "Heading 2: Kava",
      "Drink slowly [link: /learn/kava]",
      "• Clap once",
      "• Say bula",
      "Quote: Wise words",
      "Image: A tanoa bowl [/media/bowl.jpg]",
      "Embedded item: 0b5e3c1a-8d7e-4f8e-9a51-2f1c4d6e7a90",
      "Callout: Note",
    ]);
  });
});

describe("diffLines", () => {
  it("marks lines kept, removed and added, in reading order", () => {
    expect(diffLines(["a", "b", "c", "d"], ["a", "c", "e", "d"])).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "same", text: "c" },
      { kind: "added", text: "e" },
      { kind: "same", text: "d" },
    ]);
  });

  it("handles one side being empty", () => {
    expect(diffLines([], ["x"])).toEqual([{ kind: "added", text: "x" }]);
    expect(diffLines(["x"], [])).toEqual([{ kind: "removed", text: "x" }]);
  });
});
