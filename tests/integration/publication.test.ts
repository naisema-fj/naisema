import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { changePublication } from "~/lib/publication.server";
import { loadReview } from "~/lib/review.server";
import { act, currentRevision, submittedArticle } from "./support/articles";

/** The publication module through its own interface: a change brings the public site up to date itself. */

const indexed = async (itemId: string) =>
  (
    (await env.DB.prepare("SELECT count(*) AS n FROM search_entry WHERE content_item_id = ?1")
      .bind(itemId)
      .first<{ n: number }>()) as { n: number }
  ).n;

describe("changing what is published", () => {
  it("rebuilds the search entry itself, whoever asks for the change", async () => {
    const { editor, article } = await submittedArticle([]);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
    expect(await indexed(article.id)).toBe(1);
    const db = getDb(env.DB);
    const review = await loadReview(db, (await currentRevision(article.id)).id);

    // Not through a route: any caller of the module gets the same upkeep.
    const result = await changePublication(
      env,
      db,
      { userId: editor.userId, roles: [{ role: "editor" }] },
      review as NonNullable<typeof review>,
      "withdraw",
    );

    expect(result).toEqual({ ok: true });
    expect(await indexed(article.id)).toBe(0);
  }, 20_000);

  it("leaves the public site alone when the change is refused", async () => {
    const { editor, article } = await submittedArticle([]);
    expect((await act(editor, article.id, 1, { intent: "publish" })).status).toBe(302);
    const db = getDb(env.DB);
    const review = await loadReview(db, (await currentRevision(article.id)).id);

    const result = await changePublication(
      env,
      db,
      { userId: editor.userId, roles: [] },
      review as NonNullable<typeof review>,
      "withdraw",
    );

    expect(result.ok).toBe(false);
    expect(await indexed(article.id)).toBe(1);
  }, 20_000);
});
