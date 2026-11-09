import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { logError, logInfo } from "~/lib/log.server";

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The path as React Router will match it (percent-decoded, case-insensitive), so the host
 * boundary can't be dodged with /Admin or /%61dmin. Null when the path can't be decoded.
 */
function routingPath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname).toLowerCase();
  } catch {
    return null;
  }
}

/** Paths that exist only on the staff admin host, where staff sign in (ADR-0016). */
const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/") || path === "/admin.data";

/**
 * Each request as one redacted log line (method, path without its query, status, time), standing
 * in for Workers' own invocation logs, which are off because they record full URLs and visitors'
 * addresses (wrangler.jsonc, `observability`).
 */
async function logged(request: Request, handle: () => Promise<Response>) {
  const started = Date.now();
  const line = { method: request.method, path: new URL(request.url).pathname };
  try {
    const response = await handle();
    logInfo("Request", { ...line, status: response.status, ms: Date.now() - started });
    return response;
  } catch (error) {
    logError("Request failed", { ...line, ms: Date.now() - started, error });
    throw error;
  }
}

/** Sends a request to the staff site or the public site, never one to the other's paths. */
async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const onAdminHost = url.hostname === env.ADMIN_HOSTNAME;
  const path = routingPath(url.pathname);
  if (path === null) return new Response("Bad request", { status: 400 });
  if (isAdminPath(path) && !onAdminHost) return new Response("Not found", { status: 404 });
  if (onAdminHost) {
    if (!SAFE_METHODS.has(request.method) && request.headers.get("Origin") !== url.origin) {
      return new Response("Cross-site request refused", { status: 403 });
    }
    if (!isAdminPath(path) && !path.startsWith("/__manifest") && !path.startsWith("/media/")) {
      return Response.redirect(new URL("/admin", url), 302);
    }
  }
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  return requestHandler(request, context);
}

export default {
  fetch(request, env, ctx) {
    return logged(request, () => route(request, env, ctx));
  },
} satisfies ExportedHandler<Env>;
