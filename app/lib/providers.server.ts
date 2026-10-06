import { and, asc, eq, like, or } from "drizzle-orm";
import { contentItem, offering, partnershipAgreement, provider } from "~db/schema";
import { auditInsert } from "./audit.server";
import { requireEditor } from "./content.server";
import type { Database } from "./db.server";
import {
  ACCESS_MODES,
  AGE_SUITABILITY,
  type AgreementDetails,
  type AgreementFacts,
  costText,
  FORMATS,
  HANDLED_BY,
  isPartner,
  LEVELS,
  type ListingFlags,
  type OfferingDetails,
  type OfferingFilters,
  type OrganisationType,
  PARTNER_ONLY_MODES,
  type ProviderDetails,
  providerPath,
  sponsorsText,
} from "./listing-fields";
import { eligiblePublished, itemPath } from "./public.server";
import { purgePublicPages } from "./public-cache.server";
import { linkHost } from "./resource-fields";
import { formatDay } from "./rights-rules";
import { firstFreeSlug, slugify } from "./slug";

/**
 * Providers, their Offerings and Partnership Agreements (PART-01–03): plain listings editors keep,
 * audited, not reviewed. Public pages show only what is listed; "Partner" only while an agreement
 * is in force; an Offering shown or hosted on NAISEMA only while its Provider is a Partner.
 */

export type ProviderRow = typeof provider.$inferSelect;
export type OfferingRow = typeof offering.$inferSelect;
export type AgreementRow = typeof partnershipAgreement.$inferSelect;

export type ListingResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> };

/** Every Provider, A to Z, for the staff list. */
export function listProviders(db: Database) {
  return db.select().from(provider).orderBy(asc(provider.name));
}

/** A Provider with its Offerings and Partnership Agreements, for its staff page. */
export async function getProvider(db: Database, id: string) {
  const found = await db.select().from(provider).where(eq(provider.id, id)).get();
  if (!found) return null;
  const [offerings, agreements] = await Promise.all([
    db.select().from(offering).where(eq(offering.providerId, id)).orderBy(asc(offering.title)),
    agreementsOf(db, id),
  ]);
  return { ...found, offerings, agreements };
}

export const getOffering = (db: Database, id: string) => db.select().from(offering).where(eq(offering.id, id)).get();

function agreementsOf(db: Database, providerId: string) {
  return db
    .select()
    .from(partnershipAgreement)
    .where(eq(partnershipAgreement.providerId, providerId))
    .orderBy(asc(partnershipAgreement.startsOn));
}

/** Adds a Provider. Its address comes from its name and stays fixed, so links to it keep working. */
export async function createProvider(
  db: Database,
  actorId: string,
  details: ProviderDetails,
  flags: ListingFlags,
): Promise<ListingResult> {
  const base = slugify(details.name);
  const similar = await db
    .select({ slug: provider.slug })
    .from(provider)
    .where(or(eq(provider.slug, base), like(provider.slug, `${base}-%`)));
  const id = crypto.randomUUID();
  const now = new Date();
  await db.batch([
    db.insert(provider).values({
      id,
      slug: firstFreeSlug(base, new Set(similar.map((row) => row.slug))),
      ...details,
      ...flags,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    }),
    auditInsert(db, { actorId, action: "provider.created", objectType: "provider", objectId: id }),
  ]);
  return { ok: true, id };
}

export async function updateProvider(
  db: Database,
  actorId: string,
  id: string,
  details: ProviderDetails,
  flags: ListingFlags,
): Promise<ListingResult> {
  await db.batch([
    db
      .update(provider)
      .set({ ...details, ...flags, updatedAt: new Date() })
      .where(eq(provider.id, id)),
    auditInsert(db, {
      actorId,
      action: "provider.updated",
      objectType: "provider",
      objectId: id,
      details: { listed: flags.listed, sponsoredBy: flags.sponsoredBy, featured: flags.featureRationale !== null },
    }),
  ]);
  return { ok: true, id };
}

/**
 * Checks what an Offering's access mode depends on: an Offering shown or hosted on NAISEMA needs
 * its Provider to be a Partner, and one hosted on NAISEMA needs the item it is on to exist.
 */
async function accessProblems(db: Database, providerId: string, details: OfferingDetails, now: Date) {
  const errors: Record<string, string> = {};
  if (PARTNER_ONLY_MODES.includes(details.access.mode) && !isPartner(await agreementsOf(db, providerId), now)) {
    errors.accessMode = "Only a Partner's Offering can be shown or hosted on NAISEMA. Record the agreement first.";
  }
  if (details.access.mode === "licensed_native") {
    const item = await db
      .select({ id: contentItem.id })
      .from(contentItem)
      .where(eq(contentItem.id, details.access.contentItemId))
      .get();
    if (!item) errors.accessContentItemId = "That item no longer exists.";
  }
  return errors;
}

const offeringColumns = (details: OfferingDetails) => ({
  ...details,
  costKind: details.cost.kind,
  accessMode: details.access.mode,
});

export async function createOffering(
  db: Database,
  actorId: string,
  providerId: string,
  details: OfferingDetails,
  flags: ListingFlags,
  now = new Date(),
): Promise<ListingResult> {
  const errors = await accessProblems(db, providerId, details, now);
  if (Object.keys(errors).length) return { ok: false, errors };
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(offering).values({
      id,
      providerId,
      ...offeringColumns(details),
      ...flags,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    }),
    auditInsert(db, {
      actorId,
      action: "offering.created",
      objectType: "offering",
      objectId: id,
      details: { providerId },
    }),
  ]);
  return { ok: true, id };
}

export async function updateOffering(
  db: Database,
  actorId: string,
  current: OfferingRow,
  details: OfferingDetails,
  flags: ListingFlags,
  now = new Date(),
): Promise<ListingResult> {
  const errors = await accessProblems(db, current.providerId, details, now);
  if (Object.keys(errors).length) return { ok: false, errors };
  await db.batch([
    db
      .update(offering)
      .set({ ...offeringColumns(details), ...flags, updatedAt: now })
      .where(eq(offering.id, current.id)),
    auditInsert(db, {
      actorId,
      action: "offering.updated",
      objectType: "offering",
      objectId: current.id,
      details: { listed: flags.listed, sponsoredBy: flags.sponsoredBy, featured: flags.featureRationale !== null },
    }),
  ]);
  return { ok: true, id: current.id };
}

export async function recordAgreement(db: Database, actorId: string, providerId: string, agreement: AgreementDetails) {
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(partnershipAgreement).values({
      id,
      providerId,
      ...agreement,
      recordedBy: actorId,
      recordedAt: new Date(),
    }),
    auditInsert(db, {
      actorId,
      action: "partnership_agreement.recorded",
      objectType: "partnership_agreement",
      objectId: id,
      details: { providerId, startsOn: agreement.startsOn, endsOn: agreement.endsOn },
    }),
  ]);
}

/** Ends an agreement early. It stays on record; the Provider stops being shown as a Partner. */
export async function endAgreement(db: Database, actorId: string, providerId: string, agreementId: string) {
  const found = await db
    .select()
    .from(partnershipAgreement)
    .where(and(eq(partnershipAgreement.id, agreementId), eq(partnershipAgreement.providerId, providerId)))
    .get();
  if (!found || found.endedAt) return false;
  await db.batch([
    db
      .update(partnershipAgreement)
      .set({ endedAt: new Date(), endedBy: actorId })
      .where(eq(partnershipAgreement.id, agreementId)),
    auditInsert(db, {
      actorId,
      action: "partnership_agreement.ended",
      objectType: "partnership_agreement",
      objectId: agreementId,
      details: { providerId },
    }),
  ]);
  return true;
}

/** Purges the public pages that show a Provider and its Offerings, the sitemap included. */
export function providerChanged(env: Env, slug: string) {
  return purgePublicPages(env, ["/connect", "/connect/providers", providerPath(slug), "/sitemap.xml"]);
}

/**
 * The Providers whose Offerings are hosted on a NAISEMA item, so their pages can be refreshed
 * when that item changes: they say whether it can be opened.
 */
export async function providersHosting(db: Database, contentItemId: string) {
  return db
    .selectDistinct({ slug: provider.slug })
    .from(offering)
    .innerJoin(provider, eq(provider.id, offering.providerId))
    .where(and(eq(offering.accessMode, "licensed_native"), like(offering.access, `%${contentItemId}%`)));
}

/** The editor gate plus the Provider a staff page is about; 404 if there is none. */
export async function requireProvider(env: Env, request: Request, id: string) {
  const staff = await requireEditor(env, request);
  const found = await getProvider(staff.db, id);
  if (!found) throw new Response("Not found", { status: 404 });
  return { ...staff, provider: found };
}

// --- What the public site shows ---

/** Agreements for many Providers at once, by Provider. */
async function agreementsByProvider(db: Database) {
  const rows = await db.select().from(partnershipAgreement);
  const byProvider = new Map<string, AgreementFacts[]>();
  for (const row of rows) byProvider.set(row.providerId, [...(byProvider.get(row.providerId) ?? []), row]);
  return byProvider;
}

/** Whether a listed Offering can be shown: one shown or hosted on NAISEMA needs a Partner. */
const shownWith = (row: OfferingRow, partner: boolean) =>
  row.listed && (partner || !PARTNER_ONLY_MODES.includes(row.accessMode));

/**
 * The listed Providers, A to Z, of one kind if asked, each marked a Partner only while an
 * agreement is in force.
 */
export async function publicProviders(db: Database, now = new Date(), kind: OrganisationType | null = null) {
  const [rows, agreements] = await Promise.all([
    db
      .select()
      .from(provider)
      .where(and(eq(provider.listed, true), kind ? eq(provider.organisationType, kind) : undefined))
      .orderBy(asc(provider.name)),
    agreementsByProvider(db),
  ]);
  return rows.map((row) => ({ ...row, partner: isPartner(agreements.get(row.id) ?? [], now) }));
}

/** A listed Provider and the Offerings it can show, for its public page; null if not listed. */
export async function publicProvider(db: Database, slug: string, now = new Date()) {
  const found = await db
    .select()
    .from(provider)
    .where(and(eq(provider.slug, slug), eq(provider.listed, true)))
    .get();
  if (!found) return null;
  const [offerings, agreements] = await Promise.all([
    db.select().from(offering).where(eq(offering.providerId, found.id)).orderBy(asc(offering.title)),
    agreementsOf(db, found.id),
  ]);
  const partner = isPartner(agreements, now);
  return { ...found, partner, offerings: offerings.filter((row) => shownWith(row, partner)) };
}

/** The listed Offerings of listed Providers, narrowed by the visitor's filters, A to Z. */
export async function publicOfferings(db: Database, filters: OfferingFilters, now = new Date()) {
  const [rows, agreements] = await Promise.all([
    db
      .select({
        offering,
        providerName: provider.name,
        providerSlug: provider.slug,
        providerContactRoute: provider.contactRoute,
        providerSponsoredBy: provider.sponsoredBy,
      })
      .from(offering)
      .innerJoin(provider, eq(provider.id, offering.providerId))
      .where(
        and(
          eq(offering.listed, true),
          eq(provider.listed, true),
          filters.format ? eq(offering.format, filters.format) : undefined,
          filters.cost ? eq(offering.costKind, filters.cost) : undefined,
          filters.access ? eq(offering.accessMode, filters.access) : undefined,
          filters.language ? like(offering.languageVariety, `%${filters.language.replace(/[%_]/g, "")}%`) : undefined,
        ),
      )
      .orderBy(asc(offering.title)),
    agreementsByProvider(db),
  ]);
  return rows
    .filter((row) => shownWith(row.offering, isPartner(agreements.get(row.offering.providerId) ?? [], now)))
    .map((row) => ({
      ...row.offering,
      providerName: row.providerName,
      providerSlug: row.providerSlug,
      providerContactRoute: row.providerContactRoute,
      providerSponsoredBy: row.providerSponsoredBy,
    }));
}

/** The featured Offerings and Providers, with why editors chose them, for the Connect page. */
export async function featuredListings(db: Database, now = new Date()) {
  const [providers, offerings] = await Promise.all([
    publicProviders(db, now),
    publicOfferings(db, { format: null, cost: null, access: null, language: "" }, now),
  ]);
  return {
    providers: providers.filter((row) => row.featureRationale),
    offerings: offerings.filter((row) => row.featureRationale),
  };
}

/** Listed Providers' addresses, for the sitemap. */
export function providerSitemap(db: Database) {
  return db
    .select({ slug: provider.slug, updatedAt: provider.updatedAt })
    .from(provider)
    .where(eq(provider.listed, true));
}

/** How a visitor gets to an Offering, as its public listing shows it. */
export type AccessView =
  | { kind: "external"; label: string; url: string; host: string; note: string | null }
  | { kind: "text"; text: string }
  | { kind: "item"; label: string; path: string };

/**
 * An Offering as visitors read it: every fact, "Not known" where nobody knows, and its access
 * mode as an action that says where it goes before anyone follows it.
 */
export async function offeringView(
  db: Database,
  row: OfferingRow,
  owner: { name: string; contactRoute: string; sponsoredBy: string | null },
  now = new Date(),
) {
  const known = (value: string) => value || "Not known";
  const access = row.access;
  let action: AccessView;
  if (access.mode === "external_link" || access.mode === "authorised_embed") {
    action = {
      kind: "external",
      label: access.mode === "external_link" ? "Go to their page for it" : "Open it",
      url: access.url,
      host: linkHost(access.url),
      note: access.mode === "authorised_embed" ? `Shown with ${owner.name}'s authorisation.` : null,
    };
  } else if (access.mode === "enquiry") {
    action = {
      kind: "text",
      text: owner.contactRoute
        ? `Ask ${owner.name}: ${owner.contactRoute}`
        : `Ask ${owner.name}. Their contact details aren't known yet.`,
    };
  } else if (access.mode === "referral") {
    action = { kind: "text", text: `NAISEMA can refer you: ${access.note}` };
  } else if (access.mode === "licensed_native") {
    const item = await db.select().from(contentItem).where(eq(contentItem.id, access.contentItemId)).get();
    const published = item ? await eligiblePublished(db, item, now) : null;
    action =
      item && published
        ? { kind: "item", label: `Open ${published.snapshot.title} on NAISEMA`, path: itemPath(item) }
        : { kind: "text", text: "It isn't available on NAISEMA right now." };
  } else {
    action = { kind: "text", text: "Not known" };
  }
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    facts: [
      ["Language", known(row.languageVariety)],
      ["Level", LEVELS[row.level]],
      ["Suitable for", AGE_SUITABILITY[row.ageSuitability]],
      ["Format", FORMATS[row.format]],
      ["Cost", costText(row.cost)],
      ["Dates", datesText(row.startsOn, row.endsOn)],
      ["Accessibility", known(row.accessibility)],
      ["Enrolment handled by", HANDLED_BY[row.enrolmentBy]],
      ["Support handled by", HANDLED_BY[row.supportBy]],
    ] as [string, string][],
    accessMode: ACCESS_MODES[row.accessMode],
    action,
    sponsors: sponsorsText(row.sponsoredBy, owner.sponsoredBy),
    featureRationale: row.featureRationale,
  };
}

export type OfferingView = Awaited<ReturnType<typeof offeringView>>;

function datesText(startsOn: string, endsOn: string) {
  if (startsOn && endsOn) return `${formatDay(startsOn)} to ${formatDay(endsOn)}`;
  if (startsOn) return `From ${formatDay(startsOn)}`;
  if (endsOn) return `Until ${formatDay(endsOn)}`;
  return "Ongoing, or not known";
}
