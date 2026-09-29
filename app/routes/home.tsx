import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { getSiteSettings } from "~/lib/site-settings.server";
import type { Route } from "./+types/home";

export const handle = { hydrate: false };

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  return getSiteSettings(getDb(env.DB));
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData.siteName }];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main id="main" className="page">
      <h1>{loaderData.siteName}</h1>
      {loaderData.welcomeStatement && <p>{loaderData.welcomeStatement}</p>}
    </main>
  );
}
