import { data, Form, redirect } from "react-router";
import { topic } from "~db/schema";
import { BodyEditor } from "~/components/body-editor";
import { type ArticleBody, parseArticleBody } from "~/lib/article-body";
import { AREA_NAMES, isPrimaryArea } from "~/lib/areas";
import { cloudflareContext } from "~/lib/cloudflare";
import {
  CONTENT_FLAGS,
  FLAG_NAMES,
  isContentFlag,
  itemPath,
  KINDS,
  type KindFields,
  REVIEW_TYPE_NAMES,
  type ReviewType,
  reviewStanding,
} from "~/lib/content-rules";
import {
  itemForStaff,
  mayEdit,
  mayReview,
  publicItems,
  publish,
  Refused,
  recordReview,
  saveRevision,
  unpublish,
} from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { listMedia } from "~/lib/media.server";
import { previewToken } from "~/lib/preview.server";
import { can } from "~/lib/roles";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/item";

const MEDIA_KIND_OF = { audio: "audio", image: "image", video: "video", document: "document" } as const;

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const db = getDb(env.DB);
  const found = await itemForStaff(db, params.id);
  if (!found) throw new Response("Not found", { status: 404 });
  if (!mayEdit(actor, found.item.kind) && !(["editorial", "language", "knowledge-holder", "safeguarding"] as const).some((type) => mayReview(actor, type)))
    throw new Response("Your roles don't include this item.", { status: 403 });
  const [files, topics, published] = await Promise.all([
    listMedia(db),
    db.select().from(topic).orderBy(topic.name),
    publicItems(db, { limit: 200 }),
  ]);
  const standing = reviewStanding(found.required, found.reviews, found.latest.authorEmail);
  return {
    ...found,
    kindName: KINDS[found.item.kind].name,
    fieldSpecs: KINDS[found.item.kind].fields,
    placeName: isPrimaryArea(found.item.area) ? AREA_NAMES[found.item.area] : "Footer page",
    publicPath: itemPath(found.item),
    files: files.map((file) => ({ id: file.id, kind: file.kind, name: file.filename })),
    topics: topics.map((row) => ({ slug: row.slug, name: row.parent ? `${row.parent} › ${row.name}` : row.name })),
    embeddable: published
      .filter((row) => row.item.id !== found.item.id)
      .map((row) => ({ id: row.item.id, title: row.revision.title, typeName: KINDS[row.item.kind].name })),
    standing: standing.map((entry) => ({
      type: entry.type,
      name: REVIEW_TYPE_NAMES[entry.type],
      approved: entry.approved,
      latest: entry.latest ? { decision: entry.latest.decision, by: entry.latest.reviewerEmail } : null,
      mine: mayReview(actor, entry.type) && found.latest.authorEmail !== actor.email,
    })),
    actor: {
      email: actor.email,
      edits: mayEdit(actor, found.item.kind),
      publishes: can(actor, "content.publish"),
      rights: can(actor, "rights.manage"),
    },
    origin: new URL(request.url).origin.replace(`//${env.ADMIN_HOSTNAME}`, `//${env.ADMIN_HOSTNAME.replace(/^admin\./, "")}`),
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const db = getDb(env.DB);
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  try {
    switch (field("intent")) {
      case "save": {
        const found = await itemForStaff(db, params.id);
        if (!found) throw new Refused("That item doesn't exist.", 404);
        const body = parseArticleBody(JSON.parse(field("body") || "null"));
        if (!body.ok) return data({ error: body.error }, { status: 400 });
        const fields: KindFields = {};
        for (const spec of KINDS[found.item.kind].fields) fields[spec.name] = field(`field-${spec.name}`);
        await saveRevision(db, actor, params.id, field("baseRevisionId"), {
          title: field("title"),
          summary: field("summary"),
          credit: field("credit"),
          flags: form.getAll("flags").map(String).filter(isContentFlag),
          topics: form.getAll("topics").map(String).slice(0, 10),
          body: body.body as ArticleBody,
          fields,
          layer: found.latest.layer,
        });
        return redirect(`/admin/items/${params.id}?saved=1`);
      }
      case "review": {
        await recordReview(db, actor, field("revisionId"), {
          type: field("type") as ReviewType,
          decision: field("decision") === "approved" ? "approved" : "changes-requested",
          notes: field("notes"),
          knowledgeHolder: { name: field("holderName"), how: field("holderHow"), conditions: field("holderConditions") },
        });
        return redirect(`/admin/items/${params.id}`);
      }
      case "publish":
        await publish(db, actor, params.id, field("revisionId"));
        return redirect(`/admin/items/${params.id}?published=1`);
      case "withdraw":
      case "archive":
        await unpublish(db, actor, params.id, field("intent") === "archive" ? "archived" : "withdrawn", field("reason"));
        return redirect(`/admin/items/${params.id}`);
      case "preview": {
        if (!can(actor, "content.edit")) throw new Refused("Only editors share previews.", 403);
        const { token, expiresAt } = await previewToken(env.PREVIEW_SECRET, field("revisionId"));
        return { preview: { path: `/preview/${token}`, expiresAt } };
      }
      default:
        return data({ error: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof Refused) return data({ error: error.message }, { status: error.status });
    throw error;
  }
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.latest.title ?? "Item"} · NAISEMA staff` }];
}

export default function Item({ loaderData, actionData }: Route.ComponentProps) {
  const { item, latest, published, eligibility, standing, actor, fieldSpecs, files, topics } = loaderData;
  const error = actionData && "error" in actionData ? actionData.error : null;
  const preview = actionData && "preview" in actionData ? actionData.preview : null;
  const isPublishedVersion = published?.id === latest.id;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/items">All content</a>
      </p>
      <h1>{latest.title}</h1>
      <p className="meta">
        {loaderData.kindName} in {loaderData.placeName} · version {latest.number}, saved by {latest.authorEmail}
        {item.state === "published" && (
          <>
            {" · "}
            <a href={`${loaderData.origin}${loaderData.publicPath}`}>Published{isPublishedVersion ? "" : " (an earlier version)"}</a>
          </>
        )}
        {item.state === "withdrawn" && " · Withdrawn"}
        {item.state === "archived" && " · Archived"}
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <section aria-labelledby="status-heading" className="status-panel">
        <h2 id="status-heading">Where it stands</h2>
        {eligibility.eligible ? (
          <p role="status">{isPublishedVersion ? "This version is published." : "This version can be published."}</p>
        ) : (
          <>
            <p>This version can't be public yet:</p>
            <ul>
              {eligibility.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
        <ul className="review-standing">
          {standing.map((entry) => (
            <li key={entry.type}>
              {entry.name}:{" "}
              {entry.approved
                ? `approved by ${entry.latest?.by}`
                : entry.latest
                  ? `changes asked for by ${entry.latest.by}`
                  : "not done yet"}
            </li>
          ))}
        </ul>
        {actor.publishes && eligibility.eligible && !isPublishedVersion && item.state !== "archived" && (
          <Form method="post">
            <input type="hidden" name="intent" value="publish" />
            <input type="hidden" name="revisionId" value={latest.id} />
            <button type="submit">Publish version {latest.number}</button>
          </Form>
        )}
        {actor.publishes && item.state === "published" && (
          <Form method="post" className="inline-form">
            <label htmlFor="withdraw-reason">Reason</label>
            <input id="withdraw-reason" name="reason" required maxLength={500} />
            <button type="submit" name="intent" value="withdraw">
              Withdraw from the site
            </button>
            <button type="submit" name="intent" value="archive">
              Archive
            </button>
          </Form>
        )}
        <p>
          {actor.rights && <a href={`/admin/rights/item/${item.id}`}>Rights Records</a>}
          {item.kind === "video" && actor.edits && (
            <>
              {" · "}
              <a href={`/admin/items/${item.id}/layer`}>Learning Layer</a>
            </>
          )}
        </p>
        {actor.edits && (
          <Form method="post">
            <input type="hidden" name="intent" value="preview" />
            <input type="hidden" name="revisionId" value={latest.id} />
            <button type="submit">Make a preview link for version {latest.number}</button>
          </Form>
        )}
        {preview && (
          <p role="status">
            Preview link, for 14 days, showing version {latest.number} only:{" "}
            <code>{`${loaderData.origin}${preview.path}`}</code>
          </p>
        )}
      </section>

      {standing.some((entry) => entry.mine) && (
        <section aria-labelledby="review-heading">
          <h2 id="review-heading">Your review of version {latest.number}</h2>
          {standing
            .filter((entry) => entry.mine)
            .map((entry) => (
              <Form method="post" key={entry.type} className="review-form">
                <input type="hidden" name="intent" value="review" />
                <input type="hidden" name="revisionId" value={latest.id} />
                <input type="hidden" name="type" value={entry.type} />
                <fieldset>
                  <legend>{entry.name}</legend>
                  {entry.type === "knowledge-holder" && (
                    <>
                      <label htmlFor={`holder-name-${entry.type}`}>Knowledge Holder's name</label>
                      <input id={`holder-name-${entry.type}`} name="holderName" maxLength={200} />
                      <label htmlFor={`holder-how-${entry.type}`}>How they approved (in person, by phone, by email...)</label>
                      <input id={`holder-how-${entry.type}`} name="holderHow" maxLength={300} />
                      <label htmlFor={`holder-conditions-${entry.type}`}>Their conditions, if any</label>
                      <input id={`holder-conditions-${entry.type}`} name="holderConditions" maxLength={1000} />
                    </>
                  )}
                  <label htmlFor={`notes-${entry.type}`}>Notes</label>
                  <textarea id={`notes-${entry.type}`} name="notes" rows={3} maxLength={4000} />
                  <button type="submit" name="decision" value="approved">
                    Approve version {latest.number}
                  </button>{" "}
                  <button type="submit" name="decision" value="changes-requested">
                    Ask for changes
                  </button>
                </fieldset>
              </Form>
            ))}
        </section>
      )}

      {actor.edits && item.state !== "archived" && (
        <Form method="post" className="item-form" aria-labelledby="edit-heading">
          <h2 id="edit-heading">Edit</h2>
          <p className="hint">Saving makes version {latest.number + 1}. Its reviews start again.</p>
          <input type="hidden" name="intent" value="save" />
          <input type="hidden" name="baseRevisionId" value={latest.id} />
          <label htmlFor="title">Title</label>
          <input id="title" name="title" defaultValue={latest.title} required maxLength={200} />
          <label htmlFor="summary">Summary</label>
          <textarea id="summary" name="summary" defaultValue={latest.summary} rows={3} maxLength={1000} />
          <label htmlFor="credit">From (who it is by)</label>
          <input id="credit" name="credit" defaultValue={latest.credit} maxLength={300} />
          {fieldSpecs.map((spec) => {
            const id = `field-${spec.name}`;
            const value = latest.fields[spec.name] ?? "";
            if (spec.type === "text" || spec.type === "url")
              return (
                <div key={spec.name}>
                  <label htmlFor={id}>{spec.label}</label>
                  {spec.hint && <p className="hint">{spec.hint}</p>}
                  <input id={id} name={id} type={spec.type === "url" ? "url" : "text"} defaultValue={value} maxLength={500} />
                </div>
              );
            if (spec.type === "textarea")
              return (
                <div key={spec.name}>
                  <label htmlFor={id}>{spec.label}</label>
                  {spec.hint && <p className="hint">{spec.hint}</p>}
                  <textarea id={id} name={id} defaultValue={value} rows={spec.name === "transcript" ? 16 : 4} />
                </div>
              );
            const options =
              spec.type === "item"
                ? loaderData.embeddable.map((row) => ({ id: row.id, name: `${row.title} (${row.typeName})` }))
                : files.filter((file) => file.kind === MEDIA_KIND_OF[spec.type as keyof typeof MEDIA_KIND_OF]);
            return (
              <div key={spec.name}>
                <label htmlFor={id}>{spec.label}</label>
                {spec.hint && <p className="hint">{spec.hint}</p>}
                <select id={id} name={id} defaultValue={value}>
                  <option value="">None</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          <fieldset>
            <legend>Content Flags (they decide the reviews it needs)</legend>
            {CONTENT_FLAGS.map((flag) => (
              <label key={flag} className="checkbox">
                <input type="checkbox" name="flags" value={flag} defaultChecked={latest.flags.includes(flag)} />{" "}
                {FLAG_NAMES[flag]}
              </label>
            ))}
          </fieldset>
          {topics.length > 0 && (
            <fieldset>
              <legend>Topics</legend>
              {topics.map((row) => (
                <label key={row.slug} className="checkbox">
                  <input type="checkbox" name="topics" value={row.slug} defaultChecked={latest.topics.includes(row.slug)} />{" "}
                  {row.name}
                </label>
              ))}
            </fieldset>
          )}
          <BodyEditor initial={latest.body} embeddable={loaderData.embeddable} />
          <button type="submit">Save as version {latest.number + 1}</button>
        </Form>
      )}
    </main>
  );
}

