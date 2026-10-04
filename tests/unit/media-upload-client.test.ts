import { describe, expect, it } from "vitest";
import { type UploadStorage, uploadFile } from "~/lib/media-upload";

const PART = 4;

/** A pretend server for the upload endpoints, recording what the browser sent. */
function server({ received = [] as number[], failPartOnce = 0, existing = "" } = {}) {
  const calls: string[] = [];
  let failed = false;
  const fetcher = async (input: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push(`${method} ${input}`);
    if (method === "POST" && input === "/admin/media/uploads") {
      return Response.json({ id: "new-upload", partSize: PART, partCount: 3 }, { status: 201 });
    }
    if (method === "GET" && input === `/admin/media/uploads/${existing}`) {
      return Response.json({ status: "uploading", partSize: PART, partCount: 3, received });
    }
    if (method === "PUT") {
      const part = Number(input.split("/").at(-1));
      if (part === failPartOnce && !failed) {
        failed = true;
        return new Response("Bad gateway", { status: 502 });
      }
      return Response.json({ partNumber: part });
    }
    if (method === "POST") return Response.json({ id: input.split("/").at(-1), status: "scanning" });
    return new Response("Not found", { status: 404 });
  };
  return { calls, fetcher };
}

function memoryStorage(entries: Record<string, string> = {}): UploadStorage & { entries: Record<string, string> } {
  return {
    entries,
    getItem: (key) => entries[key] ?? null,
    setItem: (key, value) => {
      entries[key] = value;
    },
    removeItem: (key) => {
      delete entries[key];
    },
  };
}

const pdf = () => new File(["%PDF-1.7 abc"], "guide.pdf", { type: "application/pdf", lastModified: 1 });

describe("uploadFile, the media library's browser upload", () => {
  it("refuses a file off the allowlist without contacting the server", async () => {
    const { calls, fetcher } = server();
    const file = new File(["MZ"], "setup.exe", { type: "application/x-msdownload" });

    const result = await uploadFile(file, { fetch: fetcher, storage: memoryStorage(), wait: async () => {} });

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("MP4, MOV") });
    expect(calls).toEqual([]);
  });

  it("refuses a video master over 15 minutes before sending it, when the browser can read its length", async () => {
    const { calls, fetcher } = server();
    const video = new File(
      [Uint8Array.from([0, 0, 0, 0x20, ...new TextEncoder().encode("ftypisom"), 0, 0, 0, 0])],
      "talk.mp4",
      {
        type: "video/mp4",
      },
    );

    const tooLong = await uploadFile(video, {
      fetch: fetcher,
      storage: memoryStorage(),
      readDuration: async () => 16 * 60 * 1000,
    });
    expect(tooLong).toEqual({
      ok: false,
      error: "This video is 16:00 long. The limit is 15 minutes: trim it, or upload the part you need, and try again.",
    });
    expect(calls).toEqual([]);

    // A length the browser can't read is left to the server, which reads it before accepting the file.
    const unknown = await uploadFile(video, {
      fetch: fetcher,
      storage: memoryStorage(),
      readDuration: async () => null,
    });
    expect(unknown.ok).toBe(true);
  });

  it("starts, sends every part, completes, and forgets the upload", async () => {
    const { calls, fetcher } = server();
    const storage = memoryStorage();
    const progress: number[] = [];

    const result = await uploadFile(pdf(), {
      fetch: fetcher,
      storage,
      wait: async () => {},
      onProgress: (sent) => progress.push(sent),
    });

    expect(result).toEqual({ ok: true, id: "new-upload" });
    expect(calls).toEqual([
      "POST /admin/media/uploads",
      "PUT /admin/media/uploads/new-upload/parts/1",
      "PUT /admin/media/uploads/new-upload/parts/2",
      "PUT /admin/media/uploads/new-upload/parts/3",
      "POST /admin/media/uploads/new-upload",
    ]);
    expect(progress.at(-1)).toBe(12);
    expect(storage.entries).toEqual({});
  });

  it("resumes an interrupted upload of the same file, sending only the missing parts", async () => {
    const file = pdf();
    const storage = memoryStorage({
      [`naisema-upload:/admin/media/uploads:${file.name}:${file.size}:${file.lastModified}`]: "earlier",
    });
    const { calls, fetcher } = server({ existing: "earlier", received: [1, 3] });

    const result = await uploadFile(file, { fetch: fetcher, storage, wait: async () => {} });

    expect(result).toEqual({ ok: true, id: "earlier" });
    expect(calls).toEqual([
      "GET /admin/media/uploads/earlier",
      "PUT /admin/media/uploads/earlier/parts/2",
      "POST /admin/media/uploads/earlier",
    ]);
  });

  it("retries a part that failed in transit", async () => {
    const { calls, fetcher } = server({ failPartOnce: 2 });

    const result = await uploadFile(pdf(), { fetch: fetcher, storage: memoryStorage(), wait: async () => {} });

    expect(result).toEqual({ ok: true, id: "new-upload" });
    expect(calls.filter((call) => call.endsWith("/parts/2"))).toHaveLength(2);
  });

  it("stops at a refusal and shows the server's reason", async () => {
    const fetcher = async (_input: string, init: RequestInit = {}) =>
      init.method === "PUT"
        ? Response.json({ error: "The file's contents don't match its type." }, { status: 400 })
        : Response.json({ id: "x", partSize: PART, partCount: 3 }, { status: 201 });

    const result = await uploadFile(pdf(), { fetch: fetcher, storage: memoryStorage(), wait: async () => {} });

    expect(result).toEqual({ ok: false, error: "The file's contents don't match its type." });
  });
});
