import { data, Form, redirect } from "react-router";
import { getArticle } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireRightsManager } from "~/lib/content.server";
import { listContributors } from "~/lib/contributors.server";
import { publicItemChanged } from "~/lib/public-change.server";
import { listRights, readRightsForm, recordRights, withdrawRights } from "~/lib/rights.server";
import { PERMITTED_USE_NAMES } from "~/lib/rights-names";
import { EVIDENCE_MAX_BYTES, formatDay, PERMITTED_USES } from "~/lib/rights-rules";
import { readLimitedFormData, UploadTooLarge } from "~/lib/upload-limit.server";
import type { Route } from "./+types/rights";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Rights for ${loaderData?.article.title ?? "article"} · Na iSema staff` }];
}

async function requireArticleRights(request: Request, env: Env, articleId: string) {
  const staff = await requireRightsManager(env, request);
  const article = await getArticle(staff.db, articleId);
  if (!article) throw new Response("Not found", { status: 404 });
  return { ...staff, article };
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, article } = await requireArticleRights(request, context.get(cloudflareContext).env, params.id);
  return {
    article: { id: article.id, title: article.currentRevision.snapshot.title },
    records: await listRights(db, { type: "content_item", id: article.id }),
    contributors: await listContributors(db),
    done: new URL(request.url).searchParams.get("done"),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, article } = await requireArticleRights(request, env, params.id);
  const subject = { type: "content_item", id: article.id } as const;
  let form: FormData;
  try {
    // The allowance over the evidence limit covers the form's other fields.
    form = await readLimitedFormData(request, EVIDENCE_MAX_BYTES + 64 * 1024);
  } catch (error) {
    if (!(error instanceof UploadTooLarge)) throw error;
    const errors = { evidence: "Evidence files can be at most 10 MB." };
    return data({ errors, values: null, withdraw: null }, { status: 413 });
  }

  if (form.get("intent") === "withdraw") {
    const result = await withdrawRights(
      db,
      actor.userId,
      subject,
      String(form.get("recordId") ?? ""),
      String(form.get("reason") ?? "").trim(),
    );
    if (!result.ok) {
      return data(
        { errors: {}, values: null, withdraw: { recordId: String(form.get("recordId")), error: result.error } },
        { status: 400 },
      );
    }
    // The item may have just become ineligible.
    await publicItemChanged(env, db, article);
    throw redirect(`/admin/articles/${article.id}/rights?done=withdrawn`);
  }

  const result = await readRightsForm(db, form);
  if (!result.ok) return data({ errors: result.errors, values: result.values, withdraw: null }, { status: 400 });
  await recordRights(env, db, actor.userId, subject, result.rights);
  // A new record can make a published item eligible again.
  await publicItemChanged(env, db, article);
  throw redirect(`/admin/articles/${article.id}/rights?done=recorded`);
}

const STATUS_NAMES = { current: "Current", expired: "Expired", withdrawn: "Withdrawn" } as const;

export default function Rights({ loaderData, actionData }: Route.ComponentProps) {
  const { article, records, contributors, done } = loaderData;
  const errors: Record<string, string> = actionData?.errors ?? {};
  const values = actionData?.values;
  const withdrawError = actionData?.withdraw;
  const fieldError = (field: string) =>
    errors[field] && (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    );
  const describedBy = (field: string) => (errors[field] ? `${field}-error` : undefined);

  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/articles/${article.id}`}>Back to {article.title}</a>
      </p>
      <h1>Rights Records: {article.title}</h1>
      {done === "recorded" && !actionData && <p role="status">Rights Record recorded.</p>}
      {done === "withdrawn" && !actionData && <p role="status">Rights Record withdrawn.</p>}
      {Object.keys(errors).length > 0 && <p role="alert">Nothing was saved. Fix the fields marked below.</p>}
      {withdrawError && !records.some((record) => record.id === withdrawError.recordId) && (
        <p role="alert">{withdrawError.error}</p>
      )}
      <p>
        An article can be published only while a current Rights Record grants Publish. Each Permitted Use is granted
        separately. Records are never edited: to correct one, withdraw it and record it again. Until the media library
        arrives, a Rights Record covers everything in the article, including its images.
      </p>

      {records.length === 0 ? (
        <p>No Rights Records yet.</p>
      ) : (
        <ul className="rights-list">
          {records.map((record) => (
            <li key={record.id}>
              <h2>{`${record.rightsHolder}: ${STATUS_NAMES[record.status]}`}</h2>
              <dl>
                <dt>Permitted Uses</dt>
                <dd>{record.permittedUses.map((use) => PERMITTED_USE_NAMES[use]).join(", ")}</dd>
                {record.guardianPermission && (
                  <>
                    <dt>Guardian permission</dt>
                    <dd>Yes, for the identifiable children shown</dd>
                  </>
                )}
                {record.contributors.length > 0 && (
                  <>
                    <dt>Contributors</dt>
                    <dd>{record.contributors.join(", ")}</dd>
                  </>
                )}
                <dt>Expires</dt>
                <dd>{record.expiresAt ? formatDay(record.expiresAt) : "Never"}</dd>
                <dt>Recorded</dt>
                <dd>
                  {formatDay(record.createdAt)} by {record.recordedBy}
                </dd>
                <dt>Evidence</dt>
                <dd>
                  <a href={`/admin/rights/${record.id}/evidence`}>Download {record.evidenceName}</a>
                </dd>
                {record.withdrawnAt && (
                  <>
                    <dt>Withdrawn</dt>
                    <dd>
                      {formatDay(record.withdrawnAt)}: {record.withdrawalReason}
                    </dd>
                  </>
                )}
              </dl>
              {!record.withdrawnAt && (
                <Form method="post" className="inline-form">
                  <input type="hidden" name="intent" value="withdraw" />
                  <input type="hidden" name="recordId" value={record.id} />
                  <label htmlFor={`reason-${record.id}`}>Why is this permission withdrawn?</label>
                  <input
                    id={`reason-${record.id}`}
                    name="reason"
                    required
                    maxLength={1000}
                    aria-describedby={withdrawError?.recordId === record.id ? `withdraw-error-${record.id}` : undefined}
                  />
                  {withdrawError?.recordId === record.id && (
                    <p id={`withdraw-error-${record.id}`} className="field-error" role="alert">
                      {withdrawError.error}
                    </p>
                  )}
                  <button type="submit">Withdraw this Rights Record</button>
                </Form>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2>Record a Rights Record</h2>
      <Form method="post" encType="multipart/form-data" className="article-form">
        <input type="hidden" name="intent" value="record" />
        <label htmlFor="rightsHolder">Rights holder</label>
        <input
          id="rightsHolder"
          name="rightsHolder"
          required
          maxLength={300}
          defaultValue={values?.rightsHolder}
          aria-describedby={describedBy("rightsHolder")}
        />
        {fieldError("rightsHolder")}

        <fieldset aria-describedby={describedBy("permittedUses") ?? "uses-hint"}>
          <legend>Permitted Uses</legend>
          <p id="uses-hint">Tick only what the evidence grants. AI training is never assumed.</p>
          {PERMITTED_USES.map((use) => (
            <div key={use} className="choice">
              <input
                type="checkbox"
                id={`use-${use}`}
                name="use"
                value={use}
                defaultChecked={values?.permittedUses.includes(use)}
              />
              <label htmlFor={`use-${use}`}>{PERMITTED_USE_NAMES[use]}</label>
            </div>
          ))}
          {fieldError("permittedUses")}
        </fieldset>

        <div className="choice">
          <input type="checkbox" id="guardianPermission" name="guardianPermission" />
          <label htmlFor="guardianPermission">
            This is documented permission from the guardian of the identifiable children shown
          </label>
        </div>

        <label htmlFor="expiresOn">Expires on (leave empty if it doesn't expire)</label>
        <input
          id="expiresOn"
          name="expiresOn"
          type="date"
          defaultValue={values?.expiresOn}
          aria-describedby={describedBy("expiresOn")}
        />
        {fieldError("expiresOn")}

        {contributors.length > 0 && (
          <fieldset aria-describedby={describedBy("contributorIds")}>
            <legend>Contributors this covers</legend>
            {contributors.map((person) => (
              <div key={person.id} className="choice">
                <input
                  type="checkbox"
                  id={`contributor-${person.id}`}
                  name="contributorId"
                  value={person.id}
                  defaultChecked={values?.contributorIds.includes(person.id)}
                />
                <label htmlFor={`contributor-${person.id}`}>{person.name}</label>
              </div>
            ))}
            {fieldError("contributorIds")}
          </fieldset>
        )}
        <p>
          <a href="/admin/contributors">Add a contributor</a>
        </p>

        <label htmlFor="evidence">Evidence (PDF, JPEG, PNG or WebP, up to 10 MB)</label>
        <input
          id="evidence"
          name="evidence"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
          aria-describedby={describedBy("evidence")}
        />
        {fieldError("evidence")}

        <button type="submit">Record Rights Record</button>
      </Form>
    </main>
  );
}
