import { describe, expect, it } from "vitest";
import { cloudflareMetrics, MetricsError } from "~/lib/cloudflare-metrics.server";

const env = { CLOUDFLARE_ACCOUNT_ID: "acc123", WORKER_NAME: "naisema-staging" } as unknown as Env;

type Sent = { url: string; init?: RequestInit };

/** Stands in for Cloudflare's API: answers each request with the next reply, and keeps what was sent. */
function cloudflare(...replies: Response[]) {
  const sent: Sent[] = [];
  const send = async (url: string, init?: RequestInit) => {
    sent.push({ url, init });
    return replies.shift() ?? new Response("{}", { status: 500 });
  };
  return { sent, metrics: cloudflareMetrics(env, "token-1", send) };
}

const graphql = (account: Record<string, unknown>) => Response.json({ data: { viewer: { accounts: [account] } } });
const queryOf = (sent: Sent) => (JSON.parse(String(sent.init?.body)) as { query: string }).query;

describe("Cloudflare's figures", () => {
  it("reads how many requests this Worker had in the window", async () => {
    const { sent, metrics } = cloudflare(
      graphql({ workersInvocationsAdaptive: [{ sum: { requests: 900 } }, { sum: { requests: 100 } }] }),
    );
    const counts = await metrics.workerRequests(new Date("2026-10-05T09:05:00Z"), new Date("2026-10-05T10:05:00Z"));
    expect(counts).toBe(1_000);
    expect(sent[0].url).toBe("https://api.cloudflare.com/client/v4/graphql");
    expect(new Headers(sent[0].init?.headers).get("Authorization")).toBe("Bearer token-1");
    const query = queryOf(sent[0]);
    expect(query).toContain('accountTag: "acc123"');
    expect(query).toContain('scriptName: "naisema-staging"');
    expect(query).toContain('datetime_geq: "2026-10-05T09:05:00.000Z"');
    expect(query).toContain('datetime_lt: "2026-10-05T10:05:00.000Z"');
  });

  it("reads Stream storage and delivery, and the latest size of each R2 bucket", async () => {
    const { sent, metrics } = cloudflare(
      Response.json({ success: true, result: { totalStorageMinutes: 321.5, videoCount: 4 } }),
      graphql({
        streamMinutesViewedAdaptiveGroups: [{ sum: { minutesViewed: 40 } }, { sum: { minutesViewed: 2 } }],
        r2StorageAdaptiveGroups: [
          { max: { payloadSize: 3_000, metadataSize: 10 }, dimensions: { bucketName: "media", datetime: "b" } },
          { max: { payloadSize: 500, metadataSize: 0 }, dimensions: { bucketName: "masters", datetime: "b" } },
          { max: { payloadSize: 2_000, metadataSize: 10 }, dimensions: { bucketName: "media", datetime: "a" } },
        ],
      }),
    );
    const usage = await metrics.mediaUsage(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-05T10:00:00Z"));
    expect(usage).toEqual({ storedMinutes: 321.5, deliveredMinutes: 42, r2Bytes: 3_510 });
    expect(sent[0].url).toBe("https://api.cloudflare.com/client/v4/accounts/acc123/stream/storage-usage");
    expect(queryOf(sent[1])).toContain('date_geq: "2026-10-01", date_leq: "2026-10-05"');
  });

  it("says when the token is refused", async () => {
    const { metrics } = cloudflare(new Response("{}", { status: 403 }));
    await expect(metrics.workerRequests(new Date(), new Date())).rejects.toThrow(
      new MetricsError(
        "Cloudflare refused MONITORING_API_TOKEN. Check it is current and allows Account Analytics: Read and Stream: Read.",
      ),
    );
  });

  it("passes on what GraphQL objected to", async () => {
    const { metrics } = cloudflare(Response.json({ data: null, errors: [{ message: "unknown field" }] }));
    await expect(metrics.workerRequests(new Date(), new Date())).rejects.toThrow(
      "Cloudflare answered 200: unknown field.",
    );
  });
});
