import { data, Form, redirect } from "react-router";
import { listingValues, ProviderForm } from "~/components/listing-forms";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireProvider } from "~/lib/content.server";
import {
  ACCESS_MODES,
  costText,
  formValues,
  isPartner,
  LISTING_LIMITS,
  listingErrors,
  providerPath,
  readAgreementFields,
  readListingFlags,
  readProviderFields,
} from "~/lib/listing-fields";
import { endAgreement, providerChanged, recordAgreement, updateProvider } from "~/lib/providers.server";
import { formatDay } from "~/lib/rights-rules";
import type { Route } from "./+types/edit";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.provider.name ?? "Provider"} · NAISEMA staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { provider } = await requireProvider(context.get(cloudflareContext).env, request, params.id);
  return {
    provider,
    partner: isPartner(provider.agreements),
    saved: new URL(request.url).searchParams.get("saved"),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, provider } = await requireProvider(env, request, params.id);
  const form = await request.formData();
  const intent = form.get("intent");
  const refused = (errors: Record<string, string>, which: "provider" | "agreement") =>
    data(
      which === "agreement"
        ? { errors: {}, values: null, agreementErrors: errors, agreementValues: formValues(form) }
        : { errors, values: formValues(form), agreementErrors: null, agreementValues: null },
      { status: 400 },
    );

  if (intent === "agreement") {
    const read = readAgreementFields(form);
    if (!read.ok) return refused(read.errors, "agreement");
    await recordAgreement(db, actor.userId, provider.id, read.details);
  } else if (intent === "endAgreement") {
    const ended = await endAgreement(db, actor.userId, provider.id, String(form.get("agreementId") ?? ""));
    if (!ended)
      return refused({ reference: "That agreement has already ended, or isn't this Provider's." }, "agreement");
  } else {
    const details = readProviderFields(form);
    const flags = readListingFlags(form);
    if (!details.ok || !flags.ok) return refused(listingErrors(details, flags), "provider");
    await updateProvider(db, actor.userId, provider.id, details.details, flags.flags);
  }
  // Partner status, listing and details all show on its public pages.
  await providerChanged(env, provider.slug);
  throw redirect(`/admin/providers/${provider.id}?saved=${intent ?? "provider"}`);
}

export default function EditProvider({ loaderData, actionData }: Route.ComponentProps) {
  const { provider, partner, saved } = loaderData;
  const agreementErrors: Record<string, string> = actionData?.agreementErrors ?? {};
  const agreementValues: Record<string, string> = actionData?.agreementValues ?? {};
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/providers">Back to providers</a>
      </p>
      <h1>{provider.name}</h1>
      {saved && !actionData && <p role="status">Saved.</p>}
      <p>
        {provider.listed ? (
          <>
            Listed at <a href={providerPath(provider.slug)}>{providerPath(provider.slug)}</a>.
          </>
        ) : (
          "Not listed on the public site."
        )}{" "}
        {partner ? "Shown as a Partner." : "Not a Partner: no Partnership Agreement is in force."}
      </p>

      <ProviderForm
        values={actionData?.values ?? listingValues(provider)}
        errors={actionData?.errors}
        submitLabel="Save provider"
      />

      <h2>Offerings</h2>
      <p>
        <a href={`/admin/providers/${provider.id}/offerings/new`}>Add an offering</a>
      </p>
      {provider.offerings.length ? (
        <ul>
          {provider.offerings.map((row) => (
            <li key={row.id}>
              <a href={`/admin/offerings/${row.id}`}>{row.title}</a>
              {` · ${ACCESS_MODES[row.accessMode]} · ${costText(row.cost)}${row.listed ? "" : " · not listed"}`}
            </li>
          ))}
        </ul>
      ) : (
        <p>No offerings yet.</p>
      )}

      <h2>Partnership Agreements</h2>
      {provider.agreements.length ? (
        <ul>
          {provider.agreements.map((agreement) => (
            <li key={agreement.id}>
              {`${agreement.reference}: from ${formatDay(agreement.startsOn)}${agreement.endsOn ? ` to ${formatDay(agreement.endsOn)}` : ""}`}
              {agreement.endedAt ? (
                ` · ended ${formatDay(agreement.endedAt)}`
              ) : (
                <Form method="post" className="inline-form">
                  <input type="hidden" name="intent" value="endAgreement" />
                  <input type="hidden" name="agreementId" value={agreement.id} />
                  <button type="submit">End this agreement now</button>
                </Form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No Partnership Agreement recorded.</p>
      )}
      <h3>Record a Partnership Agreement</h3>
      <Form method="post" className="article-form">
        <input type="hidden" name="intent" value="agreement" />
        <label htmlFor="reference">Where the signed agreement is kept</label>
        <input
          id="reference"
          name="reference"
          required
          maxLength={LISTING_LIMITS.short}
          defaultValue={agreementValues.reference}
          aria-describedby={agreementErrors.reference ? "reference-error" : undefined}
        />
        {agreementErrors.reference && (
          <p id="reference-error" className="field-error">
            {agreementErrors.reference}
          </p>
        )}
        <label htmlFor="agreementStartsOn">Starts on</label>
        <input
          id="agreementStartsOn"
          name="startsOn"
          type="date"
          required
          defaultValue={agreementValues.startsOn}
          aria-describedby={agreementErrors.startsOn ? "startsOn-error" : undefined}
        />
        {agreementErrors.startsOn && (
          <p id="startsOn-error" className="field-error">
            {agreementErrors.startsOn}
          </p>
        )}
        <label htmlFor="agreementEndsOn">Last day (leave empty if it runs until ended)</label>
        <input
          id="agreementEndsOn"
          name="endsOn"
          type="date"
          defaultValue={agreementValues.endsOn}
          aria-describedby={agreementErrors.endsOn ? "endsOn-error" : undefined}
        />
        {agreementErrors.endsOn && (
          <p id="endsOn-error" className="field-error">
            {agreementErrors.endsOn}
          </p>
        )}
        <button type="submit">Record agreement</button>
      </Form>
    </main>
  );
}
