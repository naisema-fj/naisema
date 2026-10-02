import { Form } from "react-router";
import { MediaUploader } from "~/components/media-uploader";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { finishUploadLink, linkFiles, openUploadLink } from "~/lib/submissions.server";
import { formatBytes, type MediaStatus } from "~/lib/upload-rules";
import type { Route } from "./+types/upload-link";

/**
 * A contributor's single-use upload link (docs/phase-1a-defaults.md §4). The page uses the
 * resumable uploader, so it loads the app's JavaScript; it is never cached and never indexed.
 */
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "Upload your files · Na iSema" }, { name: "robots", content: "noindex" }];
}

const STATUS_TEXT: Record<MediaStatus, string> = {
  uploading: "Still arriving: choose the same file again to finish sending it",
  scanning: "Being checked for viruses",
  ready: "Received",
  infected: "Not accepted",
  failed: "Not accepted",
  removed: "Not accepted",
};

export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const opened = await openUploadLink(db, params.token);
  // Not a 410: this also renders straight after the contributor finishes, which closes the link.
  if (!opened) return { open: false as const };
  const files = await linkFiles(db, opened.link.id);
  return {
    open: true as const,
    name: opened.name,
    expiresAt: opened.link.expiresAt.toISOString(),
    files: files.map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      status: STATUS_TEXT[file.status],
      reason: file.status === "failed" || file.status === "infected" ? file.statusReason : null,
    })),
  };
}

export async function action({ params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const db = getDb(env.DB);
  const opened = await openUploadLink(db, params.token);
  if (!opened) return { finished: false };
  await finishUploadLink(db, opened.link.id, opened.link.submissionId);
  return { finished: true };
}

const dateText = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", timeZone: "Pacific/Fiji" }).format(new Date(iso));

export default function UploadLink({ loaderData, actionData, params }: Route.ComponentProps) {
  if (actionData?.finished) {
    return (
      <main id="main">
        <article className="letter letter-narrow">
          <h1>Vinaka, that's everything</h1>
          <p role="status">
            We have your files. Each one is checked for viruses before anyone opens it, and an editor will be in touch.
            This link no longer works.
          </p>
        </article>
      </main>
    );
  }
  if (!loaderData.open) {
    return (
      <main id="main">
        <article className="letter letter-narrow">
          <h1>This link no longer works</h1>
          <p>
            Upload links work for a few days, and stop once you've said you've finished. If you still have files to send
            us, reply to our email and we'll send you a new link.
          </p>
        </article>
      </main>
    );
  }
  return (
    <main id="main">
      <article className="letter letter-narrow">
        <h1>Upload your files</h1>
        <p className="standfirst">
          Bula {loaderData.name}. Send the material you offered us here. This link is only for you, and works until{" "}
          {dateText(loaderData.expiresAt)} or until you say you've finished.
        </p>
        <MediaUploader
          endpoint={`/upload/${params.token}/files`}
          purpose="submission"
          heading="Send a file"
          hint="One at a time: MP4 or MOV video up to 2 GB, MP3 or M4A audio up to 500 MB, a PDF up to 50 MB, or a JPEG, PNG or WebP image up to 25 MB. Only send material you made, or have permission to share."
          className="public-form upload-form"
        />
        <section aria-labelledby="sent-heading">
          <h2 id="sent-heading">Sent so far</h2>
          {loaderData.files.length ? (
            <ul className="sent-files">
              {loaderData.files.map((file) => (
                <li key={file.id}>
                  {file.name} ({formatBytes(file.size)}): {file.status}
                  {file.reason && <>. {file.reason}</>}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nothing yet.</p>
          )}
        </section>
        <Form method="post" className="public-form">
          <p>When you've sent everything, tell us. The link stops working once you do.</p>
          <button type="submit">I've sent everything</button>
        </Form>
      </article>
    </main>
  );
}
