import { renderToStaticMarkup } from "react-dom/server";
import { ArticleBodyView, type EmbeddedItem } from "~/components/article-body-view";
import type { ArticleBody } from "./article-body";

/**
 * An Article body as HTML, by the same allowlist renderer the public site uses (CMS-01), for
 * exports: the Tiptap JSON stays the source, and this is what it showed as.
 */
export const bodyHtml = (body: ArticleBody, embeds: Record<string, EmbeddedItem>) =>
  renderToStaticMarkup(<ArticleBodyView body={body} embeds={embeds} />);
