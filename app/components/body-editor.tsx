import type { Editor } from "@tiptap/core";
import { useEffect, useReducer, useRef, useState } from "react";
import { type ArticleBody, HEADING_LEVELS } from "~/lib/article-body";

export type EmbeddableItem = { id: string; title: string };

const LABEL_ID = "body-label";
const ERROR_ID = "body-error";

/**
 * The Tiptap body editor. The server renders a hidden `body` field holding the current JSON, so a
 * save without the editor keeps the body as it was; once the page hydrates the editor mounts and
 * keeps that field in step with every change.
 */
export function BodyEditor({
  initial,
  embeddable,
  error,
}: {
  initial: ArticleBody;
  embeddable: EmbeddableItem[];
  error?: string;
}) {
  const [json, setJson] = useState(() => JSON.stringify(initial));
  const [editor, setEditor] = useState<Editor | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the editor is created once, from the first value.
  useEffect(() => {
    let created: Editor | null = null;
    let cancelled = false;
    import("~/lib/article-editor.client").then(({ createArticleEditor }) => {
      if (cancelled || !mount.current) return;
      created = createArticleEditor({
        element: mount.current,
        content: initial,
        embeddable,
        labelledBy: LABEL_ID,
        onChange: (doc) => setJson(JSON.stringify(doc)),
      });
      created.on("transaction", rerender);
      setEditor(created);
    });
    return () => {
      cancelled = true;
      created?.destroy();
    };
  }, []);

  // The error can change after the editor exists (a second failed save), so keep its description in step.
  useEffect(() => {
    if (!editor) return;
    import("~/lib/article-editor.client").then(({ describeEditor }) =>
      describeEditor(editor, LABEL_ID, error ? ERROR_ID : undefined),
    );
  }, [editor, error]);

  return (
    <div className="body-field">
      <p id={LABEL_ID} className="label">
        Body
      </p>
      <input type="hidden" name="body" value={json} />
      <noscript>
        <p>The body editor needs JavaScript. Other fields can still be saved; the body stays as it was.</p>
      </noscript>
      {editor && <Toolbar editor={editor} embeddable={embeddable} />}
      <div ref={mount} className="body-editor" />
      {error && (
        <p id={ERROR_ID} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function Toolbar({ editor, embeddable }: { editor: Editor; embeddable: EmbeddableItem[] }) {
  const [embedId, setEmbedId] = useState("");
  const chain = () => editor.chain().focus();
  const toggle = (label: string, active: boolean, run: () => void) => (
    <button type="button" aria-pressed={active} onClick={run}>
      {label}
    </button>
  );

  const addLink = () => {
    const current = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link address (https://…, mailto:… or a path such as /voices/…)", current ?? "");
    if (href === null) return;
    if (href.trim() === "") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  const addImage = () => {
    const src = window.prompt("Image address (https://… or a path on this site)");
    if (!src?.trim()) return;
    const alt = window.prompt("Describe the image for people who can't see it (required)");
    if (!alt?.trim()) {
      window.alert("The image was not added: every image needs a description.");
      return;
    }
    chain().setImage({ src: src.trim(), alt: alt.trim() }).run();
  };

  return (
    <div role="toolbar" aria-label="Formatting" aria-controls="body-editor" className="body-toolbar">
      {HEADING_LEVELS.map((level) =>
        toggle(`Heading ${level}`, editor.isActive("heading", { level }), () => chain().toggleHeading({ level }).run()),
      )}
      {toggle("Bold", editor.isActive("bold"), () => chain().toggleBold().run())}
      {toggle("Italic", editor.isActive("italic"), () => chain().toggleItalic().run())}
      {toggle("Bulleted list", editor.isActive("bulletList"), () => chain().toggleBulletList().run())}
      {toggle("Numbered list", editor.isActive("orderedList"), () => chain().toggleOrderedList().run())}
      {toggle("Quote", editor.isActive("blockquote"), () => chain().toggleBlockquote().run())}
      {toggle("Callout", editor.isActive("callout"), () => chain().toggleWrap("callout").run())}
      {toggle("Link", editor.isActive("link"), addLink)}
      <button type="button" onClick={addImage}>
        Image
      </button>
      {embeddable.length > 0 && (
        <span className="embed-picker">
          <label htmlFor="embed-item">Embed</label>
          <select id="embed-item" value={embedId} onChange={(event) => setEmbedId(event.target.value)}>
            <option value="">Choose a Content Item</option>
            {embeddable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!embedId}
            onClick={() => {
              chain()
                .insertContent({ type: "contentItem", attrs: { id: embedId } })
                .run();
              setEmbedId("");
            }}
          >
            Insert
          </button>
        </span>
      )}
    </div>
  );
}
