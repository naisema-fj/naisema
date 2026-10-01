import { data, Form } from "react-router";
import { MediaUploader } from "~/components/media-uploader";
import { cloudflareContext } from "~/lib/cloudflare";
import { listMedia, setAltText } from "~/lib/media.server";
import { requireUploader } from "~/lib/media-access.server";
import { filePath, imagePath } from "~/lib/media-delivery.server";
import { primaryPublicOrigin } from "~/lib/public-cache.server";
import { formatBytes, type MediaStatus, UPLOAD_TYPE_NAMES } from "~/lib/upload-rules";
import type { Route } from "./+types/index";

export function meta() {
  return [{ title: "Media library · Na iSema staff" }];
}

const STATUS_NAMES: Record<MediaStatus, string> = {
  uploading: "Upload not finished",
  scanning: "Being scanned for viruses",
  ready: "Ready",
  infected: "Blocked: a virus was found",
  failed: "Refused",
  removed: "Removed after 30 days in quarantine",
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { db } = await requireUploader(env, request);
  // Ready files open on the public site, where they are delivered.
  const publicOrigin = primaryPublicOrigin(env);
  const assets = await listMedia(db);
  return {
    assets: assets.map((asset) => {
      const isImage = asset.type.startsWith("image/");
      const ready = asset.status === "ready";
      return {
        id: asset.id,
        name: asset.name,
        typeName: UPLOAD_TYPE_NAMES[asset.type] ?? asset.type,
        size: formatBytes(asset.size),
        status: STATUS_NAMES[asset.status] ?? asset.status,
        reason: asset.statusReason,
        isImage,
        // Alt text describes an image people can see, so only a ready image takes it.
        takesAltText: isImage && ready,
        altText: asset.altText,
        link:
          ready && isImage
            ? `${publicOrigin}${imagePath(asset.id, 960)}`
            : ready && asset.type === "application/pdf"
              ? `${publicOrigin}${filePath(asset.id)}`
              : null,
      };
    }),
    saved: new URL(request.url).searchParams.get("saved"),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireUploader(env, request);
  const form = await request.formData();
  if (form.get("intent") !== "alt") {
    return data({ error: "Uploading needs JavaScript. Turn it on, or use a browser that has it." }, { status: 400 });
  }
  const saved = await setAltText(
    db,
    actor.userId,
    String(form.get("assetId") ?? ""),
    String(form.get("altText") ?? ""),
  );
  if (!saved) return data({ error: "That file isn't in the media library." }, { status: 404 });
  return data({ error: null, savedId: String(form.get("assetId")) });
}

export default function MediaLibrary({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page page-wide">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Media library</h1>
      <MediaUploader />
      {actionData?.error && <p role="alert">{actionData.error}</p>}
      <h2>Files</h2>
      {loaderData.assets.length ? (
        // A labelled, focusable region, so the table can be scrolled by keyboard on a narrow screen.
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard.
        <section className="table-scroll" aria-labelledby="files-caption" tabIndex={0}>
          <table className="media-table">
            <caption id="files-caption">Every upload, newest first, with its scan state</caption>
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Type</th>
                <th scope="col">Size</th>
                <th scope="col">State</th>
                <th scope="col">Alt text</th>
                <th scope="col">Rights Record</th>
              </tr>
            </thead>
            <tbody>
              {loaderData.assets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.link ? <a href={asset.link}>{asset.name}</a> : asset.name}</td>
                  <td>{asset.typeName}</td>
                  <td>{asset.size}</td>
                  <td>
                    {asset.status}
                    {asset.reason && <span className="reason">{asset.reason}</span>}
                  </td>
                  <td>
                    {asset.takesAltText ? (
                      <Form method="post" className="alt-form">
                        <input type="hidden" name="intent" value="alt" />
                        <input type="hidden" name="assetId" value={asset.id} />
                        <label htmlFor={`alt-${asset.id}`} className="visually-hidden">
                          Alt text for {asset.name}
                        </label>
                        <input
                          id={`alt-${asset.id}`}
                          name="altText"
                          defaultValue={asset.altText}
                          maxLength={500}
                          placeholder="Describe the image"
                        />
                        <button type="submit">Save</button>
                        {actionData && "savedId" in actionData && actionData.savedId === asset.id && (
                          <span role="status">Saved</span>
                        )}
                      </Form>
                    ) : asset.isImage ? (
                      "Once it passes its scan"
                    ) : (
                      "Not needed"
                    )}
                  </td>
                  <td>Not recorded yet (media Rights Records are coming)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <p>Nothing has been uploaded yet.</p>
      )}
    </main>
  );
}
