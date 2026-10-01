import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { staff } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";
import { recordMediaRights } from "./support/rights";

/** A 1×1 PNG. */
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);
const PDF = new TextEncoder().encode("%PDF-1.7\nA reading list.");

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** The 1×1 PNG with a text chunk carrying location metadata, as a phone might write it. */
function pngWithLocation() {
  const data = new TextEncoder().encode("GPSLatitude\u0000-19.0581 Kadavu");
  const type = new TextEncoder().encode("tEXt");
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  // Straight after the signature and the IHDR chunk (8 + 25 bytes).
  return new Uint8Array([...PNG.subarray(0, 33), ...chunk, ...PNG.subarray(33)]);
}

const cleanScanner: Scanner = async ({ body }) => {
  await body.cancel();
  return { verdict: "clean" };
};

/**
 * Uploads a file to the media library, scanned clean unless `scan` is false and with a Rights
 * Record of its own granting Publish unless `rights` is false.
 */
async function uploaded(name: string, type: string, bytes: Uint8Array, { scan = true, rights = true } = {}) {
  const editor = await staff("editor", { role: "editor" });
  const { id } = (await (
    await startUpload(editor.browser, { name, type, size: bytes.length, head: bytes })
  ).json()) as {
    id: string;
  };
  await sendPart(editor.browser, id, 1, bytes);
  await completeUpload(editor.browser, id);
  if (scan) await scanUpload(env, getDb(env.DB), id, cleanScanner);
  if (scan && rights) expect((await recordMediaRights(editor.browser, id)).status).toBe(302);
  return { id, editor };
}

const visit = (path: string) => SELF.fetch(`https://naisema.test${path}`);

describe("delivering media library files", () => {
  it("serves a scanned image through Cloudflare Images, re-encoded as WebP", async () => {
    const { id } = await uploaded("photo.png", "image/png", PNG);

    const response = await visit(`/media/images/${id}/320`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("strips the image's metadata, location included", async () => {
    const original = pngWithLocation();
    expect(new TextDecoder().decode(original)).toContain("Kadavu");
    const { id } = await uploaded("photo.png", "image/png", original);

    const response = await visit(`/media/images/${id}/640`);

    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(0, 4)) + new TextDecoder().decode(bytes.subarray(8, 12))).toBe(
      "RIFFWEBP",
    );
    expect(new TextDecoder().decode(bytes)).not.toContain("Kadavu");
  });

  it("serves only the agreed widths", async () => {
    const { id } = await uploaded("photo.png", "image/png", PNG);

    expect((await visit(`/media/images/${id}/321`)).status).toBe(404);
  });

  it("serves a PDF only as a sandboxed download", async () => {
    const { id } = await uploaded("reading list.pdf", "application/pdf", PDF);

    const response = await visit(`/media/files/${id}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="reading_list.pdf"');
    expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(await response.text()).toContain("A reading list.");
  });

  it("serves nothing that hasn't passed its scan", async () => {
    const { id: image } = await uploaded("photo.png", "image/png", PNG, { scan: false });
    const { id: file } = await uploaded("list.pdf", "application/pdf", PDF, { scan: false });

    expect((await visit(`/media/images/${image}/320`)).status).toBe(404);
    expect((await visit(`/media/files/${file}`)).status).toBe(404);
  });

  it("serves nothing without a current Rights Record of the file's own granting Publish", async () => {
    const { id: image } = await uploaded("photo.png", "image/png", PNG, { rights: false });
    const { id: file, editor } = await uploaded("list.pdf", "application/pdf", PDF);
    expect((await visit(`/media/files/${file}`)).status).toBe(200);

    const record = await env.DB.prepare(
      "SELECT id FROM rights_record WHERE subject_type = 'media_asset' AND subject_id = ?1",
    )
      .bind(file)
      .first<{ id: string }>();
    const withdrawn = await editor.browser.fetch(`/admin/media/${file}/rights`, {
      form: { intent: "withdraw", recordId: record?.id as string, reason: "The author asked us to stop." },
    });

    expect(withdrawn.status).toBe(302);
    expect((await visit(`/media/images/${image}/320`)).status).toBe(404);
    expect((await visit(`/media/files/${file}`)).status).toBe(404);
  });
});
