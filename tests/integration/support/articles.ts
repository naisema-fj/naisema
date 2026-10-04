/** Helpers for tests that write, review and publish articles through the admin site. */
import { env } from "cloudflare:test";
import { expect } from "vitest";
import type { RoleAssignment } from "~/lib/permissions";
import { recordRights } from "./rights";
import { signedInStaff } from "./staff";

export type Staff = Awaited<ReturnType<typeof signedInStaff>>;

let counter = 0;
export const unique = (name: string) => `${name}-${++counter}-${crypto.randomUUID().slice(0, 8)}@naisema.test`;
export const staff = (name: string, ...roles: RoleAssignment[]) => signedInStaff(unique(name), roles);
export const languageFlag = { flag: "languageInstruction", languageVariety: "standard-fijian" };
export const languageReviewerRole = {
  role: "reviewer",
  reviewType: "language",
  languageVariety: "standard-fijian",
} as const;

export const body = (text: string) =>
  JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

export async function topic(editor: Staff) {
  const name = `Topic ${crypto.randomUUID()}`;
  await editor.browser.fetch("/admin/topics", { form: { name } });
  const row = await env.DB.prepare("SELECT id FROM topic WHERE name = ?1").bind(name).first<{ id: string }>();
  return row?.id as string;
}

export function articleForm(topicId: string, fields: Record<string, string | string[]> = {}) {
  const flagged = ([] as string[]).concat(fields.flag ?? []);
  const form = new URLSearchParams({
    ...(flagged.includes("historicalClaims") && !("sources" in fields) ? { sources: "Oral history from Sera" } : {}),
    title: "Vosa vakaviti",
    summary: "Greetings.",
    primaryArea: "learn",
    credit: "Words by Sera",
    body: body("Bula vinaka."),
    topicId,
  });
  for (const [name, value] of Object.entries(fields)) {
    form.delete(name);
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
  }
  return form;
}

export function post(who: Staff, path: string, form: URLSearchParams) {
  return who.browser.fetch(path, {
    method: "POST",
    body: form,
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: "http://admin.localhost" },
  });
}

export async function createArticle(editor: Staff, fields: Record<string, string | string[]> = {}) {
  const topicId = await topic(editor);
  const response = await post(editor, "/admin/articles/new", articleForm(topicId, fields));
  const id = response.headers.get("Location")?.split("/").at(-1);
  if (!id) throw new Error(`Article not created (${response.status}): ${await response.text()}`);
  return { id, topicId };
}

export async function currentRevision(articleId: string) {
  return (await env.DB.prepare(
    "SELECT r.id, r.number FROM content_item c JOIN revision r ON r.id = c.current_draft_revision_id WHERE c.id = ?1",
  )
    .bind(articleId)
    .first<{ id: string; number: number }>()) as { id: string; number: number };
}

export async function saveNewRevision(editor: Staff, article: { id: string; topicId: string }, fields = {}) {
  const base = await currentRevision(article.id);
  const response = await post(
    editor,
    `/admin/articles/${article.id}`,
    articleForm(article.topicId, { baseRevisionId: base.id, ...fields }),
  );
  expect(response.status, await response.clone().text()).toBe(302);
  return currentRevision(article.id);
}

export function act(who: Staff, articleId: string, number: number, fields: Record<string, string>) {
  return who.browser.fetch(`/admin/articles/${articleId}/revisions/${number}`, { form: fields });
}

export async function publication(articleId: string) {
  return env.DB.prepare(
    `SELECT c.publication_state AS state, r.number AS publishedNumber
       FROM content_item c LEFT JOIN revision r ON r.id = c.current_published_revision_id WHERE c.id = ?1`,
  )
    .bind(articleId)
    .first<{ state: string; publishedNumber: number | null }>();
}

export async function approvals(revisionId: string) {
  const { results } = await env.DB.prepare(
    "SELECT review_type AS reviewType, decision, carried_forward_from_id AS carriedFrom FROM review_approval WHERE revision_id = ?1 ORDER BY review_type",
  )
    .bind(revisionId)
    .all<{ reviewType: string; decision: string; carriedFrom: string | null }>();
  return results;
}

/** An editor writes a flagged article with a current Rights Record granting Publish, assigns reviewers, and submits it. */
export async function submittedArticle(
  flags: string[],
  reviewers: { reviewType: string; reviewer: Staff }[] = [],
  { rights = true } = {},
) {
  const editor = await staff("editor", { role: "editor" });
  const article = await createArticle(editor, {
    flag: flags,
    languageVariety: flags.includes("languageInstruction") ? "standard-fijian" : "",
  });
  if (rights) expect((await recordRights(editor.browser, article.id)).status).toBe(302);
  for (const { reviewType, reviewer } of reviewers) {
    const assigned = await act(editor, article.id, 1, { intent: "assign", reviewType, reviewerId: reviewer.userId });
    expect(assigned.status, await assigned.clone().text()).toBe(302);
  }
  expect((await act(editor, article.id, 1, { intent: "submit" })).status).toBe(302);
  return { editor, article };
}

export const approve = (reviewer: Staff, articleId: string, number: number, reviewType: string) =>
  act(reviewer, articleId, number, { intent: "decide", reviewType, decision: "approved", scope: "All the Fijian" });
