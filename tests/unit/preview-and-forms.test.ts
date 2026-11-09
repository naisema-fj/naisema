import { describe, expect, it } from "vitest";
import { FORMS, NOTICE, readForm } from "~/lib/forms";
import { PREVIEW_DAYS, previewToken, readPreviewToken } from "~/lib/preview.server";

describe("preview links", () => {
  it("show one Revision for 14 days, and nothing once altered or expired", async () => {
    const now = Date.parse("2026-11-09T00:00:00Z");
    const { token, expiresAt } = await previewToken("secret", "revision-1", now);
    expect(expiresAt.getTime()).toBe(now + PREVIEW_DAYS * 86_400_000);
    expect(await readPreviewToken("secret", token, now)).toEqual({ ok: true, revisionId: "revision-1", expiresAt });
    expect(await readPreviewToken("another-secret", token, now)).toEqual({ ok: false, reason: "invalid" });
    const [, expires, signature] = token.split(".");
    expect(await readPreviewToken("secret", `revision-2.${expires}.${signature}`, now)).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await readPreviewToken("secret", token, expiresAt.getTime() + 1)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("public forms", () => {
  it("need the notice agreed to, and a name and address when a reply is needed", () => {
    expect(readForm(FORMS.enquiry, { message: "Bula" })).toEqual({
      ok: false,
      errors: {
        name: "Enter your name.",
        email: "Enter your email address, so we can reply.",
        notice: "Tick the box to say you've read how we keep what you send.",
      },
    });
    expect(
      readForm(FORMS.enquiry, { name: " Mere ", email: "Mere@Example.org", message: " Bula ", notice: NOTICE.version }),
    ).toEqual({ ok: true, values: { name: "Mere", email: "mere@example.org", message: "Bula" } });
  });

  it("let a report be anonymous", () => {
    expect(
      readForm(FORMS.report, { address: "/voices/talanoa", message: "This uses my song.", notice: NOTICE.version }),
    ).toEqual({ ok: true, values: { address: "/voices/talanoa", message: "This uses my song." } });
  });
});
