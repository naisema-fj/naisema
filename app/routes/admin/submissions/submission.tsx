import { data, Form } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { primaryPublicOrigin } from "~/lib/public-cache.server";
import {
  CONSENT_PURPOSES,
  SUBMISSION_STATUSES,
  SUBMISSION_TYPES,
  submissionSummary,
  takesUploads,
  UPLOAD_LINK_DAYS,
} from "~/lib/submission-fields";
import {
  possibleOwners,
  requireSubmissionManager,
  sendUploadLink,
  submissionDetail,
  updateSubmission,
} from "~/lib/submissions.server";
import { formatBytes } from "~/lib/upload-rules";
import type { Route } from "./+types/submission";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.submission.name ?? "Submission"} · Na iSema staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireSubmissionManager(context.get(cloudflareContext).env, request);
  const [detail, owners] = await Promise.all([submissionDetail(db, params.id), possibleOwners(db)]);
  if (!detail) throw new Response("Not found", { status: 404 });
  return { ...detail, owners, now: Date.now() };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireSubmissionManager(env, request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "upload-link") {
    // Links in the email go to the public site, never the staff host.
    const origin = primaryPublicOrigin(env);
    const sent = await sendUploadLink(env, db, actor.userId, params.id, origin);
    if (!sent) throw new Response("Only a contribution proposal can be sent an upload link.", { status: 400 });
    return { saved: "An upload link has been emailed to them." };
  }
  const updated = await updateSubmission(db, actor.userId, params.id, {
    status: String(form.get("status") ?? ""),
    ownerId: String(form.get("ownerId") ?? ""),
    dueOn: String(form.get("dueOn") ?? ""),
  });
  if (!updated) throw new Response("Not found", { status: 404 });
  if (!updated.ok) return data({ errors: updated.errors }, { status: 400 });
  return { saved: "Saved." };
}

export default function SubmissionPage({ loaderData, actionData }: Route.ComponentProps) {
  const { submission, consents, links, files, owners, now } = loaderData;
  const errors: Record<string, string> = actionData && "errors" in actionData ? actionData.errors : {};
  const activeLink = links.find((link) => !link.finishedAt && new Date(link.expiresAt).getTime() > now);
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/submissions">Back to Submissions</a>
      </p>
      <h1>
        {SUBMISSION_TYPES[submission.type].name} from {submission.name}
      </h1>
      {actionData && "saved" in actionData && <p role="status">{actionData.saved}</p>}
      <dl>
        <dt>Email</dt>
        <dd>{submission.email}</dd>
        <dt>Received</dt>
        <dd>{submission.receivedAt.toISOString().replace("T", " ").slice(0, 16)} UTC</dd>
        <dt>Confirmation email</dt>
        <dd>{submission.confirmedAt ? "Sent" : "Not sent: reply to them yourself"}</dd>
        {submissionSummary(submission.type, submission.fields).map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd className="preserve-lines">{line.text}</dd>
          </div>
        ))}
      </dl>

      <h2>What they agreed to</h2>
      <ul>
        {consents.map((consent) => (
          <li key={consent.id}>
            {CONSENT_PURPOSES[consent.purpose]} (notice version {consent.version})
            {consent.withdrawnAt && (
              <strong> — withdrawn {consent.withdrawnAt.toISOString().slice(0, 10)}: don't use it for this</strong>
            )}
          </li>
        ))}
      </ul>

      <h2>Working on it</h2>
      <Form method="post" className="article-form">
        {Object.keys(errors).length > 0 && <p role="alert">Nothing was saved. Fix the fields marked below.</p>}
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={submission.status}>
          {Object.entries(SUBMISSION_STATUSES).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <label htmlFor="ownerId">Owner</label>
        <select
          id="ownerId"
          name="ownerId"
          defaultValue={submission.ownerId ?? ""}
          aria-describedby={errors.ownerId ? "ownerId-error" : undefined}
        >
          <option value="">Nobody yet</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.email}
            </option>
          ))}
        </select>
        {errors.ownerId && (
          <p id="ownerId-error" className="field-error">
            {errors.ownerId}
          </p>
        )}
        <label htmlFor="dueOn">Answer by</label>
        <input
          id="dueOn"
          name="dueOn"
          type="date"
          defaultValue={submission.dueOn}
          aria-describedby={errors.dueOn ? "dueOn-error" : undefined}
        />
        {errors.dueOn && (
          <p id="dueOn-error" className="field-error">
            {errors.dueOn}
          </p>
        )}
        <button type="submit">Save</button>
      </Form>

      {takesUploads(submission.type) && (
        <>
          <h2>Their material</h2>
          <p>
            If you'd like to see what they offered, send them a private upload link. It works for {UPLOAD_LINK_DAYS}{" "}
            days or until they say they've finished, and sending another stops the one before. Their files are scanned
            for viruses and kept privately here; they never go into the media library.
          </p>
          {activeLink && <p>A link sent on {activeLink.issuedAt.toISOString().slice(0, 10)} still works.</p>}
          <Form method="post">
            <input type="hidden" name="intent" value="upload-link" />
            <button type="submit">{links.length ? "Send a new upload link" : "Send an upload link"}</button>
          </Form>
          {files.length > 0 && (
            <ul>
              {files.map((file) => (
                <li key={file.id}>
                  {file.status === "ready" ? (
                    <a href={`/admin/submissions/${submission.id}/files/${file.id}`}>{file.name}</a>
                  ) : (
                    file.name
                  )}{" "}
                  ({formatBytes(file.size)}): {file.status}
                  {file.statusReason && `. ${file.statusReason}`}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
