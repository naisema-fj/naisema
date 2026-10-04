import { checkContent, checkDeclared, HEAD_BYTES, kindOf, type UploadPurpose } from "./upload-rules";
import { lengthProblem } from "./video-rules";

/**
 * The media library's browser upload (app/lib/media.server.ts is the other side). It checks the
 * file against the allowlist before contacting the server, sends it in parts, retries a part lost
 * in transit, and remembers an unfinished upload so choosing the same file again resumes it.
 */

export type UploadStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type UploadOptions = {
  /** Where uploads start: the media library's, or a contributor's upload link (app/routes.ts). */
  endpoint?: string;
  /** What the file is for, which decides the types and sizes allowed. */
  purpose?: Exclude<UploadPurpose, "evidence">;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
  storage?: UploadStorage;
  onProgress?: (sentBytes: number) => void;
  /** Pauses before a retry; replaceable so tests don't wait. */
  wait?: (ms: number) => Promise<void>;
  /** A video's length in milliseconds, or null if the browser can't tell; replaceable for tests. */
  readDuration?: (file: File) => Promise<number | null>;
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

/**
 * A video's length as the browser reads it from the file's metadata, or null if it can't (it may
 * not decode the format). The server reads the length itself before accepting the file, so this
 * only spares the wait of uploading a video that would be refused.
 */
async function browserDuration(file: File): Promise<number | null> {
  if (typeof document === "undefined") return null;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number | null>((resolve) => {
      const video = document.createElement("video");
      const done = (value: number | null) => {
        video.removeAttribute("src");
        resolve(value);
      };
      video.preload = "metadata";
      video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null);
      video.onerror = () => done(null);
      setTimeout(() => done(null), 5000);
      video.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Remembers an unfinished upload by where it goes and the file's name, size and modification time. */
const resumeKey = (endpoint: string, file: File) =>
  `naisema-upload:${endpoint}:${file.name}:${file.size}:${file.lastModified}`;

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

  const endpoint = options.endpoint ?? "/admin/media/uploads";
  const declared = checkDeclared(file, options.purpose ?? "media");
  if (!declared.ok) return { ok: false, error: declared.error };
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const content = checkContent(declared.type, head);
  if (!content.ok) return { ok: false, error: content.error };
  // A video master over 15 minutes is refused before it is sent (docs/decision-log.md).
  if ((options.purpose ?? "media") === "media" && kindOf(declared.type) === "video") {
    const duration = await (options.readDuration ?? browserDuration)(file);
    const problem = duration === null ? null : lengthProblem(duration);
    if (problem) return { ok: false, error: problem };
  }

  try {
    let upload: { id: string; partSize: number; partCount: number; received: number[] } | null = null;
    const earlier = storage.getItem(resumeKey(endpoint, file));
    if (earlier) {
      const response = await send(`${endpoint}/${earlier}`);
      const status = response.ok
        ? ((await response.json()) as { status: string; partSize: number; partCount: number; received: number[] })
        : null;
      if (status?.status === "uploading") upload = { id: earlier, ...status };
      else storage.removeItem(resumeKey(endpoint, file));
    }
    if (!upload) {
      const response = await send(endpoint, {
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
      storage.setItem(resumeKey(endpoint, file), started.id);
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
        const response = await send(`${endpoint}/${id}/parts/${part}`, { method: "PUT", body: bytes }).catch(
          () => null,
        );
        if (response?.ok) break;
        // A refusal (4xx) is final; a lost connection or server error is worth another try.
        if (response && response.status < 500 && response.status !== 408 && response.status !== 429) {
          storage.removeItem(resumeKey(endpoint, file));
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

    const done = await send(`${endpoint}/${id}`, { method: "POST" });
    if (!done.ok) throw new Refused(await errorOf(done));
    storage.removeItem(resumeKey(endpoint, file));
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, error: error.message };
    return { ok: false, error: "The upload stopped. Choose the same file again to carry on where it left off." };
  }
}
