import { data, redirect } from "react-router";
import { OfferingForm, offeringValues } from "~/components/listing-forms";
import { embeddableArticles } from "~/lib/articles.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { readListingFlags, readOfferingFields } from "~/lib/listing-fields";
import { getOffering, getProvider, providerChanged, updateOffering } from "~/lib/providers.server";
import type { Route } from "./+types/offering-edit";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.offering.title ?? "Offering"} · Na iSema staff` }];
}

async function requireOffering(request: Request, env: Env, id: string) {
  const staff = await requireEditor(env, request);
  const found = await getOffering(staff.db, id);
  const owner = found && (await getProvider(staff.db, found.providerId));
  if (!found || !owner) throw new Response("Not found", { status: 404 });
  return { ...staff, offering: found, provider: owner };
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, offering, provider } = await requireOffering(request, context.get(cloudflareContext).env, params.id);
  return {
    offering,
    provider: { id: provider.id, name: provider.name },
    items: await embeddableArticles(db),
    saved: new URL(request.url).searchParams.get("saved") === "1",
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, offering, provider } = await requireOffering(request, env, params.id);
  const form = await request.formData();
  const values = Object.fromEntries([...form].map(([key, value]) => [key, String(value)]));
  const details = readOfferingFields(form);
  const flags = readListingFlags(form);
  if (!details.ok || !flags.ok) {
    const errors = { ...(details.ok ? {} : details.errors), ...(flags.ok ? {} : flags.errors) };
    return data({ errors, values }, { status: 400 });
  }
  const updated = await updateOffering(db, actor.userId, offering, details.details, flags.flags);
  if (!updated.ok) return data({ errors: updated.errors, values }, { status: 400 });
  await providerChanged(env, provider.slug);
  throw redirect(`/admin/offerings/${offering.id}?saved=1`);
}

export default function EditOffering({ loaderData, actionData }: Route.ComponentProps) {
  const { offering, provider, items, saved } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href={`/admin/providers/${provider.id}`}>Back to {provider.name}</a>
      </p>
      <h1>{offering.title}</h1>
      {saved && !actionData && <p role="status">Saved.</p>}
      <OfferingForm
        values={actionData?.values ?? offeringValues(offering)}
        errors={actionData?.errors}
        items={items}
        submitLabel="Save offering"
      />
    </main>
  );
}
