import { Form, Link } from "react-router";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { mayUseLibrary, type ReviewFilter, staffList } from "~/lib/expressions.server";
import { can } from "~/lib/roles";
import { requireStaff } from "~/lib/staff.server";
import { EXPRESSION_KIND_NAMES, EXPRESSION_KINDS, isExpressionKind } from "~/lib/vosa";
import type { Route } from "./+types/expressions";

const STATES: Record<ReviewFilter, string> = {
  all: "Drafts and reviewed",
  draft: "Drafts only",
  reviewed: "Reviewed only",
};

/** /admin/expressions: the Standard Fijian Expression library that Vosa shows (change note 0002). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const person = await requireStaff(env, request);
  if (!mayUseLibrary(person)) throw new Response("Your roles don't allow this page.", { status: 403 });
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const kindParam = url.searchParams.get("kind") ?? "";
  const stateParam = url.searchParams.get("state") ?? "all";
  const state: ReviewFilter = stateParam === "draft" || stateParam === "reviewed" ? stateParam : "all";
  const listing = await staffList(getDb(env.DB), {
    q,
    kind: isExpressionKind(kindParam) ? kindParam : null,
    state,
    page: Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
  });
  return { q, kind: kindParam, state, listing, mayEdit: can(person, "content.edit") };
}

export function meta() {
  return [{ title: "Expressions · NAISEMA staff" }];
}

export default function Expressions({ loaderData }: Route.ComponentProps) {
  const { q, kind, state, listing, mayEdit } = loaderData;
  const pageLink = (page: number) => {
    const search = new URLSearchParams({ q, kind, state, page: String(page) });
    return `/admin/expressions?${search}`;
  };
  return (
    <main id="main" className="page">
      <h1>Expressions</h1>
      <WhatsThis summary="What are Expressions?">
        <p>
          The Standard Fijian word library. Vosa, the public dictionary at /vosa, shows every Expression, and Learning
          Layers link their words to it. An Expression is a draft until a Language Reviewer approves its exact wording.
          Changing the wording makes it a draft again, until it is approved again.
        </p>
      </WhatsThis>
      <p>
        {listing.reviewed.toLocaleString("en")} reviewed.{" "}
        {mayEdit && <Link to="/admin/expressions/new">Add an Expression</Link>}
      </p>
      <Form method="get" className="filters">
        <label htmlFor="q">Search</label>
        <input id="q" name="q" type="search" defaultValue={q} />
        <label htmlFor="kind">Kind</label>
        <select id="kind" name="kind" defaultValue={kind}>
          <option value="">All kinds</option>
          {EXPRESSION_KINDS.map((value) => (
            <option key={value} value={value}>
              {EXPRESSION_KIND_NAMES[value]}
            </option>
          ))}
        </select>
        <label htmlFor="state">Review</label>
        <select id="state" name="state" defaultValue={state}>
          {Object.entries(STATES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit">Show</button>
      </Form>
      <p aria-live="polite">
        {listing.total.toLocaleString("en")} {listing.total === 1 ? "Expression" : "Expressions"}
        {listing.pages > 1 && `, page ${listing.page} of ${listing.pages}`}
      </p>
      <ul className="expression-list">
        {listing.rows.map((row) => (
          <li key={row.id}>
            <Link to={`/admin/expressions/${row.id}`} lang="fj">
              {row.headword}
            </Link>{" "}
            · {EXPRESSION_KIND_NAMES[row.kind]} · {row.approval ? "Reviewed" : "Draft"}
            <br />
            {row.generalMeaning || "No meaning yet."}
          </li>
        ))}
      </ul>
      {listing.pages > 1 && (
        <nav aria-label="Pages">
          {listing.page > 1 && <Link to={pageLink(listing.page - 1)}>Previous page</Link>}{" "}
          {listing.page < listing.pages && <Link to={pageLink(listing.page + 1)}>Next page</Link>}
        </nav>
      )}
    </main>
  );
}
