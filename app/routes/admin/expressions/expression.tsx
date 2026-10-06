import { data, Form, redirect } from "react-router";
import { ExpressionFields } from "~/components/expression-fields";
import { type ExpressionField, readExpressionDetails } from "~/lib/annotations";
import { cloudflareContext } from "~/lib/cloudflare";
import { canEditExpression, detailsOf, getExpression, updateExpression } from "~/lib/expressions.server";
import { requireLayerStaff } from "~/lib/learning-layers.server";
import type { Route } from "./+types/expression";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.expression.headword ?? "Expression"} · NAISEMA staff` }];
}

async function requireExpression(env: Env, request: Request, id: string) {
  const staff = await requireLayerStaff(env, request);
  const row = await getExpression(staff.db, id);
  if (!row) throw new Response("Not found", { status: 404 });
  return { ...staff, row };
}

/**
 * GET /admin/expressions/:id — one Expression. Editors and whoever added it can change it; each
 * Learning Layer that uses it shows the change when it is next saved, and is reviewed then.
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, actor, row } = await requireExpression(context.get(cloudflareContext).env, request, params.id);
  return {
    expression: detailsOf(row),
    canEdit: await canEditExpression(db, actor, row),
    saved: new URL(request.url).searchParams.has("saved"),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { db, actor, row } = await requireExpression(context.get(cloudflareContext).env, request, params.id);
  const refused = () => new Response("Only editors and whoever added an Expression can change it.", { status: 403 });
  // updateExpression audits a refused attempt; asking it first means one is never let through by a form error.
  if (!(await canEditExpression(db, actor, row)) && !(await updateExpression(db, actor, row, detailsOf(row)))) {
    throw refused();
  }
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  const read = readExpressionDetails({
    headword: field("headword"),
    generalMeaning: field("generalMeaning"),
    grammarNote: field("grammarNote"),
    pronunciation: field("pronunciation"),
    idiom: field("idiom") !== "",
    literalMeaning: field("literalMeaning"),
  });
  if (!read.ok)
    return data<{ errors: Partial<Record<ExpressionField, string>> }>({ errors: read.errors }, { status: 400 });
  if (!(await updateExpression(db, actor, row, read.details))) throw refused();
  return redirect(`/admin/expressions/${row.id}?saved`);
}

export default function ExpressionPage({ loaderData, actionData }: Route.ComponentProps) {
  const { expression } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/expressions">Back to Expressions</a>
      </p>
      <h1 lang="fj">{expression.headword}</h1>
      {loaderData.saved && (
        <p role="status">Saved. Learning Layers using it show the change when they are next saved.</p>
      )}
      {loaderData.canEdit ? (
        <Form method="post" className="article-form">
          <ExpressionFields idPrefix="expression" values={expression} errors={actionData?.errors ?? {}} />
          <button type="submit">Save the Expression</button>
        </Form>
      ) : (
        <dl className="video-facts">
          <dt>General meaning</dt>
          <dd>{expression.generalMeaning}</dd>
          {expression.literalMeaning && (
            <>
              <dt>Literally</dt>
              <dd>{expression.literalMeaning}</dd>
            </>
          )}
          <dt>Grammar note</dt>
          <dd>{expression.grammarNote || "None"}</dd>
          <dt>Pronunciation</dt>
          <dd>{expression.pronunciation || "None"}</dd>
        </dl>
      )}
    </main>
  );
}
