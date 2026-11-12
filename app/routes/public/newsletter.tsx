import { Bell, ExternalLink } from "lucide-react";
import { Icon } from "~/components/icons";
import { BackLink, NotOpen, PageHead } from "~/components/public/parts";
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
        <BackLink to="/">Home</BackLink>
        <PageHead
          tone="none"
          icon={Bell}
          title="Newsletter"
          plate={<p className="lede">News of new stories, recordings, classes and consultations, now and then.</p>}
        />
        {loaderData.formUrl ? (
          <>
            <p>
              The newsletter is sent by Buttondown, which emails you to confirm before anything is sent. Every issue has
              a link to stop it.
            </p>
            <p>
              <a className="button" href={loaderData.formUrl} rel="external noopener">
                <Icon icon={ExternalLink} size={18} />
                Sign up on Buttondown
              </a>{" "}
              (another website)
            </p>
          </>
        ) : (
          <NotOpen>The newsletter starts soon. Until then, new pieces appear on the home page.</NotOpen>
        )}
      </article>
    </main>
  );
}
