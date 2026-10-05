import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext, RouterContextProvider } from "react-router";
import { ServerRouter } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { pageHydrates, pagePlaysVideo, type RouteHandle } from "~/lib/route-handle";
import { createNonce, NonceContext } from "~/lib/security-headers";
import { applySecurityHeaders } from "~/lib/security-policy";
import { videoPlaybackOrigin } from "~/lib/video-provider.server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  const nonce = createNonce();

  const body = await renderToReadableStream(
    <NonceContext value={nonce}>
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
    </NonceContext>,
    {
      nonce,
      onError(error: unknown) {
        responseStatusCode = 500;
        // Errors during the initial shell render reject and are logged by React Router.
        if (shellRendered) {
          console.error(error);
        }
      },
    },
  );
  shellRendered = true;

  // Crawlers wait for all content before the response is sent.
  if (userAgent && isbot(userAgent)) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  // Vite's dev server injects its own inline scripts, so the policy applies to builds only.
  if (!import.meta.env.DEV) {
    const { env } = loadContext.get(cloudflareContext);
    // Staff pages, and pages that say so (Review Links), are never indexed, whatever the environment.
    const onAdminHost = new URL(request.url).hostname === env.ADMIN_HOSTNAME;
    applySecurityHeaders(responseHeaders, hydrates(routerContext) ? nonce : null, {
      allowIndexing: env.ALLOW_INDEXING === "true" && !onAdminHost && leafHandle(routerContext)?.noindex !== true,
      turnstile: leafHandle(routerContext)?.turnstile === true,
      video: pagePlaysVideo(leafHandle(routerContext), leafData(routerContext))
        ? { origin: videoPlaybackOrigin(env) }
        : null,
    });
  }
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}

/** The page's own route `handle` (app/lib/route-handle.ts). */
function leafHandle(context: EntryContext) {
  const leaf = context.staticHandlerContext.matches.at(-1);
  return leaf ? (context.routeModules[leaf.route.id]?.handle as RouteHandle | undefined) : undefined;
}

/** The page's own loader data, which a handle can depend on. */
function leafData(context: EntryContext) {
  const leaf = context.staticHandlerContext.matches.at(-1);
  return leaf ? context.staticHandlerContext.loaderData[leaf.route.id] : undefined;
}

/** Whether the page will load client JavaScript: routes opt out with `handle = { hydrate: false }`. */
function hydrates(context: EntryContext) {
  return pageHydrates(leafHandle(context), leafData(context));
}
