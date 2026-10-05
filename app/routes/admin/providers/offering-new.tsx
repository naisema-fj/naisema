import { data, redirect } from "react-router";
import { OfferingForm } from "~/components/listing-forms";
import { embeddableArticles } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireProvider } from "~/lib/content.server";
import { formValues, listingErrors, readListingFlags, readOfferingFields } from "~/lib/listing-fields";
import { createOffering, providerChanged } from "~/lib/providers.server";
import type { Route } from "./+types/offering-new";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `New offering from ${loaderData?.provider.name ?? "a provider"} · Na iSema staff` }];
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, provider } = await requireProvider(context.get(cloudflareContext).env, request, params.id);
  return { provider: { id: provider.id, name: provider.name }, items: await embeddableArticles(db) };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, provider } = await requireProvider(env, request, params.id);
  const form = await request.formData();
  const values = formValues(form);
  const details = readOfferingFields(form);
  const flags = readListingFlags(form);
  if (!details.ok || !flags.ok) return data({ errors: listingErrors(details, flags), values }, { status: 400 });
  const created = await createOffering(db, actor.userId, provider.id, details.details, flags.flags);
  if (!created.ok) return data({ errors: created.errors, values }, { status: 400 });
  await providerChanged(env, provider.slug);
  throw redirect(`/admin/providers/${provider.id}?saved=offering`);
}

export default function NewOffering({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/providers/${loaderData.provider.id}`}>Back to {loaderData.provider.name}</a>
      </p>
      <h1>New offering from {loaderData.provider.name}</h1>
      <OfferingForm
        values={actionData?.values ?? {}}
        errors={actionData?.errors}
        items={loaderData.items}
        submitLabel="Add offering"
      />
    </main>
  );
}
