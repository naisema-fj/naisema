import { Form, Link, redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import {
  approveEntry,
  canReviewEntry,
  dictionarySources,
  ENTRY_STATES,
  entryState,
  getDictionaryEntry,
  publicDictionaryPaths,
  requireDictionaryStaff,
  withdrawApproval,
} from "~/lib/dictionary.server";
import { can } from "~/lib/permissions";
import { purgePublicPages } from "~/lib/public-cache.server";
import type { Route } from "./+types/entry";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.entry.headword ?? "Draft"} · Vosa dictionary drafts · NAISEMA staff` }];
}

/** GET /admin/dictionary/:id — one draft word or saying, with what the apps site said and the sources it cites. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, actor } = await requireDictionaryStaff(context.get(cloudflareContext).env, request);
  const entry = await getDictionaryEntry(db, params.id);
  if (!entry) throw new Response("Not found", { status: 404 });
  const cited = await dictionarySources(db, entry.sourceIds);
  const state = entryState(entry, cited);
  const approved = state !== "needs_review";
  return {
    state: ENTRY_STATES[state],
    isPublic: state === "public",
    canApprove: !approved && canReviewEntry(actor, entry),
    canWithdraw: approved && (canReviewEntry(actor, entry) || can(actor, { action: "content.withdraw" })),
    importedByYou: entry.importedBy === actor.userId,
    id: entry.id,
    entry: {
      headword: entry.headword,
      kind: entry.kind,
      meaning: entry.meaning,
      literalMeaning: entry.literalMeaning,
      partOfSpeech: entry.partOfSpeech,
      themes: entry.themes,
      appsStatus: entry.appsStatus,
      importBatch: entry.importBatch,
      details: JSON.stringify(entry.details, null, 2),
    },
    sources: cited.map((source) => ({
      id: source.id,
      name: source.name,
      webUrl: source.webUrl,
      cleared: Boolean(source.clearedAt),
    })),
    missingSources: entry.sourceIds.length - cited.length,
  };
}

/** POST: approve what the entry shows now for language, or withdraw that approval. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireDictionaryStaff(env, request);
  const entry = await getDictionaryEntry(db, params.id);
  if (!entry) throw new Response("Not found", { status: 404 });
  const intent = String((await request.formData()).get("intent") ?? "");
  const done =
    intent === "approve"
      ? await approveEntry(db, actor, entry)
      : intent === "withdraw"
        ? await withdrawApproval(db, actor, entry)
        : false;
  if (!done) throw new Response("You can't do that to this entry.", { status: 403 });
  await purgePublicPages(env, publicDictionaryPaths(entry.id));
  return redirect(`/admin/dictionary/${entry.id}`);
}

export default function DictionaryEntry({ loaderData }: Route.ComponentProps) {
  const { entry, sources, state, isPublic, canApprove, canWithdraw, importedByYou, id, missingSources } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <Link to="/admin/dictionary">Back to the dictionary drafts</Link>
      </p>
      <h1 lang="fj">{entry.headword}</h1>
      <p className="meta" role="status">
        {state}
        {isPublic ? (
          <>
            {" · "}
            <a href={`/learn/dictionary/${id}`}>See it on the public site</a>
          </>
        ) : (
          ". Not public."
        )}
      </p>
      {canApprove && (
        <Form method="post" className="inline-form">
          <input type="hidden" name="intent" value="approve" />
          <p>
            Approve for language only if the Fijian, its English meaning and its part of speech below are right, as they
            stand.
          </p>
          <button type="submit">Approve for language</button>
        </Form>
      )}
      {!canApprove && !canWithdraw && importedByYou && <p>You imported this entry, so someone else reviews it.</p>}
      {canWithdraw && (
        <Form method="post" className="inline-form">
          <input type="hidden" name="intent" value="withdraw" />
          <button type="submit">Withdraw the language approval</button>
        </Form>
      )}
      <dl>
        <dt>Meaning in English</dt>
        <dd>{entry.meaning}</dd>
        {entry.literalMeaning && (
          <>
            <dt>Literal meaning</dt>
            <dd>{entry.literalMeaning}</dd>
          </>
        )}
        {entry.partOfSpeech && (
          <>
            <dt>Part of speech or term type</dt>
            <dd>{entry.partOfSpeech}</dd>
          </>
        )}
        {entry.themes.length > 0 && (
          <>
            <dt>Themes</dt>
            <dd>{entry.themes.join(", ")}</dd>
          </>
        )}
        <dt>What the apps site said</dt>
        <dd>{entry.appsStatus || "Nothing"} (not a NAISEMA review)</dd>
        <dt>Imported in</dt>
        <dd>{entry.importBatch}</dd>
      </dl>
      <h2>Sources it cites</h2>
      {sources.length ? (
        <ul>
          {sources.map((source) => (
            <li key={source.id}>
              {source.webUrl ? (
                <a href={source.webUrl} rel="noopener">
                  {source.name}
                </a>
              ) : (
                source.name
              )}
              {source.cleared ? " · cleared" : " · not cleared yet"}
            </li>
          ))}
        </ul>
      ) : (
        <p>None recorded.</p>
      )}
      {missingSources > 0 && (
        <p>
          {missingSources === 1 ? "One source it cites isn't" : `${missingSources} sources it cites aren't`} in the
          import, so it can't be public until the data file lists {missingSources === 1 ? "it" : "them"}.
        </p>
      )}
      <details>
        <summary>The rest of the record, as the apps site had it</summary>
        <pre>{entry.details}</pre>
      </details>
    </main>
  );
}
