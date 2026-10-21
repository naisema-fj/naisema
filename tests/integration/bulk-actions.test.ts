import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  act,
  createArticle,
  languageFlag,
  languageReviewerRole,
  post,
  publication,
  type Staff,
  staff,
  unique,
} from "./support/articles";
import { act as actOnLayer, approvedLayer, authoredLayer, layerRow } from "./support/layers";
import { recordRights } from "./support/rights";
import { auditActionsAbout } from "./support/staff";

/** Bulk actions on content lists and queues (BO-07): each item is checked and changed on its own. */

// React puts a comment between text and the values inside it; the reader never sees them.
const plain = (html: string) => html.replaceAll("<!-- -->", "").replaceAll("&#x27;", "'");
const main = (html: string) => plain(html).slice(plain(html).indexOf("<main"));

const bulk = (who: Staff, fields: [string, string][]) => post(who, "/admin/bulk", new URLSearchParams(fields));
const ids = (kind: string, intent: string, chosen: string[], more: [string, string][] = []): [string, string][] => [
  ["kind", kind],
  ["intent", intent],
  ...chosen.map((id): [string, string] => ["id", id]),
  ...more,
];

/** An article the editor has written, with a Rights Record, submitted and (if asked) published. */
async function article(
  editor: Staff,
  title: string,
  { publish = false, fields = {} as Record<string, string | string[]> } = {},
) {
  const { id } = await createArticle(editor, { title, ...fields });
  expect((await recordRights(editor.browser, id)).status).toBe(302);
  expect((await act(editor, id, 1, { intent: "submit" })).status).toBe(302);
  if (publish) expect((await act(editor, id, 1, { intent: "publish" })).status).toBe(302);
  return id;
}

const auditDetails = async (objectId: string, action: string) =>
  (
    await env.DB.prepare("SELECT details FROM audit_event WHERE object_id = ?1 AND action = ?2")
      .bind(objectId, action)
      .all<{ details: string | null }>()
  ).results.map((row) => JSON.parse(row.details ?? "null"));

const searchEntries = async (itemId: string) =>
  (
    (await env.DB.prepare("SELECT count(*) AS n FROM search_entry WHERE content_item_id = ?1")
      .bind(itemId)
      .first<{ n: number }>()) as { n: number }
  ).n;

describe("withdrawing several Content Items", () => {
  it("withdraws each published item with the one reason, skips the rest and says why", async () => {
    const editor = await staff("editor", { role: "editor" });
    const first = await article(editor, "Yaqona one", { publish: true });
    const second = await article(editor, "Yaqona two", { publish: true });
    const draft = await article(editor, "Yaqona three");

    const response = await bulk(
      editor,
      ids("content", "withdraw", [first, draft, second], [["reason", "Out of date"]]),
    );

    expect(response.status).toBe(200);
    const page = main(await response.text());
    expect(page).toContain("Withdrew 2 of 3 Content Items. 1 was skipped.");
    expect(page).toContain("Yaqona three");
    expect(page).toContain("Only published items can be withdrawn.");
    expect((await publication(first))?.state).toBe("withdrawn");
    expect((await publication(second))?.state).toBe("withdrawn");
    expect((await publication(draft))?.state).toBe("unpublished");
    // Audited for each item, with the reason; not for the skipped one.
    expect(await auditDetails(first, "content_item.withdrawn")).toEqual([{ reason: "Out of date" }]);
    expect(await auditDetails(second, "content_item.withdrawn")).toEqual([{ reason: "Out of date" }]);
    expect(await auditDetails(draft, "content_item.withdrawn")).toEqual([]);
  }, 30_000);

  it("brings the public site up to date for every withdrawn item, as a single withdrawal does", async () => {
    const editor = await staff("editor", { role: "editor" });
    const first = await article(editor, "Searchable one", { publish: true });
    const second = await article(editor, "Searchable two", { publish: true });
    expect([await searchEntries(first), await searchEntries(second)]).toEqual([1, 1]);

    await bulk(editor, ids("content", "withdraw", [first, second], [["reason", "Rights concern"]]));

    expect([await searchEntries(first), await searchEntries(second)]).toEqual([0, 0]);
  }, 30_000);

  it("reports an item that no longer exists and carries on with the others", async () => {
    const editor = await staff("editor", { role: "editor" });
    const real = await article(editor, "Still here", { publish: true });

    const response = await bulk(editor, ids("content", "withdraw", ["no-such-item", real], [["reason", "Tidy"]]));

    const page = main(await response.text());
    expect(page).toContain("Withdrew 1 of 2 Content Items. 1 was skipped.");
    expect(page).toContain("no longer exists");
    expect((await publication(real))?.state).toBe("withdrawn");
  }, 30_000);
});

describe("archiving several Content Items", () => {
  it("archives those that aren't published and skips a published or already archived one", async () => {
    const editor = await staff("editor", { role: "editor" });
    const draft = await article(editor, "Draft to retire");
    const live = await article(editor, "Still live", { publish: true });
    const retired = await article(editor, "Already retired");
    await bulk(editor, ids("content", "archive", [retired], [["reason", "First pass"]]));

    const response = await bulk(editor, ids("content", "archive", [draft, live, retired], [["reason", "Season over"]]));

    const page = main(await response.text());
    expect(page).toContain("Archived 1 of 3 Content Items. 2 were skipped.");
    expect(page).toContain("Withdraw the item before archiving it.");
    expect(page).toContain("This item is already archived.");
    expect((await publication(draft))?.state).toBe("archived");
    expect((await publication(live))?.state).toBe("published");
    expect(await auditDetails(draft, "content_item.archived")).toEqual([{ reason: "Season over" }]);
  }, 30_000);
});

describe("assigning a reviewer to several Content Items", () => {
  it("assigns the reviewer to each item that needs that review and lists the ones that could not be assigned", async () => {
    const editor = await staff("editor", { role: "editor" });
    const reviewer = await staff("reviewer", languageReviewerRole);
    const needsLanguage = await article(editor, "Needs language", { fields: languageFlag });
    const alsoNeedsLanguage = await article(editor, "Also needs language", { fields: languageFlag });
    const plainItem = await article(editor, "Needs none");
    const alreadyAssigned = await article(editor, "Has a reviewer", { fields: languageFlag });
    await act(editor, alreadyAssigned, 1, { intent: "assign", reviewType: "language", reviewerId: reviewer.userId });

    const response = await bulk(
      editor,
      ids(
        "content",
        "assign",
        [needsLanguage, plainItem, alsoNeedsLanguage, alreadyAssigned],
        [["reviewer", `language:${reviewer.userId}`]],
      ),
    );

    const page = main(await response.text());
    expect(page).toContain("Assigned the reviewer to 2 of 4 Content Items. 2 were skipped.");
    expect(page).toContain("Needs none");
    expect(page).toContain("doesn't need a language review");
    expect(page).toContain("That reviewer is already assigned.");
    const assigned = async (id: string) =>
      (
        await env.DB.prepare("SELECT reviewer_id AS reviewerId FROM review_assignment WHERE content_item_id = ?1")
          .bind(id)
          .all<{ reviewerId: string }>()
      ).results.map((row) => row.reviewerId);
    expect(await assigned(needsLanguage)).toEqual([reviewer.userId]);
    expect(await assigned(alsoNeedsLanguage)).toEqual([reviewer.userId]);
    expect(await assigned(plainItem)).toEqual([]);
    // Audited per item.
    expect(await auditActionsAbout(await assignmentId(needsLanguage))).toEqual(["review.assigned"]);
  }, 30_000);

  it("skips every item when the person chosen does not do that review", async () => {
    const editor = await staff("editor", { role: "editor" });
    const notAReviewer = await staff("somebody", { role: "editor" });
    const one = await article(editor, "Language one", { fields: languageFlag });

    const response = await bulk(
      editor,
      ids("content", "assign", [one], [["reviewer", `language:${notAReviewer.userId}`]]),
    );

    const page = main(await response.text());
    expect(page).toContain("The reviewer was not assigned to any of the 1 Content Item.");
    expect(page).toContain("Choose someone who does language review.");
    expect(
      (
        await env.DB.prepare("SELECT count(*) AS n FROM review_assignment WHERE content_item_id = ?1")
          .bind(one)
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
  }, 30_000);
});

async function assignmentId(itemId: string) {
  const row = await env.DB.prepare("SELECT id FROM review_assignment WHERE content_item_id = ?1")
    .bind(itemId)
    .first<{ id: string }>();
  return row?.id as string;
}

describe("who may use a bulk action, and what is never bulk", () => {
  it("refuses a person who may not withdraw, and changes nothing", async () => {
    const editor = await staff("editor", { role: "editor" });
    const reviewer = await staff("reviewer", languageReviewerRole);
    const item = await article(editor, "Not for reviewers", { publish: true });

    const response = await bulk(reviewer, ids("content", "withdraw", [item], [["reason", "Because"]]));

    expect(response.status).toBe(403);
    expect((await publication(item))?.state).toBe("published");
  }, 30_000);

  it("sends someone who is not signed in to sign in", async () => {
    const { Browser } = await import("./support/staff");
    const response = await post(
      { browser: new Browser() } as Staff,
      "/admin/bulk",
      new URLSearchParams(ids("content", "withdraw", ["x"], [["reason", "y"]])),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/admin/sign-in");
  });

  it("has no bulk publish: the item stays as it was", async () => {
    const editor = await staff("editor", { role: "editor" });
    const item = await article(editor, "Publish one at a time");

    const response = await bulk(editor, ids("content", "publish", [item]));

    expect(response.status).toBe(400);
    expect(main(await response.text())).toContain("Publishing can't be done in bulk");
    expect((await publication(item))?.state).toBe("unpublished");
  }, 30_000);

  it("asks for a reason and for a choice before it changes anything", async () => {
    const editor = await staff("editor", { role: "editor" });
    const item = await article(editor, "Needs a reason", { publish: true });

    const noReason = await bulk(editor, ids("content", "withdraw", [item], [["reason", " "]]));
    const nothingChosen = await bulk(editor, ids("content", "withdraw", [], [["reason", "Why"]]));

    expect(noReason.status).toBe(400);
    expect(main(await noReason.text())).toContain("Say why.");
    expect(nothingChosen.status).toBe(400);
    expect(main(await nothingChosen.text())).toContain("Choose at least one item.");
    expect((await publication(item))?.state).toBe("published");
  }, 30_000);
});

describe("bulk actions on Learning Layers", () => {
  it("withdraws the published ones with one reason and skips one that is not published", async () => {
    const live = await approvedLayer();
    expect((await actOnLayer(live.editor, live.layerId, live.number, { intent: "publish" })).status).toBe(302);
    const draft = await approvedLayer();

    const response = await bulk(
      live.editor,
      ids("layer", "withdraw", [live.layerId, draft.layerId], [["reason", "Re-recording the clip"]]),
    );

    expect(response.status).toBe(200);
    const page = main(await response.text());
    expect(page).toContain("Withdrew 1 of 2 Learning Layers. 1 was skipped.");
    expect(page).toContain("Only published Learning Layers can be withdrawn.");
    expect((await layerRow(live.layerId))?.state).toBe("withdrawn");
    expect((await layerRow(draft.layerId))?.state).toBe("unpublished");
    expect(await auditDetails(live.layerId, "learning_layer.withdrawn")).toEqual([{ reason: "Re-recording the clip" }]);
  }, 60_000);

  it("assigns a reviewer to a Learning Layer that needs that review", async () => {
    const layer = await authoredLayer();
    expect((await actOnLayer(layer.educator, layer.layerId, layer.number, { intent: "submit" })).status).toBe(302);

    const response = await bulk(
      layer.editor,
      ids("layer", "assign", [layer.layerId], [["reviewer", `language:${layer.reviewer.userId}`]]),
    );

    expect(main(await response.text())).toContain("Assigned the reviewer to 1 of 1 Learning Layer.");
    const rows = await env.DB.prepare(
      "SELECT reviewer_id AS id FROM learning_layer_review_assignment WHERE learning_layer_id = ?1",
    )
      .bind(layer.layerId)
      .all<{ id: string }>();
    expect(rows.results.map((row) => row.id)).toEqual([layer.reviewer.userId]);
  }, 60_000);

  it("skips a Learning Layer whose review is already approved", async () => {
    const layer = await approvedLayer();
    const other = await staff("other-reviewer", languageReviewerRole);

    const response = await bulk(
      layer.editor,
      ids("layer", "assign", [layer.layerId], [["reviewer", `language:${other.userId}`]]),
    );

    expect(main(await response.text())).toContain("The language review is already approved.");
  }, 60_000);
});

describe("choosing items on the lists", () => {
  it("offers a labelled checkbox for every item on the content list, and the three actions", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await article(editor, `Listed ${unique("t")}`);

    const page = main(await (await editor.browser.fetch("/admin/articles")).text());

    expect(page).toContain(`name="id" value="${id}"`);
    expect(page).toMatch(/<label[^>]*>Choose Listed/);
    expect(page).toContain('action="/admin/bulk"');
    expect(page).toContain('value="withdraw"');
    expect(page).toContain('value="archive"');
    expect(page).toContain('value="assign"');
    expect(page).not.toContain('value="publish"');
  }, 30_000);
});
