import { data, redirect } from "react-router";
import { ProviderForm } from "~/components/listing-forms";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireEditor } from "~/lib/content.server";
import { formValues, listingErrors, readListingFlags, readProviderFields } from "~/lib/listing-fields";
import { createProvider, getProvider, providerChanged } from "~/lib/providers.server";
import type { Route } from "./+types/new";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Add a provider · Na iSema staff" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireEditor(context.get(cloudflareContext).env, request);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireEditor(env, request);
  const form = await request.formData();
  const details = readProviderFields(form);
  const flags = readListingFlags(form);
  if (!details.ok || !flags.ok) {
    return data({ errors: listingErrors(details, flags), values: formValues(form) }, { status: 400 });
  }
  const created = await createProvider(db, actor.userId, details.details, flags.flags);
  if (!created.ok) throw new Error("A new provider is never refused once its fields are read.");
  const saved = await getProvider(db, created.id);
  if (saved?.listed) await providerChanged(env, saved.slug);
  throw redirect(`/admin/providers/${created.id}`);
}

export default function NewProvider({ actionData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/providers">Back to providers</a>
      </p>
      <h1>Add a provider</h1>
      <ProviderForm values={actionData?.values ?? {}} errors={actionData?.errors} submitLabel="Add provider" />
    </main>
  );
}
