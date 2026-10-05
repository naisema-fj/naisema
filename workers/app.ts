import { createRequestHandler, RouterContextProvider } from "react-router";
import { AUTH_BASE_PATH, createAuth, createLearnerAuth, LEARNER_AUTH_BASE_PATH } from "~/lib/auth.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { platformMetrics } from "~/lib/cloudflare-metrics.server";
import { getDb } from "~/lib/db.server";
import { handleInactiveLearners, tidyLearnerRecords } from "~/lib/learner-records.server";
import { logError, logInfo } from "~/lib/log.server";
import type { ScanMessage } from "~/lib/media.server";
import { recordServerError, runJob, runMonitor } from "~/lib/monitor.server";
import { servePublic } from "~/lib/public-cache.server";
import { sendExpiryWarnings } from "~/lib/rights-expiry.server";
import { DAY_MS } from "~/lib/rights-rules";
import { containerScanner, handleScanBatch, tidyQuarantine } from "~/lib/scan.server";
import { reindexExpiredRights } from "~/lib/search.server";
import { recordUsage } from "~/lib/usage.server";
import { refreshStalledVideos } from "~/lib/video-assets.server";
import { videoProvider } from "~/lib/video-provider.server";

export { Scanner } from "./scanner";

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

/** The crons, as wrangler.jsonc `triggers` lists them. */
const DAILY_CRON = "45 19 * * *";
const MONITOR_CRON = "5 * * * *";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The only Better Auth endpoint a browser may call directly: the emailed sign-in link.
 * Everything else (sending links, TOTP enrolment and checks, sign-out) is called server-side by
 * the staff gate's own pages. Exposing the rest would let a magic-link-only session switch off
 * two-factor or guess codes without the staff gate's attempt limit (ADR-0013).
 */
const PUBLIC_AUTH_ENDPOINTS = new Set([`GET ${AUTH_BASE_PATH}/magic-link/verify`]);

/** Likewise for Learner Accounts on the public site: only the emailed link (app/lib/learners.server.ts). */
const LEARNER_AUTH_LINK = `${LEARNER_AUTH_BASE_PATH}/magic-link/verify`;

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

/**
 * Each request as one redacted log line (method, path without its query or tokens, status, time),
 * standing in for Workers' own invocation logs, which are off because they record full URLs and
 * visitors' addresses (wrangler.jsonc, `observability`). Server errors are also counted for the
 * monitor's error rate.
 */
async function logged(request: Request, env: Env, ctx: ExecutionContext, handle: () => Promise<Response>) {
  const started = Date.now();
  const line = { method: request.method, path: new URL(request.url).pathname };
  try {
    const response = await handle();
    logInfo("Request", { ...line, status: response.status, ms: Date.now() - started });
    if (response.status >= 500) ctx.waitUntil(recordServerError(env));
    return response;
  } catch (error) {
    logError("Request failed", { ...line, ms: Date.now() - started, error });
    ctx.waitUntil(recordServerError(env));
    throw error;
  }
}

/** Sends a request to the staff site, Better Auth's one public endpoint, or the public site. */
async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

  if (!onAdminHost && (path === LEARNER_AUTH_BASE_PATH || path.startsWith(`${LEARNER_AUTH_BASE_PATH}/`))) {
    if (request.method !== "GET" || url.pathname !== LEARNER_AUTH_LINK)
      return new Response("Not found", { status: 404 });
    return createLearnerAuth(env, request).handler(request);
  }

  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx });
  if (onAdminHost) return requestHandler(request, context);
  return servePublic(request, env, ctx, () => requestHandler(request, context));
}

export default {
  fetch(request, env, ctx) {
    return logged(request, env, ctx, () => route(request, env, ctx));
  },

  /**
   * The crons (wrangler.jsonc triggers). Hourly: the monitor (app/lib/monitor.server.ts).
   * Daily, as one recorded job the monitor watches: Rights Record expiry warnings, then
   * reindexing items whose rights expired in the last two days (overlapping, in case a run was
   * missed). Then the quarantine is tidied: old failures removed, abandoned uploads dropped and
   * lost scans queued again. Then videos whose processing report never came are asked about, and
   * masters never sent are sent. Last, Learner Accounts: old event IDs and link counts are
   * forgotten, and inactive accounts are warned or deleted (app/lib/learner-records.server.ts).
   * Then, as its own job so a problem reading Cloudflare's figures doesn't hide how the daily job
   * went, the month's media usage is recorded (VAC-10). Awaited, so a failed run shows as failed.
   */
  async scheduled(controller, env) {
    const now = new Date(controller.scheduledTime);
    const db = getDb(env.DB);
    if (controller.cron === MONITOR_CRON) {
      await runMonitor(env, now);
    } else if (controller.cron === DAILY_CRON) {
      const daily = runJob(db, "daily", now, async () => {
        await sendExpiryWarnings(env, now);
        await reindexExpiredRights(db, new Date(now.getTime() - 2 * DAY_MS), now);
        await tidyQuarantine(env, db, now);
        await refreshStalledVideos(db, videoProvider(env), now);
        await tidyLearnerRecords(db, now);
        await handleInactiveLearners(env, db, now);
      });
      const usage = runJob(db, "usage", now, () => recordUsage(env, db, platformMetrics(env), now));
      const failed = (await Promise.allSettled([daily, usage])).flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failed.length) throw new AggregateError(failed, "The daily crons failed");
    } else {
      throw new Error(`No job for cron "${controller.cron}"`);
    }
  },

  /** Upload scans (ADR-0010): each finished upload is scanned by ClamAV before it leaves quarantine. */
  async queue(batch, env) {
    await handleScanBatch(batch as MessageBatch<ScanMessage>, env, containerScanner(env));
  },
} satisfies ExportedHandler<Env>;
