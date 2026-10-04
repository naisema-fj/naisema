import type { ReactNode } from "react";
import {
  type ArticleBody,
  type Block,
  type Inline,
  isSafeImageAddress,
  isSafeLinkAddress,
  type Mark,
} from "~/lib/article-body";

/** What an embedded Content Item shows as: its title and where it lives. */
export type EmbeddedItem = { title: string; href: string };

/**
 * The allowlist renderer for Article bodies (docs/phase-1a-defaults.md §7). It builds React
 * elements for the fixed block set only and never injects HTML, so anything it doesn't know
 * (a body stored before a block was removed, say) renders as nothing.
 */
export function ArticleBodyView({ body, embeds }: { body: ArticleBody; embeds: Record<string, EmbeddedItem> }) {
  return <>{renderBlocks(body.content, embeds)}</>;
}

function renderBlocks(blocks: readonly Block[] | undefined, embeds: Record<string, EmbeddedItem>): ReactNode[] {
  return (blocks ?? []).map((node, index) => {
    const key = `${node.type}-${index}`;
    switch (node.type) {
      case "paragraph":
        return <p key={key}>{renderInline(node.content)}</p>;
      case "heading": {
        const Heading = `h${node.attrs.level}` as const satisfies "h2" | "h3" | "h4";
        return <Heading key={key}>{renderInline(node.content)}</Heading>;
      }
      case "bulletList":
        return <ul key={key}>{renderListItems(node.content, embeds)}</ul>;
      case "orderedList":
        return (
          <ol key={key} start={node.attrs?.start}>
            {renderListItems(node.content, embeds)}
          </ol>
        );
      case "blockquote":
        return <blockquote key={key}>{renderBlocks(node.content, embeds)}</blockquote>;
      case "image":
        if (!isSafeImageAddress(node.attrs.src)) return null;
        return <img key={key} src={node.attrs.src} alt={node.attrs.alt} loading="lazy" />;
      case "contentItem": {
        const item = embeds[node.attrs.id];
        return (
          <aside key={key} className="embedded-item">
            {item ? <a href={item.href}>{item.title}</a> : <p>An item that is no longer available.</p>}
          </aside>
        );
      }
      case "callout":
        return (
          <aside key={key} className="callout">
            {renderBlocks(node.content, embeds)}
          </aside>
        );
      default:
        return null;
    }
  });
}

function renderListItems(
  items: Extract<Block, { type: "bulletList" }>["content"],
  embeds: Record<string, EmbeddedItem>,
) {
  return (
    items
      .filter((item) => item.type === "listItem")
      // biome-ignore lint/suspicious/noArrayIndexKey: a stored body is rendered once and never reordered.
      .map((item, index) => <li key={index}>{renderBlocks(item.content, embeds)}</li>)
  );
}

function renderInline(content: readonly Inline[] | undefined): ReactNode[] {
  return (content ?? []).map((node, index) => {
    const key = `${node.type}-${index}`;
    if (node.type === "hardBreak") return <br key={key} />;
    if (node.type !== "text") return null;
    return (node.marks ?? []).reduce<ReactNode>((inner, mark) => applyMark(mark, inner, key), node.text);
  });
}

function applyMark(mark: Mark, inner: ReactNode, key: string): ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong key={key}>{inner}</strong>;
    case "italic":
      return <em key={key}>{inner}</em>;
    case "link": {
      if (!isSafeLinkAddress(mark.attrs.href)) return inner;
      const external = /^https?:/.test(mark.attrs.href);
      return (
        <a key={key} href={mark.attrs.href} rel={external ? "noopener noreferrer" : undefined}>
          {inner}
        </a>
      );
    }
    default:
      return inner;
  }
}
