import { data, Form, Link, redirect } from "react-router";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import {
  approveExpression,
  ExpressionRefused,
  mayUseLibrary,
  readWording,
  saveExpression,
  staffExpression,
  suggestionDraft,
} from "~/lib/expressions.server";
import { formatDay } from "~/lib/rights-rules";
import { can } from "~/lib/roles";
import { requireStaff } from "~/lib/staff.server";
import { approvalRefusal, EXPRESSION_KIND_NAMES, EXPRESSION_KINDS, VOSA_THEMES, vosaPath } from "~/lib/vosa";
import { wordingOf } from "~/lib/vosa.server";
import type { Route } from "./+types/expression";

/**
 * /admin/expressions/:id and /admin/expressions/new: one Expression's wording, which editors
 * change and a Language Reviewer approves (ADR-0017). A new one can start from a "suggest a word"
 * Submission (`?submission=`).
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const person = await requireStaff(env, request);
  if (!mayUseLibrary(person)) throw new Response("Your roles don't allow this page.", { status: 403 });
  const db = getDb(env.DB);
  const mayEdit = can(person, "content.edit");
  const search = new URL(request.url).searchParams;
  const notice = search.get("approved")
    ? "approved"
    : search.get("saved") === "1"
      ? "saved"
      : search.get("saved") === "0"
        ? "unchanged"
        : null;
  if (!params.id) {
    if (!mayEdit) throw new Response("Your roles don't allow this page.", { status: 403 });
    const submissionId = search.get("submission");
    const draft = submissionId && can(person, "submissions.read") ? await suggestionDraft(db, submissionId) : null;
    return { found: null, draft, mayEdit, approvalRefusal: null, notice };
  }
  const found = await staffExpression(db, params.id);
  if (!found) throw new Response("Not found", { status: 404 });
  return {
    found: { ...found, wording: wordingOf(found.row) },
    draft: null,
    mayEdit,
    notice,
    approvalRefusal: approvalRefusal(
      {
        email: person.email,
        mayReviewLanguage: can(person, "review.language"),
        languageVariety: person.languageVariety,
      },
      { variety: found.row.variety, updatedBy: found.row.updatedBy },
    ),
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const db = getDb(env.DB);
  const form = await request.formData();
  try {
    if (form.get("intent") === "approve" && params.id) {
      await approveExpression(db, actor, params.id, String(form.get("fingerprint") ?? ""));
      return redirect(`/admin/expressions/${params.id}?approved=1`);
    }
    const current = params.id ? await staffExpression(db, params.id) : null;
    if (params.id && !current) throw new ExpressionRefused("That Expression doesn't exist.", 404);
    const wording = readWording(form, current ? wordingOf(current.row) : null);
    const submissionId = String(form.get("submission") ?? "") || undefined;
    const saved = await saveExpression(db, actor, params.id ?? null, wording, { submissionId });
    return redirect(`/admin/expressions/${saved.id}?saved=${saved.changed ? 1 : 0}`);
  } catch (error) {
    if (error instanceof ExpressionRefused) return data({ error: error.message }, { status: error.status });
    throw error;
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.found?.row.headword ?? "New Expression"} · Expressions · NAISEMA staff` }];
}

export default function ExpressionPage({ loaderData, actionData }: Route.ComponentProps) {
  const { found, draft, mayEdit, approvalRefusal: refusal, notice } = loaderData;
  const wording = found?.wording;
  const details = wording?.details ?? {};
  const example = details.usageExamples?.[0];
  return (
    <main id="main" className="page">
      <p>
        <Link to="/admin/expressions">All Expressions</Link>
      </p>
      <h1 lang="fj">{wording?.headword ?? "New Expression"}</h1>
      {actionData?.error && (
        <p role="alert" className="error">
          {actionData.error}
        </p>
      )}
      {notice === "approved" && <p role="status">Approved. Vosa now shows it as reviewed.</p>}
      {notice === "saved" && <p role="status">Saved. Its wording changed, so it is a draft until it is approved.</p>}
      {notice === "unchanged" && <p role="status">Nothing changed.</p>}

      {found && (
        <section aria-labelledby="review-heading">
          <h2 id="review-heading">Review</h2>
          {found.approval ? (
            <p>
              Reviewed: {found.approval.reviewerEmail} approved this wording on{" "}
              {formatDay(new Date(found.approval.createdAt))}.
            </p>
          ) : (
            <p>
              A draft.{" "}
              {found.reviews.length
                ? "An earlier wording was approved, but it has changed since."
                : "Not yet approved."}
            </p>
          )}
          {!found.approval &&
            (refusal ? (
              <p>{refusal}</p>
            ) : (
              <Form method="post">
                <input type="hidden" name="intent" value="approve" />
                <input type="hidden" name="fingerprint" value={found.fingerprint} />
                <button type="submit">Approve this wording</button>
              </Form>
            ))}
          <p>
            Last changed by {found.row.updatedBy || found.row.createdBy}. On Vosa:{" "}
            <a href={vosaPath(found.row.headword)}>{vosaPath(found.row.headword)}</a>
          </p>
          {details.appsSite && (
            <WhatsThis summary="Its record from the apps site">
              <p>
                {details.appsSite.englishChecked ? "Its English meaning had been checked there. " : ""}
                State there: {details.appsSite.status || "not recorded"}.
              </p>
              {details.appsSite.notes && <p>Notes: {details.appsSite.notes}</p>}
            </WhatsThis>
          )}
        </section>
      )}

      {mayEdit && (
        <Form method="post" aria-labelledby="wording-heading" className="expression-form">
          <h2 id="wording-heading">Wording</h2>
          {draft && <input type="hidden" name="submission" value={draft.submissionId} />}
          <label htmlFor="headword">Word, phrase or saying</label>
          <input
            id="headword"
            name="headword"
            required
            maxLength={250}
            defaultValue={wording?.headword ?? draft?.headword}
            lang="fj"
          />
          <label htmlFor="kind">Kind</label>
          <select id="kind" name="kind" defaultValue={wording?.kind ?? "word"}>
            {EXPRESSION_KINDS.map((value) => (
              <option key={value} value={value}>
                {EXPRESSION_KIND_NAMES[value]}
              </option>
            ))}
          </select>
          <label htmlFor="partOfSpeech">Part of speech, or kind of saying</label>
          <input id="partOfSpeech" name="partOfSpeech" maxLength={100} defaultValue={wording?.partOfSpeech} />
          <label htmlFor="generalMeaning">Meaning in English</label>
          <textarea
            id="generalMeaning"
            name="generalMeaning"
            rows={3}
            maxLength={2000}
            defaultValue={wording?.generalMeaning ?? draft?.generalMeaning}
          />
          <label htmlFor="literalMeaning">Word for word (for a saying or idiom)</label>
          <textarea
            id="literalMeaning"
            name="literalMeaning"
            rows={2}
            maxLength={1000}
            defaultValue={wording?.literalMeaning}
          />
          <label htmlFor="grammarNote">How it works (grammar)</label>
          <textarea id="grammarNote" name="grammarNote" rows={3} maxLength={4000} defaultValue={wording?.grammarNote} />
          <label htmlFor="exampleFijian">Example in Fijian</label>
          <input id="exampleFijian" name="exampleFijian" maxLength={500} defaultValue={example?.fijian} lang="fj" />
          <label htmlFor="exampleEnglish">The example in English</label>
          <input id="exampleEnglish" name="exampleEnglish" maxLength={500} defaultValue={example?.english} />
          <label htmlFor="comparison">How it compares with other words</label>
          <textarea id="comparison" name="comparison" rows={2} maxLength={1500} defaultValue={details.comparison} />
          <label htmlFor="learnerComment">A note for learners</label>
          <textarea
            id="learnerComment"
            name="learnerComment"
            rows={2}
            maxLength={1000}
            defaultValue={details.learnerComment}
          />
          <label htmlFor="notes">Note on its meaning or use</label>
          <textarea id="notes" name="notes" rows={2} maxLength={2000} defaultValue={wording?.notes} />
          <label htmlFor="pronunciation">Pronunciation guidance</label>
          <input id="pronunciation" name="pronunciation" maxLength={500} defaultValue={wording?.pronunciation} />
          <label htmlFor="relatedWords">Related Fijian words (separated by commas)</label>
          <input
            id="relatedWords"
            name="relatedWords"
            maxLength={1000}
            defaultValue={details.relatedWords?.join(", ")}
            lang="fj"
          />
          <label htmlFor="searchKeywords">Other English words people might search for (separated by commas)</label>
          <input
            id="searchKeywords"
            name="searchKeywords"
            maxLength={1000}
            defaultValue={details.searchKeywords?.join(", ")}
          />
          <fieldset>
            <legend>Themes</legend>
            {VOSA_THEMES.map((theme) => (
              <label key={theme.id} className="choice">
                <input
                  type="checkbox"
                  name="themes"
                  value={theme.id}
                  defaultChecked={wording?.themes.includes(theme.id)}
                />{" "}
                {theme.title}
              </label>
            ))}
          </fieldset>
          <p>
            Its sources, tables, phrase roles and quiz come from Vosa and stay as they are. A change to any wording
            above makes it a draft until a Language Reviewer approves it again.
          </p>
          <button type="submit">{found ? "Save the wording" : "Add the Expression"}</button>
        </Form>
      )}

      {found && found.reviews.length > 0 && (
        <section aria-labelledby="history-heading">
          <h2 id="history-heading">Approvals</h2>
          <ul>
            {found.reviews.map((review) => (
              <li key={review.id}>
                {formatDay(new Date(review.createdAt))}, {review.reviewerEmail}
                {review.fingerprint === found.fingerprint ? " (this wording)" : " (an earlier wording)"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
