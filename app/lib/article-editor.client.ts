import { Editor, Node } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { type ArticleBody, HEADING_LEVELS } from "./article-body";

/** A boxed aside of paragraphs, for tips and notes (the `callout` block). */
const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "paragraph+",
  defining: true,
  parseHTML: () => [{ tag: "aside.callout" }],
  renderHTML: () => ["aside", { class: "callout" }, 0],
});

/** Another Content Item embedded by its stable ID (the `contentItem` block). */
function contentItemEmbed(titles: Map<string, string>) {
  return Node.create({
    name: "contentItem",
    group: "block",
    atom: true,
    selectable: true,
    addAttributes: () => ({ id: { default: null } }),
    parseHTML: () => [
      { tag: "aside[data-content-item]", getAttrs: (element) => ({ id: element.dataset.contentItem }) },
    ],
    renderHTML: ({ HTMLAttributes }) => [
      "aside",
      { class: "embedded-item", "data-content-item": HTMLAttributes.id },
      `Embedded: ${titles.get(HTMLAttributes.id) ?? "a Content Item"}`,
    ],
  });
}

type Options = {
  element: HTMLElement;
  content: ArticleBody;
  embeddable: { id: string; title: string }[];
  labelledBy: string;
  describedBy?: string;
  onChange: (doc: unknown) => void;
};

/**
 * The editor for the fixed block set in article-body.ts. Its schema holds only those blocks, so
 * pasted content outside the set is dropped as it arrives; the server still re-checks every save.
 */
export function createArticleEditor({ element, content, embeddable, labelledBy, describedBy, onChange }: Options) {
  return new Editor({
    element,
    content,
    // The CSP allows no inline <style>; the editor's styles live in app.css.
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [...HEADING_LEVELS] },
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Callout,
      contentItemEmbed(new Map(embeddable.map((item) => [item.id, item.title]))),
    ],
    editorProps: {
      attributes: {
        id: "body-editor",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class: "body-editor-content",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
}
