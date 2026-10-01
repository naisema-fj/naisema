import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { EntryContext, RouterContextProvider } from "react-router";
import { ServerRouter } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { applySecurityHeaders, createNonce, NonceContext } from "~/lib/security-headers";

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
    // Staff pages are never indexed, whatever the environment.
    const onAdminHost = new URL(request.url).hostname === env.ADMIN_HOSTNAME;
    applySecurityHeaders(responseHeaders, hydrates(routerContext) ? nonce : null, {
      allowIndexing: env.ALLOW_INDEXING === "true" && !onAdminHost,
    });
  }
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}

/** Whether the page will load client JavaScript: routes opt out with `handle = { hydrate: false }` (root.tsx). */
function hydrates(context: EntryContext) {
  const leaf = context.staticHandlerContext.matches.at(-1);
  const handle = leaf ? (context.routeModules[leaf.route.id]?.handle as { hydrate?: boolean } | undefined) : undefined;
  return handle?.hydrate !== false;
}
