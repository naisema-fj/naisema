import { cloudflareContext } from "~/lib/cloudflare";
import { publicHeaders } from "~/lib/http";
import type { Route } from "./+types/newsletter";

export const handle = { hydrate: false };
export const headers = publicHeaders;

/**
 * GET /newsletter: a link to Buttondown's own sign-up page, which confirms by email and handles unsubscribing
 * (ADR-0015). NAISEMA keeps no list of its own. Until the form address is set, the page says the
 * newsletter isn't open yet (PUB-01).
 */
export function loader({ context }: Route.LoaderArgs) {
  const url = context.get(cloudflareContext).env.NEWSLETTER_FORM_URL;
  return { formUrl: /^https:\/\/buttondown\.com\//.test(url) ? url : null };
}

export function meta() {
  return [{ title: "Newsletter · NAISEMA" }];
}

export default function Newsletter({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main">
      <article className="pane pane-narrow">
        <h1>Newsletter</h1>
        <p className="standfirst">News of new stories, recordings, classes and consultations, now and then.</p>
        {loaderData.formUrl ? (
          <>
            <p>
              The newsletter is sent by Buttondown, which emails you to confirm before anything is sent. Every issue has
              a link to stop it.
            </p>
            <p>
              <a className="primary-link" href={loaderData.formUrl} rel="external noopener">
                Sign up on Buttondown
              </a>{" "}
              (another website)
            </p>
          </>
        ) : (
          <p className="not-open">
            <span className="from-label">Not open yet</span> The newsletter starts soon. Until then, new pieces appear on
            the home page.
          </p>
        )}
      </article>
    </main>
  );
}
