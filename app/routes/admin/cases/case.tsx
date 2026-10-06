import { data, Form } from "react-router";
import {
  APPEAL_OUTCOMES,
  CASE_KINDS,
  CASE_STATES,
  outcomesFor,
  outcomeText,
  readAppeal,
  readAppealDecision,
  readDecision,
  readTriage,
  reasonText,
  SEVERITIES,
} from "~/lib/case-rules";
import {
  addCaseEvidence,
  appealCase,
  type CaseChange,
  caseDetail,
  caseHandlers,
  closeCase,
  decideAppeal,
  decideCase,
  handledCase,
  hideContent,
  requireCaseTeam,
  showContent,
  triageCase,
} from "~/lib/cases.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { readEvidenceFile } from "~/lib/evidence-file";
import { primaryPublicOrigin } from "~/lib/public-cache.server";
import { CONSENT_PURPOSES } from "~/lib/submission-fields";
import { formatBytes } from "~/lib/upload-rules";
import type { Route } from "./+types/case";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Case ${loaderData?.reference ?? ""} · NAISEMA staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, actor } = await requireCaseTeam(context.get(cloudflareContext).env, request, params.id);
  return caseDetail(db, actor, params.id);
}

type Refusal = { intent: string; errors: Record<string, string> };

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireCaseTeam(env, request, params.id);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  // Emails to the person link to the public site, never the staff host.
  const origin = primaryPublicOrigin(env);
  const refuse = (errors: Record<string, string>, status = 400) =>
    data({ intent, errors } satisfies Refusal, { status });
  const done = (result: CaseChange, saved: string) =>
    result.ok ? { intent, saved } : refuse({ form: result.error }, 409);

  switch (intent) {
    case "triage": {
      const found = await handledCase(db, actor, params.id);
      const handlers = await caseHandlers(db, found.kind);
      const read = readTriage(
        form,
        handlers.map((handler) => handler.id),
      );
      if (!read.ok) return refuse(read.errors);
      const affectedPerson = String(form.get("affectedPerson") ?? "")
        .trim()
        .slice(0, 200);
      return done(await triageCase(db, actor, params.id, { ...read.triage, affectedPerson }), "Triaged.");
    }
    case "decide": {
      const found = await handledCase(db, actor, params.id);
      const read = readDecision(form, found.kind);
      if (!read.ok) return refuse(read.errors);
      return done(await decideCase(env, db, actor, params.id, read.decision, origin), "Decision recorded.");
    }
    case "close":
      return done(await closeCase(db, actor, params.id), "Closed.");
    case "hide":
      return done(await hideContent(env, db, actor, params.id), "Hidden from the public until you show it again.");
    case "show":
      return done(await showContent(env, db, actor, params.id), "Shown again, if it is otherwise eligible.");
    case "evidence": {
      const read = await readEvidenceFile(form.get("evidence"), "Choose the file to add.");
      if (!read.ok) return refuse({ evidence: read.error });
      return done(
        await addCaseEvidence(env, db, actor, params.id, read.file),
        "Added. It can be opened once it passes its virus scan.",
      );
    }
    case "appeal": {
      const read = readAppeal(form);
      if (!read.ok) return refuse(read.errors);
      const found = await handledCase(db, actor, params.id);
      return done(await appealCase(env, db, found, read.reasons, actor), "Appeal recorded.");
    }
    case "decide-appeal": {
      const read = readAppealDecision(form);
      if (!read.ok) return refuse(read.errors);
      return done(await decideAppeal(env, db, actor, params.id, read.decision), "Appeal decided; the Case is closed.");
    }
    default:
      return refuse({ form: "That isn't something you can do to a Case." });
  }
}

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  return errors[name] ? (
    <p id={`${name}-error`} className="field-error">
      {errors[name]}
    </p>
  ) : null;
}

export default function CasePage({ loaderData, actionData }: Route.ComponentProps) {
  const { case: found, reference, item, hold, evidence, handlers, requesterData } = loaderData;
  const errorsFor = (intent: string): Record<string, string> =>
    actionData && "errors" in actionData && actionData.intent === intent ? actionData.errors : {};
  const formError = actionData && "errors" in actionData ? actionData.errors.form : undefined;
  const outcomes = outcomesFor(found.kind);
  const triage = errorsFor("triage");
  const decide = errorsFor("decide");
  const evidenceErrors = errorsFor("evidence");
  const appeal = errorsFor("appeal");
  const appealDecision = errorsFor("decide-appeal");
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/cases">Back to Cases</a>
      </p>
      <h1>
        {CASE_KINDS[found.kind]} {reference}
      </h1>
      <p>Restricted. Opening this page and every change to it is recorded.</p>
      {actionData && "saved" in actionData && <p role="status">{actionData.saved}</p>}
      {formError && <p role="alert">{formError}</p>}

      <dl>
        <dt>State</dt>
        <dd>{CASE_STATES[found.state]}</dd>
        <dt>Received</dt>
        <dd>{found.receivedAt.toISOString().replace("T", " ").slice(0, 16)} UTC</dd>
        <dt>What they said</dt>
        <dd>{reasonText(found.kind, found.reason)}</dd>
        <dt>Details</dt>
        <dd className="preserve-lines">{found.details || "None given"}</dd>
        <dt>Content</dt>
        <dd>
          {item ? (
            <>
              <a href={item.path}>{item.path}</a> ({item.state}
              {hold ? ", hidden pending review" : ""})
            </>
          ) : (
            "Not about a piece of content"
          )}
        </dd>
        <dt>From</dt>
        <dd>
          {found.reporterEmail
            ? `${found.reporterName || "No name given"} <${found.reporterEmail}>`
            : "Anonymous: they can't be told the outcome"}
        </dd>
        <dt>Affects</dt>
        <dd>{found.affectedPerson || "Not recorded"}</dd>
        <dt>Severity</dt>
        <dd>{found.severity ? SEVERITIES[found.severity] : "Not triaged"}</dd>
        <dt>Owner</dt>
        <dd>{loaderData.ownerEmail ?? "Nobody yet"}</dd>
        {found.outcome && (
          <>
            <dt>Decision</dt>
            <dd>
              {outcomeText(found.kind, found.outcome)} ({day(found.decidedAt)}, {loaderData.decidedByEmail})
            </dd>
            <dt>What was done</dt>
            <dd className="preserve-lines">{found.action}</dd>
            <dt>Why</dt>
            <dd className="preserve-lines">{found.rationale}</dd>
          </>
        )}
        {found.appealedAt && (
          <>
            <dt>Appeal</dt>
            <dd className="preserve-lines">
              {day(found.appealedAt)}: {found.appealReasons}
            </dd>
          </>
        )}
        {found.appealOutcome && (
          <>
            <dt>Appeal decision</dt>
            <dd>
              {APPEAL_OUTCOMES[found.appealOutcome]} ({day(found.appealDecidedAt)}, {loaderData.appealDecidedByEmail}):{" "}
              {found.appealRationale}
            </dd>
          </>
        )}
      </dl>

      {requesterData && (
        <section aria-labelledby="requester-data-heading">
          <h2 id="requester-data-heading">What NAISEMA holds for this address</h2>
          <p>
            {requesterData.submissions.length} Submission{requesterData.submissions.length === 1 ? "" : "s"}
            {requesterData.submissions.length > 0 &&
              `: ${requesterData.submissions.map((row) => `${row.type} (${day(row.receivedAt)})`).join(", ")}`}
            .
          </p>
          <ul>
            {requesterData.consents.map((consent) => (
              <li key={consent.id}>
                {CONSENT_PURPOSES[consent.purpose]}, {day(consent.givenAt)}
                {consent.withdrawnAt ? `, withdrawn ${day(consent.withdrawnAt)}` : ""}
              </li>
            ))}
          </ul>
          <p>
            <a href={`/admin/consents?email=${encodeURIComponent(found.reporterEmail ?? "")}`}>Their Consent Records</a>
          </p>
        </section>
      )}

      {loaderData.can.act && found.state === "received" && (
        <Form method="post" className="article-form">
          <h2>Triage</h2>
          <input type="hidden" name="intent" value="triage" />
          <label htmlFor="severity">How serious is it?</label>
          <select
            id="severity"
            name="severity"
            defaultValue=""
            aria-describedby={triage.severity ? "severity-error" : undefined}
          >
            <option value="">Choose</option>
            {Object.entries(SEVERITIES).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <FieldError name="severity" errors={triage} />
          <label htmlFor="ownerId">Owner</label>
          <select
            id="ownerId"
            name="ownerId"
            defaultValue=""
            aria-describedby={triage.ownerId ? "ownerId-error" : undefined}
          >
            <option value="">Choose</option>
            {handlers.map((handler) => (
              <option key={handler.id} value={handler.id}>
                {handler.email}
              </option>
            ))}
          </select>
          <FieldError name="ownerId" errors={triage} />
          <label htmlFor="affectedPerson">Who it affects</label>
          <input id="affectedPerson" name="affectedPerson" defaultValue={found.affectedPerson} maxLength={200} />
          <button type="submit">Triage</button>
        </Form>
      )}

      {loaderData.can.hold &&
        (hold === "another" ? (
          <p>
            <strong>The content is already hidden</strong> while another Case about it is reviewed.
          </p>
        ) : (
          <Form method="post">
            <h2>The content</h2>
            <input type="hidden" name="intent" value={hold ? "show" : "hide"} />
            <p>
              {hold
                ? "It is hidden from the public, with its images and files, while this Case is reviewed."
                : "Hide it from the public, with its images and files, while this Case is reviewed. Nobody can republish it until you show it again."}
            </p>
            <button type="submit">{hold ? "Show it again" : "Hide pending review"}</button>
          </Form>
        ))}

      {loaderData.can.act && found.state === "triaged" && (
        <Form method="post" className="article-form">
          <h2>Decide</h2>
          <input type="hidden" name="intent" value="decide" />
          <label htmlFor="outcome">Outcome{found.reporterEmail ? " (this is what they are told)" : ""}</label>
          <select
            id="outcome"
            name="outcome"
            defaultValue=""
            aria-describedby={decide.outcome ? "outcome-error" : undefined}
          >
            <option value="">Choose</option>
            {Object.entries(outcomes).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
          <FieldError name="outcome" errors={decide} />
          <label htmlFor="action">What was done</label>
          <textarea id="action" name="action" rows={3} aria-describedby={decide.action ? "action-error" : undefined} />
          <FieldError name="action" errors={decide} />
          <label htmlFor="rationale">Why</label>
          <textarea
            id="rationale"
            name="rationale"
            rows={3}
            aria-describedby={decide.rationale ? "rationale-error" : undefined}
          />
          <FieldError name="rationale" errors={decide} />
          <button type="submit">Record the decision</button>
        </Form>
      )}

      {loaderData.can.act && found.state === "actioned" && (
        <Form method="post">
          <input type="hidden" name="intent" value="close" />
          <button type="submit">Close the Case</button>
        </Form>
      )}

      {loaderData.can.act && loaderData.appealOpen && (
        <Form method="post" className="article-form">
          <h2>Record an appeal</h2>
          <p>
            When the person, or someone the decision affects, appeals another way (a reply, a call), record it here.
            Someone other than whoever decided will be asked to look at it.
          </p>
          <input type="hidden" name="intent" value="appeal" />
          <label htmlFor="reasons">Their reasons</label>
          <textarea
            id="reasons"
            name="reasons"
            rows={3}
            aria-describedby={appeal.reasons ? "reasons-error" : undefined}
          />
          <FieldError name="reasons" errors={appeal} />
          <button type="submit">Record the appeal</button>
        </Form>
      )}

      {found.state === "appealed" &&
        (loaderData.can.decideAppeal ? (
          <Form method="post" className="article-form">
            <h2>Decide the appeal</h2>
            <input type="hidden" name="intent" value="decide-appeal" />
            <label htmlFor="appeal-outcome">Outcome</label>
            <select
              id="appeal-outcome"
              name="outcome"
              defaultValue=""
              aria-describedby={appealDecision.outcome ? "outcome-error" : undefined}
            >
              <option value="">Choose</option>
              {Object.entries(APPEAL_OUTCOMES).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            <FieldError name="outcome" errors={appealDecision} />
            <label htmlFor="appeal-rationale">Why</label>
            <textarea
              id="appeal-rationale"
              name="rationale"
              rows={3}
              aria-describedby={appealDecision.rationale ? "rationale-error" : undefined}
            />
            <FieldError name="rationale" errors={appealDecision} />
            <button type="submit">Decide the appeal</button>
          </Form>
        ) : (
          <p>
            <strong>This appeal needs someone else:</strong> you made the decision being appealed.
          </p>
        ))}

      <section aria-labelledby="evidence-heading">
        <h2 id="evidence-heading">Restricted evidence</h2>
        {evidence.length ? (
          <ul>
            {evidence.map((file) => (
              <li key={file.id}>
                {file.status === "ready" ? (
                  <a href={`/admin/cases/${found.id}/evidence/${file.id}`}>{file.name}</a>
                ) : (
                  file.name
                )}{" "}
                ({formatBytes(file.size)}, added {day(file.addedAt)}): {file.status}
                {file.statusReason && `. ${file.statusReason}`}
              </li>
            ))}
          </ul>
        ) : (
          <p>None yet.</p>
        )}
        {loaderData.can.act && (
          <Form method="post" encType="multipart/form-data" className="article-form">
            <input type="hidden" name="intent" value="evidence" />
            <label htmlFor="evidence">Add a screenshot or document</label>
            <p id="evidence-hint" className="hint">
              A PDF, JPEG, PNG or WebP of at most 10 MB. Only this Case's team can open it.
            </p>
            <input
              id="evidence"
              name="evidence"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              aria-describedby={evidenceErrors.evidence ? "evidence-hint evidence-error" : "evidence-hint"}
            />
            <FieldError name="evidence" errors={evidenceErrors} />
            <button type="submit">Add evidence</button>
          </Form>
        )}
      </section>
    </main>
  );
}
