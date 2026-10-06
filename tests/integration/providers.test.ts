import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { articleForm, post, type Staff, staff, topic } from "./support/articles";

const PUBLIC = "https://naisema.test";
const visit = (path: string) => SELF.fetch(`${PUBLIC}${path}`, { redirect: "manual" });
const read = async (path: string) => (await visit(path)).text();
const word = () => `w${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

/** Adds a Provider through the staff form; listed unless `listed` is "". */
async function addProvider(editor: Staff, fields: Record<string, string> = {}) {
  const response = await editor.browser.fetch("/admin/providers/new", {
    form: { name: `Lami Language School ${word()}`, lastCheckedOn: "2026-09-30", listed: "on", ...fields },
  });
  const id = response.headers.get("Location")?.split("/").at(-1);
  if (!id || response.status !== 302) throw new Error(`Not added (${response.status}): ${await response.text()}`);
  const row = await env.DB.prepare("SELECT slug FROM provider WHERE id = ?1").bind(id).first<{ slug: string }>();
  return { id, path: `/connect/providers/${row?.slug}` };
}

const offeringFields = {
  title: "Conversational Fijian, evenings",
  languageVariety: "Standard Fijian",
  format: "online",
  costKind: "paid",
  costAmount: "120",
  costCurrency: "AUD",
  accessMode: "external_link",
  accessUrl: "https://lami.example/enrol",
  listed: "on",
};

const addOffering = (editor: Staff, providerId: string, fields: Record<string, string> = {}) =>
  editor.browser.fetch(`/admin/providers/${providerId}/offerings/new`, { form: { ...offeringFields, ...fields } });

const recordAgreement = (editor: Staff, providerId: string, fields: Record<string, string> = {}) =>
  editor.browser.fetch(`/admin/providers/${providerId}`, {
    form: { intent: "agreement", reference: "MOU, founder's files", startsOn: "2026-01-01", ...fields },
  });

describe("Providers (PART-01)", () => {
  it("are listed with what is known, saying plainly what isn't, and with no implied endorsement", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { path } = await addProvider(editor, { name: "Lami Language School", description: "Evening classes." });

    const page = await read(path);

    expect(page).toContain('<h1 id="provider-heading">Lami Language School</h1>');
    expect(page).toContain("Evening classes.");
    expect(page).toContain("<dd>Not known</dd>");
    expect(page).toContain("doesn&#x27;t mean a partnership or that NAISEMA endorses them");
    expect(page).not.toContain("A NAISEMA Partner");
    expect(await read("/connect/providers")).toContain(`href="${path}"`);
  });

  it("aren't shown until listed, and only editors keep them", async () => {
    const editor = await staff("editor", { role: "editor" });
    const educator = await staff("educator", { role: "educator" });
    const { id, path } = await addProvider(editor, { listed: "" });

    expect((await visit(path)).status).toBe(404);
    expect((await educator.browser.fetch(`/admin/providers/${id}`)).status).toBe(403);
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_event WHERE object_id = ?1 AND action = 'provider.created'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(audit?.n).toBe(1);
  });
});

describe("Offerings (PART-02)", () => {
  it("show every fact, the cost and where their link goes before it is followed", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, path } = await addProvider(editor);
    expect((await addOffering(editor, id)).status).toBe(302);

    const page = await read(path);

    expect(page).toContain("Conversational Fijian, evenings");
    expect(page).toContain("AUD 120");
    expect(page).toContain("Online, live");
    expect(page).toContain('href="https://lami.example/enrol"');
    expect(page).toContain("lami.example, another website");
    expect(page).toContain("<dt>Level</dt><dd>Not known</dd>");
  });

  it("can be narrowed by format, cost, access and language, on a page that is never cached", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const { id } = await addProvider(editor, { contactRoute: "Email enrol@lami.example" });
    await addOffering(editor, id, { title: `Online paid ${term}` });
    await addOffering(editor, id, {
      title: `In person free ${term}`,
      format: "in_person",
      costKind: "free",
      accessMode: "enquiry",
      accessUrl: "",
    });

    const free = await visit(`/connect/offerings?cost=free&format=in_person`);
    const text = await free.text();

    expect(free.headers.get("Cache-Control")).toBe("no-store");
    expect(text).toContain(`In person free ${term}`);
    expect(text).not.toContain(`Online paid ${term}`);
    expect(text).toContain('content="noindex"');
    expect(text).toContain("Email enrol@lami.example");
    expect(await read(`/connect/offerings?language=standard`)).toContain(`Online paid ${term}`);
  });
});

describe("Partners, sponsorship and features (PART-03, PUB-04)", () => {
  it("show 'Partner' only while a recorded Partnership Agreement is in force", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, path } = await addProvider(editor);

    expect((await recordAgreement(editor, id, { startsOn: "2027-01-01" })).status).toBe(302);
    expect(await read(path)).not.toContain("A NAISEMA Partner");

    expect((await recordAgreement(editor, id)).status).toBe(302);
    expect(await read(path)).toContain("A NAISEMA Partner");

    const agreement = await env.DB.prepare(
      "SELECT id FROM partnership_agreement WHERE provider_id = ?1 AND starts_on = '2026-01-01'",
    )
      .bind(id)
      .first<{ id: string }>();
    await editor.browser.fetch(`/admin/providers/${id}`, {
      form: { intent: "endAgreement", agreementId: agreement?.id as string },
    });
    expect(await read(path)).not.toContain("A NAISEMA Partner");
  });

  it("only let a Partner's Offering be shown or hosted on NAISEMA, and hide it when the partnership ends", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, path } = await addProvider(editor);
    const embed = {
      title: "Embedded course",
      accessMode: "authorised_embed",
      accessUrl: "https://lami.example/course",
    };

    const refused = await addOffering(editor, id, embed);
    expect(refused.status).toBe(400);
    expect(await refused.text()).toContain("Only a Partner");

    await recordAgreement(editor, id);
    expect((await addOffering(editor, id, embed)).status).toBe(302);
    expect(await read(path)).toContain("Shown with");

    const agreement = await env.DB.prepare("SELECT id FROM partnership_agreement WHERE provider_id = ?1")
      .bind(id)
      .first<{ id: string }>();
    await editor.browser.fetch(`/admin/providers/${id}`, {
      form: { intent: "endAgreement", agreementId: agreement?.id as string },
    });
    expect(await read(path)).not.toContain("Embedded course");
  });

  it("disclose sponsorship, and feature a listing only with the reason, shown on Connect", async () => {
    const editor = await staff("editor", { role: "editor" });
    const term = word();
    const { id } = await addProvider(editor, { name: `Sponsored school ${term}`, sponsoredBy: "Vodafone Fiji" });

    const noReason = await addOffering(editor, id, { title: `Featured course ${term}`, featured: "on" });
    expect(noReason.status).toBe(400);
    expect(await noReason.text()).toContain("Say why it is featured");

    await addOffering(editor, id, {
      title: `Featured course ${term}`,
      featured: "on",
      featureRationale: "Free evening classes for beginners abroad.",
    });

    const connect = await read("/connect");
    expect(connect).toContain(`Featured course ${term}, from Sponsored school ${term}`);
    expect(connect).toContain("Why: Free evening classes for beginners abroad.");
    expect(connect).toContain("Sponsored by Vodafone Fiji.");
    expect(connect).toContain('href="/connect/offerings"');
  });
});

describe("Keeping Connect's pages current", () => {
  it("purges the sitemap when a Provider is listed or unlisted, and narrows Providers by kind", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, path } = await addProvider(editor, { organisationType: "church" });
    expect(await read("/sitemap.xml")).toContain(path);
    expect(await read("/connect/providers?kind=church")).toContain(`href="${path}"`);
    expect(await read("/connect/providers?kind=university")).not.toContain(`href="${path}"`);

    await editor.browser.fetch(`/admin/providers/${id}`, {
      form: { intent: "provider", name: "Unlisted now", lastCheckedOn: "2026-09-30" },
    });

    expect(await read("/sitemap.xml")).not.toContain(path);
  });

  it("says when the NAISEMA item an Offering is on is no longer public", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id, path } = await addProvider(editor);
    await recordAgreement(editor, id);
    const article = await post(
      editor,
      "/admin/articles/new",
      articleForm(await topic(editor), { flag: [], languageVariety: "", title: "Hosted lesson" }),
    );
    const itemId = article.headers.get("Location")?.split("/").at(-1) as string;
    expect(
      (await addOffering(editor, id, { accessMode: "licensed_native", accessUrl: "", accessContentItemId: itemId }))
        .status,
    ).toBe(302);

    expect(await read(path)).toContain("It isn&#x27;t available on NAISEMA right now.");
  });

  it("keeps a refused agreement's values, and won't end one that isn't this Provider's", async () => {
    const editor = await staff("editor", { role: "editor" });
    const { id } = await addProvider(editor);

    const refused = await recordAgreement(editor, id, { reference: "Kept in the office", startsOn: "2026-13-45" });
    const text = await refused.text();
    expect(refused.status).toBe(400);
    expect(text).toContain('value="Kept in the office"');

    const ended = await editor.browser.fetch(`/admin/providers/${id}`, {
      form: { intent: "endAgreement", agreementId: crypto.randomUUID() },
    });
    expect(ended.status).toBe(400);
  });
});

describe("Connect's own addresses", () => {
  it("can't be taken by an item in Connect", async () => {
    const editor = await staff("editor", { role: "editor" });
    const response = await post(
      editor,
      "/admin/articles/new",
      articleForm(await topic(editor), { flag: [], languageVariety: "", title: "Providers", primaryArea: "connect" }),
    );
    const id = response.headers.get("Location")?.split("/").at(-1);
    const row = await env.DB.prepare("SELECT slug FROM content_item WHERE id = ?1").bind(id).first<{ slug: string }>();

    expect(row?.slug).not.toBe("providers");
  });
});
