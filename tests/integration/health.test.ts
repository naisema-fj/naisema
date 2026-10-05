import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// What the external uptime monitor requests (ADR-0012; docs/handover/runbook.md).
describe("the health check", () => {
  it("answers from the Worker and its database, never from a cache", async () => {
    const response = await SELF.fetch("https://naisema.test/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("ok\n");
  });
});
