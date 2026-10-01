import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { PART_SIZE } from "~/lib/media.server";
import { staff } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";

const pdf = (size: number) => {
  const bytes = new Uint8Array(size).fill(0x20);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  return bytes;
};

async function asset(id: string) {
  return env.DB.prepare("SELECT status, status_reason AS reason, quarantine_key AS key FROM media_asset WHERE id = ?1")
    .bind(id)
    .first<{ status: string; reason: string | null; key: string }>();
}

describe("uploading into quarantine", () => {
  it("takes a file in parts and queues it for a scan, without it reaching the media bucket", async () => {
    const editor = await staff("editor", { role: "editor" });
    const bytes = pdf(PART_SIZE + 1234);

    const started = await startUpload(editor.browser, {
      name: "guide.pdf",
      type: "application/pdf",
      size: bytes.length,
    });
    expect(started.status).toBe(201);
    const { id, partCount } = (await started.json()) as { id: string; partCount: number };
    expect(partCount).toBe(2);

    expect((await sendPart(editor.browser, id, 1, bytes.subarray(0, PART_SIZE))).status).toBe(200);
    expect((await sendPart(editor.browser, id, 2, bytes.subarray(PART_SIZE))).status).toBe(200);
    const done = await completeUpload(editor.browser, id);

    expect(done.status, await done.clone().text()).toBe(200);
    const row = await asset(id);
    expect(row?.status).toBe("scanning");
    const stored = await env.QUARANTINE.get(row?.key as string);
    expect(stored?.size).toBe(bytes.length);
    expect(await env.MEDIA.head(`media/${id}`)).toBeNull();
  });

  it("resumes: it says which parts have arrived, and takes the rest later", async () => {
    const editor = await staff("editor", { role: "editor" });
    const bytes = pdf(PART_SIZE + 10);
    const { id } = (await (
      await startUpload(editor.browser, { name: "long.pdf", type: "application/pdf", size: bytes.length })
    ).json()) as { id: string };
    await sendPart(editor.browser, id, 1, bytes.subarray(0, PART_SIZE));

    expect((await completeUpload(editor.browser, id)).status).toBe(409);
    const status = (await (await editor.browser.fetch(`/admin/media/uploads/${id}`)).json()) as { received: number[] };
    expect(status.received).toEqual([1]);

    await sendPart(editor.browser, id, 2, bytes.subarray(PART_SIZE));
    expect((await completeUpload(editor.browser, id)).status).toBe(200);
  });

  it("refuses a file type off the allowlist before the upload starts", async () => {
    const editor = await staff("editor", { role: "editor" });

    const response = await startUpload(editor.browser, {
      name: "setup.exe",
      type: "application/x-msdownload",
      size: 10,
    });

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain(
      "MP4, MOV, MP3, M4A, PDF, JPEG, PNG or WebP",
    );
  });

  it("blocks a renamed executable at its first part, and keeps the reason for staff", async () => {
    const editor = await staff("editor", { role: "editor" });
    // A Windows executable's "MZ" header, named as a video.
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]);
    const { id } = (await (
      await startUpload(editor.browser, { name: "clip.mp4", type: "video/mp4", size: exe.length })
    ).json()) as { id: string };

    const response = await sendPart(editor.browser, id, 1, exe);

    expect(response.status).toBe(400);
    const row = await asset(id);
    expect(row?.status).toBe("failed");
    expect(row?.reason).toContain("don't match its type");
    expect((await completeUpload(editor.browser, id)).status).toBe(409);
  });

  it("refuses the EICAR test file named as a PDF before it is stored", async () => {
    const editor = await staff("editor", { role: "editor" });
    // The EICAR test file, decoded here so no copy of it sits in the repository.
    const eicar = Uint8Array.from(
      atob("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo="),
      (char) => char.charCodeAt(0),
    );
    const { id } = (await (
      await startUpload(editor.browser, { name: "eicar.pdf", type: "application/pdf", size: eicar.length })
    ).json()) as { id: string };

    expect((await sendPart(editor.browser, id, 1, eicar)).status).toBe(400);
    expect((await asset(id))?.status).toBe("failed");
  });

  it("refuses a part of the wrong size", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id } = (await (
      await startUpload(editor.browser, { name: "a.pdf", type: "application/pdf", size: 100 })
    ).json()) as { id: string };

    expect((await sendPart(editor.browser, id, 1, pdf(99))).status).toBe(400);
  });

  it("lets only editors and Educators upload, and only the uploader continue an upload", async () => {
    const reviewer = await staff("reviewer", { role: "reviewer", reviewType: "editorial" });
    expect((await startUpload(reviewer.browser, { name: "a.pdf", type: "application/pdf", size: 10 })).status).toBe(
      403,
    );

    const educator = await staff("educator", { role: "educator" });
    const started = await startUpload(educator.browser, { name: "a.pdf", type: "application/pdf", size: 10 });
    expect(started.status).toBe(201);
    const { id } = (await started.json()) as { id: string };

    const editor = await staff("editor", { role: "editor" });
    expect((await sendPart(editor.browser, id, 1, pdf(10))).status).toBe(404);
  });

  it("has no upload path on the public site", async () => {
    const { SELF } = await import("cloudflare:test");
    const response = await SELF.fetch("https://naisema.test/admin/media/uploads", {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json", Origin: "https://naisema.test" },
    });
    expect(response.status).toBe(404);
  });
});
