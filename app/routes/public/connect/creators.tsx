import { Form, Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { MEDIA_TYPES, type MediaType } from "~/lib/creator-fields";
import { getDb } from "~/lib/db.server";
import { listCreators } from "~/lib/search.server";
import type { Route } from "./+types/creators";

export const handle = { hydrate: false };
// The media filter lives in the query string, which the edge cache ignores, so this page is never cached.
export const headers = () => ({ "Cache-Control": "no-store" });

/** GET /connect/creators — the public Creator Profiles, narrowed to one kind of media if chosen. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const chosen = new URL(request.url).searchParams.get("media") ?? "";
  const media = Object.hasOwn(MEDIA_TYPES, chosen) ? (chosen as MediaType) : null;
  return { media, creators: await listCreators(getDb(context.get(cloudflareContext).env.DB), media) };
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: "Creators · Connect · NAISEMA" },
    { name: "description", content: "Fijian creators and their work, each with a free sample." },
    ...(loaderData?.media ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export default function Creators({ loaderData }: Route.ComponentProps) {
  const { media, creators } = loaderData;
  return (
    <main id="main">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/connect">Connect</Link>
          </li>
          <li aria-current="page">Creators</li>
        </ol>
      </nav>
      <article className="letter" aria-labelledby="creators-heading">
        <header className="letter-head">
          <h1 id="creators-heading">Creators</h1>
          <p className="lede">Fijian creators and their work, each with a free sample.</p>
        </header>
        <Form method="get" className="search-form filters" aria-label="Narrow the list">
          <label htmlFor="media">Kind of work</label>
          <select id="media" name="media" defaultValue={media ?? ""}>
            <option value="">Any kind</option>
            {Object.entries(MEDIA_TYPES).map(([type, name]) => (
              <option key={type} value={type}>
                {name}
              </option>
            ))}
          </select>
          <button type="submit">Show</button>
        </Form>
        {creators.length ? (
          <ul className="letter-list">
            {creators.map((creator) => (
              <li key={creator.path}>
                <Link to={creator.path}>{creator.name}</Link>
                <p>{creator.summary}</p>
                <p className="list-mark">{`${creator.location} · ${creator.mediaTypes.join(", ")}`}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            {media ? "No creators work in that kind of media yet." : "No creators are listed yet."}
          </p>
        )}
        {media && (
          <p>
            <Link to="/connect/creators">Show every creator</Link>
          </p>
        )}
      </article>
    </main>
  );
}
