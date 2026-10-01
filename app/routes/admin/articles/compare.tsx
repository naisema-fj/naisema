import type { ArticleSnapshot } from "~/lib/article-fields";
import { getArticle } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { type EpisodeDetails, formatDuration } from "~/lib/episode-fields";
import { bodyLines, type DiffLine, diffLines } from "~/lib/revision-diff";
import { getRevision } from "~/lib/revisions.server";
import { topicNamer } from "~/lib/topics.server";
import type { Route } from "./+types/compare";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Na iSema staff" }];
  return [{ title: `Compare revisions ${loaderData.from.number} and ${loaderData.to.number} · Na iSema staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db } = await requireEditor(context.get(cloudflareContext).env, request);
  const search = new URL(request.url).searchParams;
  const article = await getArticle(db, params.id);
  if (!article) throw new Response("Not found", { status: 404 });
  const [from, to] = await Promise.all([
    getRevision<ArticleSnapshot>(db, article.id, Number(search.get("from"))),
    getRevision<ArticleSnapshot>(db, article.id, Number(search.get("to"))),
  ]);
  if (!from || !to) throw new Response("Choose two revisions of this article to compare.", { status: 404 });

  const topicNames = await topicNamer(db);
  const topics = (ids: string[]) => topicNames(ids).sort().join(", ");
  const fields = [
    { label: "Title", before: from.snapshot.title, after: to.snapshot.title },
    { label: "Summary", before: from.snapshot.summary, after: to.snapshot.summary },
    { label: "Topics", before: topics(from.snapshot.topicIds), after: topics(to.snapshot.topicIds) },
    { label: "Credit", before: from.snapshot.credit, after: to.snapshot.credit },
    ...episodeFields(from.snapshot.episode, to.snapshot.episode),
  ];
  const transcript = (snapshot: ArticleSnapshot) =>
    (snapshot.episode?.transcript ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  return {
    article,
    from: { number: from.number },
    to: { number: to.number },
    fields,
    body: diffLines(bodyLines(from.snapshot.body), bodyLines(to.snapshot.body)),
    transcript:
      from.snapshot.episode || to.snapshot.episode
        ? diffLines(transcript(from.snapshot), transcript(to.snapshot))
        : null,
  };
}

/** An Episode's facts as compared fields; its transcript is compared line by line below. */
function episodeFields(before: EpisodeDetails | undefined, after: EpisodeDetails | undefined) {
  if (!before && !after) return [];
  const facts = (episode: EpisodeDetails | undefined) => ({
    audio: episode?.audioAssetId ?? "",
    host: episode?.host ?? "",
    guests: episode?.guests.join(", ") ?? "",
    recordedOn: episode?.recordedOn ?? "",
    length: episode ? formatDuration(episode.durationSeconds) : "",
    links: episode?.distribution.map((link) => `${link.label} (${link.url})`).join(", ") ?? "",
  });
  const [was, now] = [facts(before), facts(after)];
  return [
    { label: "Audio file (media library ID)", before: was.audio, after: now.audio },
    { label: "Host", before: was.host, after: now.host },
    { label: "Guests", before: was.guests, after: now.guests },
    { label: "Recorded on", before: was.recordedOn, after: now.recordedOn },
    { label: "Length", before: was.length, after: now.length },
    { label: "Also available on", before: was.links, after: now.links },
  ];
}

export default function Compare({ loaderData }: Route.ComponentProps) {
  const { article, from, to, fields, body, transcript } = loaderData;

  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/articles/${article.id}/history`}>Back to revision history</a>
      </p>
      <h1>
        Revision {from.number} compared with revision {to.number}
      </h1>
      <p>{article.currentRevision.snapshot.title}</p>

      <h2>Fields</h2>
      <dl className="compare-fields">
        {fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            {field.before === field.after ? (
              <dd>Unchanged: {field.after}</dd>
            ) : (
              <>
                <dd>
                  <del>Was: {field.before}</del>
                </dd>
                <dd>
                  <ins>Now: {field.after}</ins>
                </dd>
              </>
            )}
          </div>
        ))}
      </dl>

      <h2>Body</h2>
      <LineDiff lines={body} unchanged="The body is unchanged." />
      {transcript && (
        <>
          <h2>Transcript</h2>
          <LineDiff lines={transcript} unchanged="The transcript is unchanged." />
        </>
      )}
    </main>
  );
}

function LineDiff({ lines, unchanged }: { lines: DiffLine[]; unchanged: string }) {
  if (!lines.some((line) => line.kind !== "same")) return <p>{unchanged}</p>;
  return (
    <ol className="body-diff">
      {lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the diff is rendered once and never reordered.
        <li key={index} className={line.kind}>
          {line.kind === "added" && <ins>Added: {line.text}</ins>}
          {line.kind === "removed" && <del>Removed: {line.text}</del>}
          {line.kind === "same" && line.text}
        </li>
      ))}
    </ol>
  );
}
