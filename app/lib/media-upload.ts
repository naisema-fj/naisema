import { checkContent, checkDeclared, HEAD_BYTES } from "./upload-rules";

/**
 * The media library's browser upload (app/lib/media.server.ts is the other side). It checks the
 * file against the allowlist before contacting the server, sends it in parts, retries a part lost
 * in transit, and remembers an unfinished upload so choosing the same file again resumes it.
 */

export type UploadStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type UploadOptions = {
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  storage?: UploadStorage;
  onProgress?: (sentBytes: number) => void;
  /** Pauses before a retry; replaceable so tests don't wait. */
  wait?: (ms: number) => Promise<void>;
};

export type UploadOutcome = { ok: true; id: string } | { ok: false; error: string };

const RETRIES = 3;

/** localStorage, or a stand-in that remembers nothing where the browser blocks it (resuming is then off). */
function browserStorage(): UploadStorage {
  try {
    const probe = "naisema-upload-probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }
}

class Refused extends Error {}

/** Remembers an unfinished upload by the file's name, size and modification time. */
const resumeKey = (file: File) => `naisema-upload:${file.name}:${file.size}:${file.lastModified}`;

async function errorOf(response: Response) {
  const text = await response.text().catch(() => "");
  try {
    return (JSON.parse(text) as { error?: string }).error ?? text;
  } catch {
    return text || `The upload failed (${response.status}).`;
  }
}

export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadOutcome> {
  const send = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const storage = options.storage ?? browserStorage();
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const declared = checkDeclared(file, "media");
  if (!declared.ok) return { ok: false, error: declared.error };
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const content = checkContent(declared.type, head);
  if (!content.ok) return { ok: false, error: content.error };

  try {
    let upload: { id: string; partSize: number; partCount: number; received: number[] } | null = null;
    const earlier = storage.getItem(resumeKey(file));
    if (earlier) {
      const response = await send(`/admin/media/uploads/${earlier}`);
      const status = response.ok
        ? ((await response.json()) as { status: string; partSize: number; partCount: number; received: number[] })
        : null;
      if (status?.status === "uploading") upload = { id: earlier, ...status };
      else storage.removeItem(resumeKey(file));
    }
    if (!upload) {
      const response = await send("/admin/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          type: file.type,
          size: file.size,
          head: btoa(String.fromCharCode(...head)),
        }),
      });
      if (!response.ok) throw new Refused(await errorOf(response));
      const started = (await response.json()) as { id: string; partSize: number; partCount: number };
      upload = { ...started, received: [] };
      storage.setItem(resumeKey(file), started.id);
    }

    const { id, partSize, partCount } = upload;
    const received = new Set(upload.received);
    const sizeOf = (part: number) => Math.min(partSize, file.size - (part - 1) * partSize);
    let sent = [...received].reduce((sum, part) => sum + sizeOf(part), 0);
    options.onProgress?.(sent);

    for (let part = 1; part <= partCount; part++) {
      if (received.has(part)) continue;
      const bytes = file.slice((part - 1) * partSize, part * partSize);
      for (let attempt = 0; ; attempt++) {
        const response = await send(`/admin/media/uploads/${id}/parts/${part}`, { method: "PUT", body: bytes }).catch(
          () => null,
        );
        if (response?.ok) break;
        // A refusal (4xx) is final; a lost connection or server error is worth another try.
        if (response && response.status < 500 && response.status !== 408 && response.status !== 429) {
          storage.removeItem(resumeKey(file));
          throw new Refused(await errorOf(response));
        }
        if (attempt >= RETRIES) {
          throw new Refused("The connection keeps dropping. Choose the same file again later to carry on.");
        }
        await wait(1000 * 2 ** attempt);
      }
      sent += sizeOf(part);
      options.onProgress?.(sent);
    }

    const done = await send(`/admin/media/uploads/${id}`, { method: "POST" });
    if (!done.ok) throw new Refused(await errorOf(done));
    storage.removeItem(resumeKey(file));
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    return { ok: false, error: "The upload stopped. Choose the same file again to carry on where it left off." };
  }
}
