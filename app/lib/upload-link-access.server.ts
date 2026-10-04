import { getDb } from "./db.server";
import { linkOwnsAsset, openUploadLink } from "./submissions.server";

/**
 * The gate for a contributor's upload link (app/lib/submissions.server.ts): the token must open a
 * link that still works. Uploads through it are made on behalf of the editor who sent it, and
 * only the link's own uploads can be resumed or finished through it.
 */
export async function requireUploadLink(env: Env, token: string) {
  const db = getDb(env.DB);
  const opened = await openUploadLink(db, token);
  if (!opened) {
    throw Response.json(
      { error: "This upload link has expired or been used. Reply to our email for a new one." },
      { status: 410 },
    );
  }
  return { db, link: opened.link, name: opened.name };
}

/** The gate for one of a link's own uploads. */
export async function requireUploadLinkAsset(env: Env, token: string, assetId: string) {
  const access = await requireUploadLink(env, token);
  if (!(await linkOwnsAsset(access.db, access.link.id, assetId))) {
    throw Response.json({ error: "That upload doesn't exist." }, { status: 404 });
  }
  return access;
}
