import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { staff } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";

/** A 1×1 PNG. */
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);
const PDF = new TextEncoder().encode("%PDF-1.7\nA reading list.");

const cleanScanner: Scanner = async ({ body }) => {
  await body.cancel();
  return { verdict: "clean" };
};

/** Uploads a file to the media library; scanned clean unless `scan` is false. */
async function uploaded(name: string, type: string, bytes: Uint8Array, { scan = true } = {}) {
  const editor = await staff("editor", { role: "editor" });
  const { id } = (await (await startUpload(editor.browser, { name, type, size: bytes.length })).json()) as {
    id: string;
  };
  await sendPart(editor.browser, id, 1, bytes);
  await completeUpload(editor.browser, id);
  if (scan) await scanUpload(env, getDb(env.DB), id, cleanScanner);
  return id;
}

const visit = (path: string) => SELF.fetch(`https://naisema.test${path}`);

describe("delivering media library files", () => {
  it("serves a scanned image through Cloudflare Images, re-encoded as WebP", async () => {
    const id = await uploaded("photo.png", "image/png", PNG);

    const response = await visit(`/media/images/${id}/320`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("serves only the agreed widths", async () => {
    const id = await uploaded("photo.png", "image/png", PNG);

    expect((await visit(`/media/images/${id}/321`)).status).toBe(404);
  });

  it("serves a PDF only as a sandboxed download", async () => {
    const id = await uploaded("reading list.pdf", "application/pdf", PDF);

    const response = await visit(`/media/files/${id}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="reading_list.pdf"');
    expect(response.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(await response.text()).toContain("A reading list.");
  });

  it("serves nothing that hasn't passed its scan", async () => {
    const image = await uploaded("photo.png", "image/png", PNG, { scan: false });
    const file = await uploaded("list.pdf", "application/pdf", PDF, { scan: false });

    expect((await visit(`/media/images/${image}/320`)).status).toBe(404);
    expect((await visit(`/media/files/${file}`)).status).toBe(404);
  });
});
