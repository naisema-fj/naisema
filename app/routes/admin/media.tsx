import { useState } from "react";
import { TableScroll } from "~/components/table-scroll";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { listMedia } from "~/lib/media.server";
import { acceptedExtensions, checkDeclared, formatBytes } from "~/lib/media-rules";
import { can } from "~/lib/roles";
import type { RouteHandle } from "~/lib/route-handle";
import { formatTimecode } from "~/lib/segment-rules";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/media";

/** The page reads a chosen video's length in the browser, from a `blob:` address. */
export const handle: RouteHandle = { video: true };

const KIND_NAMES = { image: "Image", audio: "Audio", video: "Video", document: "Document" } as const;

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request, "media.upload");
  const files = await listMedia(getDb(env.DB));
  return { files, rights: can(actor, "rights.manage"), accept: acceptedExtensions("media") };
}

export function meta() {
  return [{ title: "Media library · NAISEMA staff" }];
}

/** What the browser can tell about a file before it is sent: a picture's size, a clip's size and length. */
async function factsOf(file: File) {
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height };
  }
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
    const url = URL.createObjectURL(file);
    try {
      const element = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
      element.preload = "metadata";
      element.src = url;
      await new Promise((resolve, reject) => {
        element.onloadedmetadata = resolve;
        element.onerror = () => reject(new Error("unreadable"));
      });
      const video = element instanceof HTMLVideoElement ? element : null;
      return {
        durationMs: Math.round(element.duration * 1000),
        width: video?.videoWidth,
        height: video?.videoHeight,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return {};
}

function Uploader({ accept }: { accept: string }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    const alt = (form.elements.namedItem("alt") as HTMLInputElement).value;
    if (!file) return setStatus("Choose a file first.");
    const declared = checkDeclared(file, "media");
    if (!declared.ok) return setStatus(declared.error);
    if (file.type.startsWith("image/") && !alt.trim())
      return setStatus("Describe the image for people who can't see it.");
    setBusy(true);
    setStatus(`Uploading ${file.name}…`);
    try {
      const facts = await factsOf(file).catch(() => ({}));
      const query = new URLSearchParams({ name: file.name, alt });
      for (const [key, value] of Object.entries(facts)) if (value) query.set(key, String(value));
      const response = await fetch(`/admin/media/upload?${query}`, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": declared.type },
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The upload failed.");
      setStatus(`${file.name} is in the library. Add its Rights Record before using it publicly.`);
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The upload failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={upload} aria-labelledby="upload-heading">
      <h2 id="upload-heading">Upload</h2>
      <p className="hint">
        MP4 video (H.264, up to 95 MB), MP3 or M4A audio, PDF, JPEG, PNG or WebP. Keep the original of every clip in the
        NAISEMA Drive too.
      </p>
      <label htmlFor="file">File</label>
      <input id="file" name="file" type="file" accept={accept} required />
      <label htmlFor="alt">For images: what it shows, for people who can't see it</label>
      <input id="alt" name="alt" maxLength={500} />
      <button type="submit" disabled={busy}>
        Upload
      </button>
      <p role="status">{status}</p>
    </form>
  );
}

export default function Media({ loaderData }: Route.ComponentProps) {
  const { files, rights } = loaderData;
  return (
    <main id="main" className="page">
      <h1>Media library</h1>
      <WhatsThis summary="Preparing and using files">
        <ul>
          <li>
            <strong>A clip for a Video:</strong> MP4, H.264, 720p, two minutes at most and under 95 MB, so it plays
            everywhere. Keep the original in the NAISEMA Drive too.
          </li>
          <li>
            <strong>Its length and shape</strong> are read as it uploads. You choose it on the Video's page afterwards.
          </li>
          <li>
            <strong>Rights:</strong> a file can't be shown publicly until it has its own Rights Record that grants
            Publish. Use <strong>Rights Records</strong> beside the file.
          </li>
          <li>
            <strong>Images:</strong> add a line saying what each one shows, for people who can't see it.
          </li>
        </ul>
      </WhatsThis>
      <Uploader accept={loaderData.accept} />
      <h2 id="files-heading">Files</h2>
      {files.length ? (
        <TableScroll label="Media files">
          <table>
            <caption className="visually-hidden">Media files, newest first</caption>
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Kind</th>
                <th scope="col">Size</th>
                <th scope="col">Details</th>
                {rights && <th scope="col">Rights</th>}
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td>
                    <a href={file.kind === "image" ? `/media/images/${file.id}/640` : `/media/files/${file.id}`}>
                      {file.filename}
                    </a>
                  </td>
                  <td>{KIND_NAMES[file.kind]}</td>
                  <td>{formatBytes(file.bytes)}</td>
                  <td>
                    {file.width && file.height ? `${file.width}×${file.height}` : ""}
                    {file.durationMs ? ` ${formatTimecode(file.durationMs)}` : ""}
                    {file.alt && ` "${file.alt}"`}
                  </td>
                  {rights && (
                    <td>
                      <a href={`/admin/rights/media/${file.id}`}>Rights Records</a>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : (
        <p>Nothing uploaded yet.</p>
      )}
    </main>
  );
}
