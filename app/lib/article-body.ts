/**
 * The fixed block set an Article body may contain (CMS-01, docs/phase-1a-defaults.md §7). Bodies
 * are Tiptap/ProseMirror JSON. The editor produces them, but whatever arrives from a browser is
 * parsed here before it is stored: anything outside the allowlist is refused, attributes outside
 * it are dropped, and links and images must use safe addresses.
 */

export type Mark = { type: "bold" } | { type: "italic" } | { type: "link"; attrs: { href: string } };
export type Inline = { type: "text"; text: string; marks?: Mark[] } | { type: "hardBreak" };
export type Paragraph = { type: "paragraph"; content?: Inline[] };
export type Heading = { type: "heading"; attrs: { level: HeadingLevel }; content?: Inline[] };
export type ListItem = { type: "listItem"; content: Block[] };
export type Block =
  | Paragraph
  | Heading
  | { type: "bulletList"; content: ListItem[] }
  | { type: "orderedList"; attrs?: { start: number }; content: ListItem[] }
  | { type: "blockquote"; content: Block[] }
  | { type: "image"; attrs: { src: string; alt: string } }
  /** Another Content Item shown inside this one, by its stable ID. */
  | { type: "contentItem"; attrs: { id: string } }
  | { type: "callout"; content: Paragraph[] };
export type ArticleBody = { type: "doc"; content: Block[] };

export const HEADING_LEVELS = [2, 3, 4] as const;
type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const EMPTY_ARTICLE_BODY: ArticleBody = { type: "doc", content: [{ type: "paragraph" }] };

const MAX_BODY_CHARACTERS = 200_000;
const MAX_DEPTH = 12;

export type BodyParse = { ok: true; body: ArticleBody } | { ok: false; error: string };

class BodyRefused extends Error {}

export function parseArticleBody(input: unknown): BodyParse {
  try {
    if (JSON.stringify(input ?? null).length > MAX_BODY_CHARACTERS) {
      return { ok: false, error: "The article body is too long to save in one go." };
    }
    const node = record(input);
    if (node.type !== "doc") throw unsupported(node.type);
    return { ok: true, body: { type: "doc", content: list(node.content).map((child) => block(child, 1)) } };
  } catch (error) {
    if (error instanceof BodyRefused) return { ok: false, error: error.message };
    throw error;
  }
}

/** The IDs of every Content Item embedded in a body, in order. */
export function embeddedItemIds(body: ArticleBody): string[] {
  const ids: string[] = [];
  const visit = (blocks: Block[] | ListItem[]) => {
    for (const node of blocks) {
      if (node.type === "contentItem") ids.push(node.attrs.id);
      else if ("content" in node && node.content && node.type !== "paragraph" && node.type !== "heading") {
        visit(node.content as Block[]);
      }
    }
  };
  visit(body.content);
  return ids;
}

function block(input: unknown, depth: number): Block {
  if (depth > MAX_DEPTH) throw new BodyRefused("The article body is nested too deeply.");
  const node = record(input);
  switch (node.type) {
    case "paragraph":
      return withInline({ type: "paragraph" }, node.content);
    case "heading": {
      const level = record(node.attrs ?? {}).level;
      if (!HEADING_LEVELS.includes(level as HeadingLevel)) throw new BodyRefused("Headings must be level 2, 3 or 4.");
      return withInline({ type: "heading", attrs: { level: level as HeadingLevel } }, node.content);
    }
    case "bulletList":
      return { type: "bulletList", content: listItems(node.content, depth) };
    case "orderedList": {
      const start = record(node.attrs ?? {}).start;
      const content = listItems(node.content, depth);
      if (start === undefined || start === null) return { type: "orderedList", content };
      if (!Number.isInteger(start) || (start as number) < 1)
        throw new BodyRefused("A numbered list must start at 1 or more.");
      return { type: "orderedList", attrs: { start: start as number }, content };
    }
    case "blockquote":
      return { type: "blockquote", content: nonEmpty(node.content).map((child) => block(child, depth + 1)) };
    case "image": {
      const attrs = record(node.attrs ?? {});
      const alt = typeof attrs.alt === "string" ? attrs.alt.trim() : "";
      if (!alt) throw new BodyRefused("Every image needs alt text describing it.");
      if (typeof attrs.src !== "string" || !isSafeAddress(attrs.src, ["https:"])) {
        throw new BodyRefused("Image addresses must start with https:// or /.");
      }
      return { type: "image", attrs: { src: attrs.src, alt } };
    }
    case "contentItem": {
      const id = record(node.attrs ?? {}).id;
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) {
        throw new BodyRefused("An embedded Content Item is missing its ID.");
      }
      return { type: "contentItem", attrs: { id } };
    }
    case "callout":
      return {
        type: "callout",
        content: nonEmpty(node.content).map((child) => {
          const paragraph = block(child, depth + 1);
          if (paragraph.type !== "paragraph") throw new BodyRefused("Callouts may only contain paragraphs.");
          return paragraph;
        }),
      };
    default:
      throw unsupported(node.type);
  }
}

function listItems(input: unknown, depth: number): ListItem[] {
  return nonEmpty(input).map((child) => {
    const node = record(child);
    if (node.type !== "listItem") throw unsupported(node.type);
    return { type: "listItem", content: nonEmpty(node.content).map((item) => block(item, depth + 1)) };
  });
}

function withInline<T extends Paragraph | Heading>(node: T, content: unknown): T {
  if (content === undefined) return node;
  const inline = list(content).map(inlineNode);
  return inline.length ? { ...node, content: inline } : node;
}

function inlineNode(input: unknown): Inline {
  const node = record(input);
  if (node.type === "hardBreak") return { type: "hardBreak" };
  if (node.type !== "text" || typeof node.text !== "string") throw unsupported(node.type);
  if (node.marks === undefined) return { type: "text", text: node.text };
  const marks = list(node.marks).map(mark);
  return marks.length ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
}

function mark(input: unknown): Mark {
  const node = record(input);
  if (node.type === "bold" || node.type === "italic") return { type: node.type };
  if (node.type !== "link") throw unsupported(node.type);
  const href = record(node.attrs ?? {}).href;
  if (typeof href !== "string" || !isSafeLinkAddress(href)) {
    throw new BodyRefused("Links must start with https://, http://, mailto: or /.");
  }
  return { type: "link", attrs: { href } };
}

/** Where a link may point: a path on this site, or a web or email address. */
export const isSafeLinkAddress = (href: string) => isSafeAddress(href, ["https:", "http:", "mailto:"]);

/** A root-relative path on this site, or an absolute URL using one of the given schemes. */
function isSafeAddress(address: string, schemes: string[]): boolean {
  if (address.startsWith("/")) return !address.startsWith("//") && !address.startsWith("/\\");
  try {
    return schemes.includes(new URL(address).protocol);
  } catch {
    return false;
  }
}

function record(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new BodyRefused("The article body could not be read.");
  }
  return input as Record<string, unknown>;
}

function list(input: unknown): unknown[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new BodyRefused("The article body could not be read.");
  return input;
}

function nonEmpty(input: unknown): unknown[] {
  const items = list(input);
  if (!items.length) throw new BodyRefused("The article body has an empty list, quote or callout.");
  return items;
}

function unsupported(type: unknown) {
  const name = typeof type === "string" ? type.slice(0, 40) : "unknown";
  return new BodyRefused(`The article body contains something the editor doesn't support (${name}).`);
}
