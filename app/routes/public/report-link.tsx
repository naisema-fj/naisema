import { Link } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { reportBrokenLink } from "~/lib/link-reports.server";
import type { Route } from "./+types/report-link";

export const handle = { hydrate: false };
export const headers = () => ({ "Cache-Control": "no-store" });

export function meta() {
  return [{ title: "Report a broken link · Na iSema" }, { name: "robots", content: "noindex" }];
}

/** Reports arrive from the button on a Resource's page; opening this address directly shows how. */
export function loader() {
  return null;
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const reported = await reportBrokenLink(env, getDb(env.DB), request, params.id);
  if (!reported) throw new Response("Not found", { status: 404 });
  return reported;
}

export default function ReportLink({ actionData }: Route.ComponentProps) {
  return (
    <main id="main">
      <article className="letter letter-narrow">
        <h1>{actionData ? "Thank you" : "Report a broken link"}</h1>
        {actionData ? (
          <>
            <p>
              We've noted that the link to {actionData.host} from {actionData.title} may be broken. An editor will check
              it.
            </p>
            <p>
              <Link to={actionData.path}>Back to {actionData.title}</Link>
            </p>
          </>
        ) : (
          <p>
            To report a broken link, use the "Report a broken link" button on the resource's page.{" "}
            <Link to="/resources">Go to Resources</Link>
          </p>
        )}
      </article>
    </main>
  );
}
