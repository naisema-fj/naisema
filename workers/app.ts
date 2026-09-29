import { createRequestHandler, RouterContextProvider } from "react-router";
import { AUTH_BASE_PATH, createAuth } from "~/lib/auth.server";
import { cloudflareContext } from "~/lib/cloudflare";

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Paths that exist only on the staff admin host (ADR-0005). */
function isAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin.data" ||
    pathname.startsWith(`${AUTH_BASE_PATH}/`)
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const onAdminHost = url.hostname === env.ADMIN_HOSTNAME;

    if (isAdminPath(url.pathname) && !onAdminHost) {
      return new Response("Not found", { status: 404 });
    }
    if (onAdminHost) {
      if (!SAFE_METHODS.has(request.method) && request.headers.get("Origin") !== url.origin) {
        return new Response("Cross-site request refused", { status: 403 });
      }
      if (url.pathname.startsWith(`${AUTH_BASE_PATH}/`)) {
        return createAuth(env, request).handler(request);
      }
      if (!isAdminPath(url.pathname) && !url.pathname.startsWith("/__manifest")) {
        return Response.redirect(new URL("/admin", url), 302);
      }
    }

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
