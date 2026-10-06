import { RightsRecords } from "~/components/rights-records";
import type { ArticleSnapshot } from "~/lib/article-fields";
import { getArticle } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireRightsManager } from "~/lib/content.server";
import { episodeParts } from "~/lib/episode-fields";
import { layersOfVideo } from "~/lib/learning-layers.server";
import { publicItemChanged } from "~/lib/public-change.server";
import { rightsAction, rightsPageData } from "~/lib/rights-page.server";
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

/** The parts with rights of their own that the current draft lists: an Episode's; none otherwise. */
const partsOf = (snapshot: ArticleSnapshot) => (snapshot.episode ? episodeParts(snapshot.episode) : []);

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, article } = await requireArticleRights(request, context.get(cloudflareContext).env, params.id);
  return {
    article: { id: article.id, title: article.currentRevision.snapshot.title },
    // Learning Layers on a Video rely on its rights too (VID-01, VCMS-06).
    layers: article.type === "video" ? await layersOfVideo(db, article.id) : [],
    ...(await rightsPageData(db, { type: "content_item", id: article.id }, partsOf(article.currentRevision.snapshot))),
    done: new URL(request.url).searchParams.get("done"),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, article } = await requireArticleRights(request, env, params.id);
  return rightsAction(env, db, actor.userId, request, {
    subject: { type: "content_item", id: article.id },
    parts: partsOf(article.currentRevision.snapshot),
    changed: () => publicItemChanged(env, db, article.id),
  });
}

export default function Rights({ loaderData, actionData }: Route.ComponentProps) {
  const { article, parts, records, contributors, done, layers } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/articles/${article.id}`}>Back to {article.title}</a>
      </p>
      <h1>Rights Records: {article.title}</h1>
      <RightsRecords
        intro={
          <>
            <p>
              An article can be published only while a current Rights Record grants Publish. Each Permitted Use is
              granted separately. Records are never edited: to correct one, withdraw it and record it again. A record
              here covers the item's own words and anything from other sites. Each media library file it uses (an image,
              a Resource's file, an Episode's audio) needs a Rights Record of its own, on the file's page in the media
              library.
            </p>
            {layers.length > 0 && (
              <>
                <p>
                  Learning Layers on this Video need its rights too: Publish, Translate, Transcribe and Educational
                  adaptation, plus Excerpt for one built on an Excerpt. Withdrawing a record that grants only those
                  teaching uses takes the Learning Layers down and leaves the Video; withdrawing its Publish grant takes
                  down both. These depend on it:
                </p>
                <ul>
                  {layers.map((layer) => (
                    <li key={layer.id}>
                      <a href={`/admin/learning-layers/${layer.id}`}>{layer.title}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {parts.length > 0 && (
              <p>
                A speaker or guest, a piece of music or an archive clip this Episode lists can have Rights Records of
                its own as well. While the published revision lists a part that has records, it needs one of them
                current, granting Publish, too; a part cut from the Episode no longer counts.
              </p>
            )}
          </>
        }
        parts={parts}
        records={records}
        contributors={contributors}
        done={done}
        actionData={actionData}
      />
    </main>
  );
}
