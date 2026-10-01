import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { staff } from "./support/articles";
import { completeUpload, sendPart, startUpload } from "./support/media";
import type { Browser } from "./support/staff";

const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

const scanner =
  (verdict: "clean" | "infected"): Scanner =>
  async ({ body }) => {
    await body.cancel();
    return verdict === "clean" ? { verdict } : { verdict, signature: "Eicar-Test-Signature" };
  };

async function upload(browser: Browser, name: string, type: string, bytes: Uint8Array) {
  const { id } = (await (await startUpload(browser, { name, type, size: bytes.length, head: bytes })).json()) as {
    id: string;
  };
  await sendPart(browser, id, 1, bytes);
  await completeUpload(browser, id);
  return id;
}

describe("the media library", () => {
  it("lists each upload with its type, size, scan state and the reason for a refusal", async () => {
    const educator = await staff("educator", { role: "educator" });
    const clean = await upload(educator.browser, `photo-${crypto.randomUUID()}.png`, "image/png", PNG);
    const infected = await upload(educator.browser, `bad-${crypto.randomUUID()}.png`, "image/png", PNG);
    const waiting = await upload(educator.browser, `later-${crypto.randomUUID()}.png`, "image/png", PNG);
    await scanUpload(env, getDb(env.DB), clean, scanner("clean"));
    await scanUpload(env, getDb(env.DB), infected, scanner("infected"));

    const page = await (await educator.browser.fetch("/admin/media")).text();

    expect(page).toContain("PNG image");
    expect(page).toContain("1 KB");
    expect(page).toContain(`/media/images/${clean}/960`);
    expect(page).toContain("Blocked: a virus was found");
    expect(page).toContain("The virus scanner found Eicar-Test-Signature.");
    expect(page).toContain("Being scanned for viruses");
    expect(page).toContain("Not recorded yet");
    expect(page).not.toContain(`/media/images/${infected}/`);
    expect(page).not.toContain(`/media/images/${waiting}/`);
  });

  it("saves an image's alt text", async () => {
    const editor = await staff("editor", { role: "editor" });
    const id = await upload(editor.browser, "drua.png", "image/png", PNG);
    await scanUpload(env, getDb(env.DB), id, scanner("clean"));

    const response = await editor.browser.fetch("/admin/media", {
      form: { intent: "alt", assetId: id, altText: "A drua under sail off Kadavu" },
    });

    expect(response.status).toBe(200);
    expect(await (await editor.browser.fetch("/admin/media")).text()).toContain("A drua under sail off Kadavu");
  });

  it("is only for editors and Educators", async () => {
    const reviewer = await staff("reviewer", { role: "reviewer", reviewType: "editorial" });

    expect((await reviewer.browser.fetch("/admin/media")).status).toBe(403);
  });
});
