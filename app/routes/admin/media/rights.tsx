import { RightsRecords } from "~/components/rights-records";
import { cloudflareContext } from "~/lib/cloudflare";
import { requireRightsManager } from "~/lib/content.server";
import { readyMedia } from "~/lib/media-delivery.server";
import { mediaAssetChanged } from "~/lib/public-change.server";
import { rightsAction, rightsPageData } from "~/lib/rights-page.server";
import type { Route } from "./+types/rights";

export const handle = { hydrate: false };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Rights for ${loaderData?.asset.name ?? "a file"} · Na iSema staff` }];
}

/** A media library file that has passed its scan; evidence and refused files have no rights page. */
async function requireMediaRights(request: Request, env: Env, assetId: string) {
  const staff = await requireRightsManager(env, request);
  const asset = await readyMedia(staff.db, assetId);
  if (!asset) throw new Response("Not found", { status: 404 });
  return { ...staff, asset };
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { db, asset } = await requireMediaRights(request, context.get(cloudflareContext).env, params.id);
  return {
    asset: { id: asset.id, name: asset.name },
    ...(await rightsPageData(db, { type: "media_asset", id: asset.id })),
    done: new URL(request.url).searchParams.get("done"),
  };
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor, asset } = await requireMediaRights(request, env, params.id);
  return rightsAction(env, db, actor.userId, request, {
    subject: { type: "media_asset", id: asset.id },
    changed: () => mediaAssetChanged(env, db, asset.id),
  });
}

export default function MediaRights({ loaderData, actionData }: Route.ComponentProps) {
  const { asset, parts, records, contributors, done } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin/media">Back to the media library</a>
      </p>
      <h1>Rights Records: {asset.name}</h1>
      <RightsRecords
        intro={
          <p>
            This file can be shown on the public site, and anything using it published, only while a current Rights
            Record of its own grants Publish. The Rights Record of an item that uses it doesn't cover it. Records are
            never edited: to correct one, withdraw it and record it again.
          </p>
        }
        parts={parts}
        records={records}
        contributors={contributors}
        done={done}
        actionData={actionData}
      />
    </main>
  );
}
