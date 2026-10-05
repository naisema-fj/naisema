import { describe, expect, it } from "vitest";
import { redact } from "~/lib/log.server";

// What may reach Workers Logs (#20): personal details, form bodies and tokens never do.
describe("redact", () => {
  it("replaces email addresses", () => {
    expect(redact("Case email to sera.vula+cases@example.com failed")).toBe("Case email to [email] failed");
  });

  it("replaces the tokens in link paths, keeping the route", () => {
    expect(redact("/consent/4f0c2a.Xk3vQ9pL2mN8rT5wY7zA1bC4dE6fG8hJ0kL2mN4pQ6s")).toBe("/consent/[token]");
    expect(redact("/upload/Xk3vQ9pL2mN8rT5wY7zA1bC4dE6fG8hJ0kL2mN4pQ6s/files/abc/parts/2")).toBe(
      "/upload/[token]/files/abc/parts/2",
    );
    expect(redact("/cases/appeal/a1b2c3")).toBe("/cases/appeal/[token]");
  });

  it("replaces long random tokens wherever they appear", () => {
    expect(redact("bad signature Xk3vQ9pL2mN8rT5wY7zA1bC4dE6fG8hJ0kL2mN4pQ6s")).toBe("bad signature [token]");
  });

  it("drops query strings, which carry search words and playback tokens", () => {
    expect(redact("GET https://naisema.com/search?q=bula+vinaka&area=learn")).toBe(
      "GET https://naisema.com/search?[query]",
    );
    expect(redact("/admin/media/v1/video/master?token=abc.def")).toBe("/admin/media/v1/video/master?[query]");
  });

  it("keeps record IDs and slugs, which are what troubleshooting needs", () => {
    const id = "0f8e2a64-9b1c-4c55-9a51-6f2d1f0b7e3a";
    expect(redact(`Upload scan failed ${id}`)).toBe(`Upload scan failed ${id}`);
    expect(redact("/learn/how-to-greet-your-elders-in-standard-fijian")).toBe(
      "/learn/how-to-greet-your-elders-in-standard-fijian",
    );
  });

  it("withholds values under keys that hold personal details, secrets or bodies", () => {
    expect(
      redact({
        assetId: "a1",
        email: "x",
        to: "sera@example.com",
        name: "Sera Vula",
        password: "p",
        authorization: "Bearer abc",
        body: "form text",
        nested: { token: "t", attempts: 2 },
      }),
    ).toEqual({
      assetId: "a1",
      email: "[redacted]",
      to: "[redacted]",
      name: "[redacted]",
      password: "[redacted]",
      authorization: "[redacted]",
      body: "[redacted]",
      nested: { token: "[redacted]", attempts: 2 },
    });
  });

  it("never logs a request, form or headers object", () => {
    const form = new FormData();
    form.set("message", "my story");
    expect(redact({ form, request: new Request("https://naisema.com/report", { method: "POST" }) })).toEqual({
      form: "[redacted]",
      request: "[redacted]",
    });
    expect(redact(new Headers({ cookie: "session=abc" }))).toBe("[redacted]");
  });

  it("keeps an error's kind, and its message and stack with the same redaction", () => {
    const error = new TypeError("No user sera@example.com");
    const logged = redact(error) as { name: string; message: string; stack: string };
    expect(logged.name).toBe("TypeError");
    expect(logged.message).toBe("No user [email]");
    expect(logged.stack).not.toContain("sera@example.com");
  });

  it("follows an error's cause and an aggregate's errors", () => {
    const error = new AggregateError([new Error("to a@b.fj")], "2 failed", { cause: new Error("c@d.fj") });
    expect(redact(error)).toMatchObject({
      message: "2 failed",
      errors: [{ message: "to [email]" }],
      cause: { message: "[email]" },
    });
  });
});
