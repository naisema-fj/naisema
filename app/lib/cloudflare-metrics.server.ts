import { DAY_MS } from "./rights-rules";
import { optionalSecret } from "./secrets.server";

/**
 * Cloudflare's own figures for the account (docs/handover/runbook.md, monitoring): this Worker's
 * request count for the monitor's error rate, and media usage for the cost report (VAC-10). Read
 * with MONITORING_API_TOKEN, an API token allowed only Account Analytics: Read and Stream: Read.
 */
export interface PlatformMetrics {
  /** Requests to this Worker from `since` up to `until`. */
  workerRequests(since: Date, until: Date): Promise<number>;
  /** The account's media usage: Stream minutes stored now and delivered this month, and R2 bytes. */
  mediaUsage(monthStart: Date, now: Date): Promise<MediaUsage>;
}

export type MediaUsage = { storedMinutes: number; deliveredMinutes: number; r2Bytes: number };

/** A figure that couldn't be read. Its message is safe to log and to email. */
export class MetricsError extends Error {}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const API = "https://api.cloudflare.com/client/v4";

/** Values go into the query as JSON strings, which GraphQL reads the same way. */
const literal = (value: string) => JSON.stringify(value);
const day = (at: Date) => at.toISOString().slice(0, 10);

/** Cloudflare's GraphQL Analytics API and Stream API, with an injectable fetch for tests. */
export function cloudflareMetrics(env: Env, token: string, send: Fetch = (input, init) => fetch(input, init)) {
  const account = literal(env.CLOUDFLARE_ACCOUNT_ID);

  async function request(url: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await send(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch {
      throw new MetricsError("Cloudflare's API couldn't be reached.");
    }
    const body = (await response.json().catch(() => null)) as {
      data?: unknown;
      result?: unknown;
      errors?: { message?: string }[] | null;
    } | null;
    const problem = body?.errors?.[0]?.message;
    if (!response.ok || problem) {
      throw new MetricsError(
        response.status === 401 || response.status === 403
          ? "Cloudflare refused MONITORING_API_TOKEN. Check it is current and allows Account Analytics: Read and Stream: Read."
          : `Cloudflare answered ${response.status}${problem ? `: ${problem}` : ""}.`,
      );
    }
    return body;
  }

  /** Asks GraphQL for `fields` of this account; returns the account's figures. */
  async function accountFigures(fields: string) {
    const body = await request(`${API}/graphql`, {
      method: "POST",
      body: JSON.stringify({ query: `{ viewer { accounts(filter: { accountTag: ${account} }) { ${fields} } } }` }),
    });
    const found = (body?.data as { viewer?: { accounts?: Record<string, unknown>[] } } | undefined)?.viewer
      ?.accounts?.[0];
    if (!found) throw new MetricsError("Cloudflare's analytics had no figures for this account.");
    return found;
  }

  const sum = <T extends string>(groups: unknown, key: T, field: string) =>
    ((groups as Record<T, Record<string, number>>[] | undefined) ?? []).reduce(
      (total, group) => total + (Number(group[key]?.[field]) || 0),
      0,
    );

  return {
    async workerRequests(since, until) {
      const found = await accountFigures(
        `workersInvocationsAdaptive(limit: 10000, filter: { scriptName: ${literal(env.WORKER_NAME)}, datetime_geq: ${literal(since.toISOString())}, datetime_lt: ${literal(until.toISOString())} }) { sum { requests } }`,
      );
      return sum(found.workersInvocationsAdaptive, "sum", "requests");
    },

    async mediaUsage(monthStart, now) {
      const storage = await request(`${API}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/storage-usage`);
      const storedMinutes = Number(
        (storage?.result as { totalStorageMinutes?: number } | undefined)?.totalStorageMinutes,
      );
      if (!Number.isFinite(storedMinutes)) throw new MetricsError("Stream's storage figures were missing.");

      const found = await accountFigures(
        [
          `streamMinutesViewedAdaptiveGroups(limit: 10000, filter: { date_geq: ${literal(day(monthStart))}, date_leq: ${literal(day(now))} }) { sum { minutesViewed } }`,
          // R2 reports each bucket's size over time; the latest reading of each is what it holds.
          `r2StorageAdaptiveGroups(limit: 1000, filter: { datetime_geq: ${literal(new Date(now.getTime() - DAY_MS).toISOString())}, datetime_leq: ${literal(now.toISOString())} }, orderBy: [datetime_DESC]) { max { payloadSize metadataSize } dimensions { bucketName datetime } }`,
        ].join(" "),
      );
      const latest = new Map<string, number>();
      for (const group of (found.r2StorageAdaptiveGroups as
        | { max?: { payloadSize?: number; metadataSize?: number }; dimensions?: { bucketName?: string } }[]
        | undefined) ?? []) {
        const bucket = group.dimensions?.bucketName ?? "";
        if (!latest.has(bucket)) latest.set(bucket, (group.max?.payloadSize ?? 0) + (group.max?.metadataSize ?? 0));
      }
      return {
        storedMinutes,
        deliveredMinutes: sum(found.streamMinutesViewedAdaptiveGroups, "sum", "minutesViewed"),
        r2Bytes: [...latest.values()].reduce((total, bytes) => total + bytes, 0),
      };
    },
  } satisfies PlatformMetrics;
}

/** This environment's figures, or null where MONITORING_API_TOKEN isn't set (local development and tests). */
export function platformMetrics(env: Env, send?: Fetch): PlatformMetrics | null {
  const token = optionalSecret(env, "MONITORING_API_TOKEN");
  return token ? cloudflareMetrics(env, token, send) : null;
}
