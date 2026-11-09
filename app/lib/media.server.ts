import { and, desc, eq } from "drizzle-orm";
import { media, rightsRecord } from "~db/schema";
import { audit } from "./audit.server";
import { parseRange } from "./byte-range";
import { fijiToday } from "./calendar";
import { Refused } from "./content.server";
import type { Database } from "./db.server";
import { checkContent, checkDeclared, HEAD_BYTES, kindOf, storedName, type UploadPurpose } from "./media-rules";
import { isCurrent } from "./rights-rules";
import { can, type Staff } from "./roles";

/**
 * The media library: files staff upload straight to the one R2 bucket (ADR-0015), and their
 * delivery. A file is delivered publicly only while a Rights Record of its own grants Publish,
 * decided on every request, so withdrawing it stops it at once.
 */

export type MediaRow = typeof media.$inferSelect;

/**
 * Stores one uploaded file, sent as the request body. The name and declared type are checked
 * first, then the stored file's first bytes; a file that fails is deleted again.
 */
export async function uploadFile(
  env: Env,
  db: Database,
  actor: Staff,
  request: Request,
  purpose: UploadPurpose,
  facts: { name: string; alt?: string; width?: number; height?: number; durationMs?: number },
) {
  if (!can(actor, purpose === "evidence" ? "rights.manage" : "media.upload")) {
    throw new Refused("Your roles don't allow uploading.", 403);
  }
  const size = Number(request.headers.get("Content-Length") ?? "0");
  const declared = checkDeclared(
    { name: facts.name, type: request.headers.get("Content-Type") ?? "", size },
    purpose,
  );
  if (!declared.ok) throw new Refused(declared.error, 415);
  if (!request.body) throw new Refused("That file is empty.");
  const id = crypto.randomUUID();
  const key = `${purpose === "evidence" ? "evidence" : "media"}/${id}`;
  await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: declared.type } });
  const head = await env.MEDIA.get(key, { range: { offset: 0, length: HEAD_BYTES } });
  const bytes = head ? new Uint8Array(await head.arrayBuffer()) : new Uint8Array();
  const content = checkContent(declared.type, bytes);
  if (!content.ok) {
    await env.MEDIA.delete(key);
    throw new Refused(content.error, 415);
  }
  if (purpose === "evidence") return { id, key };
  const kind = kindOf(declared.type);
  const positive = (value: number | undefined) =>
    value && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  await db.batch([
    db.insert(media).values({
      id,
      kind,
      key,
      contentType: declared.type,
      bytes: size,
      filename: storedName(facts.name),
      alt: (facts.alt ?? "").trim().slice(0, 500),
      width: positive(facts.width),
      height: positive(facts.height),
      durationMs: positive(facts.durationMs),
      uploadedBy: actor.email,
    }),
    audit(db, actor.email, "media.uploaded", { type: "media", id }, { kind }),
  ]);
  return { id, key };
}

export const listMedia = (db: Database, kind?: MediaRow["kind"]) =>
  db
    .select()
    .from(media)
    .where(kind ? eq(media.kind, kind) : undefined)
    .orderBy(desc(media.createdAt))
    .limit(500);

/** Whether a media file may be shown on the public site today: a current record of its own grants Publish. */
export async function mediaIsPublic(db: Database, mediaId: string) {
  const records = await db
    .select()
    .from(rightsRecord)
    .where(and(eq(rightsRecord.subjectType, "media"), eq(rightsRecord.subjectId, mediaId)));
  const today = fijiToday();
  return records.some((record) => isCurrent(record, today) && record.permittedUses.includes("publish"));
}

/**
 * A stored file as a response, honouring a byte range so audio and video can seek. Never cached
 * by shared caches, so a withdrawal stops it on the next request.
 */
export async function serveObject(env: Env, request: Request, key: string, contentType: string, download?: string) {
  const head = await env.MEDIA.head(key);
  if (!head) return new Response("Not found", { status: 404 });
  const range = parseRange(request.headers.get("Range"), head.size);
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  if (download) headers.set("Content-Disposition", `attachment; filename="${download}"`);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${head.size}`);
    return new Response(null, { status: 416, headers });
  }
  const object = await env.MEDIA.get(key, range ? { range } : undefined);
  if (!object) return new Response("Not found", { status: 404 });
  if (range) {
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
    headers.set("Content-Length", String(range.length));
    return new Response(request.method === "HEAD" ? null : object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(head.size));
  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

/**
 * Keeps a Rights Record's evidence file privately under `evidence/`, after the same type and
 * content checks as any upload. Evidence is small, so it arrives in an ordinary form.
 */
export async function storeEvidence(env: Env, actor: Staff, file: File) {
  if (!can(actor, "rights.manage")) throw new Refused("Only editors record rights.", 403);
  const declared = checkDeclared({ name: file.name, type: file.type, size: file.size }, "evidence");
  if (!declared.ok) throw new Refused(declared.error, 415);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const content = checkContent(declared.type, bytes.subarray(0, HEAD_BYTES));
  if (!content.ok) throw new Refused(content.error, 415);
  const key = `evidence/${crypto.randomUUID()}`;
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: declared.type },
    customMetadata: { filename: storedName(file.name) },
  });
  return key;
}
