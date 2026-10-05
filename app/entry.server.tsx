import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext, HandleErrorFunction, RouterContextProvider } from "react-router";
import { isRouteErrorResponse, ServerRouter } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { logError } from "~/lib/log.server";
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
          logError("Render failed", { path: new URL(request.url).pathname, error });
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
    // Staff pages are never indexed, whatever the environment.
    const onAdminHost = new URL(request.url).hostname === env.ADMIN_HOSTNAME;
    applySecurityHeaders(responseHeaders, hydrates(routerContext) ? nonce : null, {
      allowIndexing: env.ALLOW_INDEXING === "true" && !onAdminHost,
      turnstile: leafHandle(routerContext)?.turnstile === true,
      video: leafHandle(routerContext)?.video === true ? { origin: videoPlaybackOrigin(env) } : null,
    });
  }
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}

/**
 * Errors thrown by loaders, actions and the shell render, logged as React Router would by
 * default, but redacted (app/lib/log.server.ts). Requests the visitor abandoned aren't failures.
 */
export const handleError: HandleErrorFunction = (error, { request }) => {
  if (request.signal.aborted) return;
  logError("Request handling failed", {
    path: new URL(request.url).pathname,
    // A 4xx React Router made from a thrown error carries that error (ErrorResponseImpl.error).
    error: isRouteErrorResponse(error) ? ((error as { error?: unknown }).error ?? error) : error,
  });
};

/**
 * The page's own route `handle`: `hydrate: false` (root.tsx), `turnstile: true` for a public form,
 * `video: true` for a page that plays video or reads a video file's length.
 */
function leafHandle(context: EntryContext) {
  const leaf = context.staticHandlerContext.matches.at(-1);
  return leaf
    ? (context.routeModules[leaf.route.id]?.handle as
        | { hydrate?: boolean; turnstile?: boolean; video?: boolean }
        | undefined)
    : undefined;
}

/** Whether the page will load client JavaScript: routes opt out with `handle = { hydrate: false }`. */
function hydrates(context: EntryContext) {
  return leafHandle(context)?.hydrate !== false;
}
