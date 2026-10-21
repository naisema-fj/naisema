import { data } from "react-router";
import { BULK_KIND_NAMES, type BulkKind, type BulkOutcome, isKind, readBulkForm, summarise } from "~/lib/bulk-actions";
import { runBulk } from "~/lib/bulk-actions.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import type { Route } from "./+types/bulk";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Bulk action · NAISEMA staff" }];
}

const BACK: Record<BulkKind, string> = { content: "/admin/articles", layer: "/admin/learning-layers" };

/**
 * Only the gate: the lists post here, and a post's result is rendered by this page after the
 * action, so the loader must not send anyone away.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  await requireEditor(context.get(cloudflareContext).env, request);
  return null;
}

/**
 * POST /admin/bulk — assigns a reviewer to, withdraws or archives the chosen Content Items or
 * Learning Layers. Editors only; each item is then checked and changed on its own as that editor
 * (app/lib/bulk-actions.server.ts), and the result page lists what was done and what was skipped.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireEditor(env, request);
  const form = await request.formData();
  const read = readBulkForm(form);
  const asked = String(form.get("kind"));
  const kind = isKind(asked) ? asked : "content";
  if (!read.ok) return data({ error: read.error, back: BACK[kind] }, { status: 400 });
  const { request: bulk } = read;
  const outcomes = await runBulk(env, db, actor, bulk);
  return {
    summary: summarise(bulk.action, bulk.kind, outcomes),
    outcomes,
    kind: bulk.kind,
    back: BACK[bulk.kind],
    reason: bulk.action === "assign" ? null : bulk.reason,
    action: bulk.action,
  };
}

export default function Bulk({ actionData }: Route.ComponentProps) {
  if (!actionData) {
    return (
      <main id="main" className="page">
        <h1>Bulk actions</h1>
        <p>
          Choose items on <a href="/admin/articles">the content list</a> or{" "}
          <a href="/admin/learning-layers">the Learning Layers list</a>, then use the actions under the list.
        </p>
      </main>
    );
  }
  if ("error" in actionData) {
    return (
      <main id="main" className="page">
        <h1>Nothing was changed</h1>
        <p role="alert">{actionData.error}</p>
        <p>
          <a href={actionData.back}>Go back to the list</a> and try again.
        </p>
      </main>
    );
  }
  const { summary, outcomes, kind, back, reason, action } = actionData;
  const skipped = outcomes.filter((outcome: BulkOutcome) => !outcome.ok);
  return (
    <main id="main" className="page page-wide">
      <p>
        <a href={back}>Back to the list</a>
      </p>
      <h1>Result</h1>
      <p role="status" id="outcome">
        {summary}
      </p>
      {reason && <p>The reason given, kept in the audit log for each one: “{reason}”</p>}
      {skipped.length > 0 && (
        <p>
          {skipped.length === 1 ? "One was" : `${skipped.length} were`} not{" "}
          {action === "assign" ? "assigned" : action === "withdraw" ? "withdrawn" : "archived"}. Nothing else was
          changed for {skipped.length === 1 ? "it" : "them"}.
        </p>
      )}
      <h2 id="results-heading">What happened to each {BULK_KIND_NAMES[kind].one}</h2>
      <ol className="item-list" aria-labelledby="results-heading">
        {outcomes.map((outcome: BulkOutcome) => (
          <li key={outcome.id}>
            <strong>{outcome.title}</strong>
            <span className="meta">
              {outcome.ok ? "Done" : "Skipped"}: {outcome.text}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
