import { describe, expect, it } from "vitest";
import { embeddedItemIds, parseArticleBody } from "~/lib/article-body";

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("parseArticleBody", () => {
  it("accepts every block in the fixed set", () => {
    const body = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Na veitalanoa")] },
      paragraph(
        text("Bold", [{ type: "bold" }]),
        text(" and "),
        text("a link", [{ type: "link", attrs: { href: "https://example.org/story" } }]),
        { type: "hardBreak" },
        text("italic", [{ type: "italic" }]),
      ),
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("One"))] }] },
      {
        type: "orderedList",
        attrs: { start: 3 },
        content: [{ type: "listItem", content: [paragraph(text("Three"))] }],
      },
      { type: "blockquote", content: [paragraph(text("A saying"))] },
      { type: "image", attrs: { src: "https://media.naisema.com/a.jpg", alt: "A lali drum" } },
      { type: "contentItem", attrs: { id: "0b5e3c1a-8d7e-4f8e-9a51-2f1c4d6e7a90" } },
      { type: "callout", content: [paragraph(text("Remember this"))] },
    );

    expect(parseArticleBody(body)).toEqual({ ok: true, body });
  });

  it("drops attributes outside the allowlist", () => {
    const body = doc(
      {
        type: "heading",
        attrs: { level: 3, id: "x", style: "color:red" },
        content: [text("Title", [{ type: "link", attrs: { href: "/voices/a", target: "_blank", onclick: "x()" } }])],
      },
      { type: "image", attrs: { src: "/media/a.jpg", alt: " A mat ", title: "t", width: 9, onerror: "x()" } },
      { type: "orderedList", attrs: { start: 1, type: null }, content: [{ type: "listItem", content: [paragraph()] }] },
    );

    expect(parseArticleBody(body)).toEqual({
      ok: true,
      body: doc(
        {
          type: "heading",
          attrs: { level: 3 },
          content: [text("Title", [{ type: "link", attrs: { href: "/voices/a" } }])],
        },
        { type: "image", attrs: { src: "/media/a.jpg", alt: "A mat" } },
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      ),
    });
  });

  it.each([
    ["a node outside the block set", doc({ type: "codeBlock", content: [text("x")] }), /doesn't support \(codeBlock\)/],
    ["raw HTML", doc({ type: "html", html: "<script>alert(1)</script>" }), /doesn't support \(html\)/],
    ["a mark outside the set", doc(paragraph(text("x", [{ type: "strike" }]))), /doesn't support \(strike\)/],
    ["a level 1 heading", doc({ type: "heading", attrs: { level: 1 }, content: [text("x")] }), /level 2, 3 or 4/],
    ["an image without alt text", doc({ type: "image", attrs: { src: "/a.jpg" } }), /alt text/],
    ["an image whose alt text is blank", doc({ type: "image", attrs: { src: "/a.jpg", alt: "  " } }), /alt text/],
    ["a data: image", doc({ type: "image", attrs: { src: "data:image/png;base64,AA", alt: "x" } }), /https:\/\//],
    ["an http image", doc({ type: "image", attrs: { src: "http://example.org/a.jpg", alt: "x" } }), /https:\/\//],
    [
      "a javascript: link",
      doc(paragraph(text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))),
      /Links/,
    ],
    [
      "a protocol-relative link",
      doc(paragraph(text("x", [{ type: "link", attrs: { href: "//evil.example" } }]))),
      /Links/,
    ],
    ["an embed without an ID", doc({ type: "contentItem", attrs: { id: "../x" } }), /missing its ID/],
    [
      "a heading inside a callout",
      doc({ type: "callout", content: [{ type: "heading", attrs: { level: 2 } }] }),
      /only contain paragraphs/,
    ],
    ["something that isn't a document", [paragraph()], /could not be read/],
    ["a body that is too long", doc(paragraph(text("x".repeat(200_001)))), /too long/],
  ])("refuses %s", (_name, body, error) => {
    const result = parseArticleBody(body);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(error);
  });

  it("finds embedded Content Items wherever they are", () => {
    const first = "0b5e3c1a-8d7e-4f8e-9a51-2f1c4d6e7a90";
    const nested = "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
    const parsed = parseArticleBody(
      doc(
        { type: "contentItem", attrs: { id: first } },
        { type: "blockquote", content: [{ type: "contentItem", attrs: { id: nested } }] },
      ),
    );

    expect(parsed.ok && embeddedItemIds(parsed.body)).toEqual([first, nested]);
  });
});
