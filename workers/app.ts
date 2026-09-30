import { createRequestHandler, RouterContextProvider } from "react-router";
import { AUTH_BASE_PATH, createAuth } from "~/lib/auth.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { sendExpiryWarnings } from "~/lib/rights-expiry.server";

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The only Better Auth endpoint a browser may call directly: the emailed sign-in link.
 * Everything else (sending links, TOTP enrolment and checks, sign-out) is called server-side by
 * the staff gate's own pages. Exposing the rest would let a magic-link-only session switch off
 * two-factor or guess codes without the staff gate's attempt limit (ADR-0013).
 */
const PUBLIC_AUTH_ENDPOINTS = new Set([`GET ${AUTH_BASE_PATH}/magic-link/verify`]);

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
    const path = routingPath(url.pathname);
    if (path === null) return new Response("Bad request", { status: 400 });

    if (isAdminPath(path) && !onAdminHost) {
      return new Response("Not found", { status: 404 });
    }
    if (onAdminHost) {
      if (!SAFE_METHODS.has(request.method) && request.headers.get("Origin") !== url.origin) {
        return new Response("Cross-site request refused", { status: 403 });
      }
      if (url.pathname.startsWith(`${AUTH_BASE_PATH}/`)) {
        if (!PUBLIC_AUTH_ENDPOINTS.has(`${request.method} ${url.pathname}`)) {
          return new Response("Not found", { status: 404 });
        }
        return createAuth(env, request).handler(request);
      }
      if (!isAdminPath(path) && !path.startsWith("/__manifest")) {
        return Response.redirect(new URL("/admin", url), 302);
      }
    }

    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },

  /** The daily cron (wrangler.jsonc triggers): Rights Record expiry warnings. */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(sendExpiryWarnings(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
