import { eq } from "drizzle-orm";
import { Eye, Link2Off } from "lucide-react";
import { Icon } from "~/components/icons";
import { ContentLetter } from "~/components/public/content-letter";
import { PageHead } from "~/components/public/parts";
import { NOTE_KINDS } from "~/lib/annotations";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { PRIVATE_NO_STORE } from "~/lib/http";
import { readPreviewToken } from "~/lib/preview.server";
import { publicView } from "~/lib/public-view.server";
import type { RouteHandle } from "~/lib/route-handle";
import { contentItem, revision } from "~db/schema";
import type { Route } from "./+types/preview";

export const handle: RouteHandle = { hydrate: false, noindex: true };

export function headers() {
  return { "Cache-Control": PRIVATE_NO_STORE };
}

/**
 * GET /preview/:token: one exact Revision, for a Knowledge Holder or other reviewer outside the
 * team, for 14 days, without signing in (ADR-0015). Marked as a draft, never indexed or kept. Its
 * media comes through the same token, so it plays before rights are recorded.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const read = await readPreviewToken(env.PREVIEW_SECRET, params.token);
  if (!read.ok) return { state: read.reason };
  const db = getDb(env.DB);
  const rev = await db.query.revision.findFirst({ where: eq(revision.id, read.revisionId) });
  const item = rev && (await db.query.contentItem.findFirst({ where: eq(contentItem.id, rev.itemId) }));
  if (!rev || !item) return { state: "invalid" as const };
  const view = await publicView(db, { item, revision: rev, approvals: [] });
  // Media addresses go through this link rather than the public delivery, which asks for rights.
  const viaLink = JSON.parse(
    JSON.stringify(view)
      .replaceAll('"/media/', `"/preview/${params.token}/media/`)
      .replaceAll(" /media/", ` /preview/${params.token}/media/`),
  ) as typeof view;
  return {
    state: "ok" as const,
    view: viaLink,
    revisionNumber: rev.number,
    expiresAt: read.expiresAt,
    layer: rev.layer
      ? {
          segments: rev.layer.segments.map(({ id, fijian, english, speaker }) => ({ id, fijian, english, speaker })),
          notes: rev.layer.notes,
        }
      : null,
  };
}

export function meta() {
  return [{ title: "Draft for review · NAISEMA" }];
}

export default function Preview({ loaderData }: Route.ComponentProps) {
  if (loaderData.state !== "ok") {
    return (
      <main id="main">
        <article className="pane pane-narrow">
          <PageHead
            tone="none"
            icon={Link2Off}
            title={loaderData.state === "expired" ? "This link has expired" : "This link doesn't work"}
          />
          <p className="lede">Ask the person who sent it for a new one.</p>
        </article>
      </main>
    );
  }
  const { view, layer } = loaderData;
  return (
    <main id="main" className="article-page">
      <p className="draft-banner" role="note">
        <Icon icon={Eye} />
        Draft for review: version {loaderData.revisionNumber}. Not published. This link works until{" "}
        {new Date(loaderData.expiresAt).toLocaleDateString("en-AU", { dateStyle: "long" })}.
      </p>
      <ContentLetter item={view} />
      {layer && (
        <section className="pane transcript" aria-labelledby="layer-heading">
          <h2 id="layer-heading">The Learning Layer's words</h2>
          <ol>
            {layer.segments.map((segment) => (
              <li key={segment.id}>
                {segment.speaker && <p className="speaker">{segment.speaker}</p>}
                <p lang="fj">{segment.fijian}</p>
                {segment.english && <p>{segment.english}</p>}
              </li>
            ))}
          </ol>
          {layer.notes.length > 0 && (
            <>
              <h3>Culture and context notes</h3>
              <ul>
                {layer.notes.map((note) => (
                  <li key={note.id}>
                    <p>
                      <strong>{NOTE_KINDS[note.kind]}</strong>: {note.text}
                    </p>
                    <p className="meta">From {note.attribution}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </main>
  );
}
