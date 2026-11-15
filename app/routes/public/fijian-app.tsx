import { redirect } from "react-router";
import { cloudflareContext } from "~/lib/cloudflare";
import { findAppPage, renderAppPage } from "~/lib/fijian-app-pages.server";
import { publicHeaders } from "~/lib/http";
import type { RouteHandle } from "~/lib/route-handle";
import type { Route } from "./+types/fijian-app";

/**
 * Never hydrated: the page runs the app's own script files from this site instead (`selfScripts`),
 * and loads Turnstile only when it has a form that sends something (app/lib/fijian-app-pages.server.ts).
 */
export const handle: RouteHandle = {
  hydrate: false,
  selfScripts: true,
  turnstile: (data) => (data as { turnstile?: boolean } | undefined)?.turnstile === true,
};

export const headers = publicHeaders;

/** The parts of Vosa still served from the apps preview until they move onto NAISEMA's model (#118). */
const DICTIONARY_PREVIEW_VIEWS = ["culture", "icavuti"];

/**
 * GET /apps/*: one page of a Fijian app, at the address it had on apps.naisema.com. The apps site
 * wrote its addresses with a closing slash, and its pages find their files relative to that, so an
 * address without one is sent to the one with it.
 */
export function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = findAppPage(url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`);
  if (!page) throw new Response("Not found", { status: 404 });
  if (!url.pathname.endsWith("/")) throw redirect(`${url.pathname}/${url.search}`, 301);
  // The dictionary is at /vosa now (change note 0002); only Vakavanua and Icavuti stay here (#118).
  if (page.key === "dictionary" && !DICTIONARY_PREVIEW_VIEWS.includes(url.searchParams.get("view") ?? "")) {
    throw redirect("/vosa", 301);
  }
  return renderAppPage(page, context.get(cloudflareContext).env.TURNSTILE_SITE_KEY);
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "NAISEMA" }];
  return [{ title: `${loaderData.title} · NAISEMA` }, { name: "description", content: loaderData.description }];
}

export default function FijianAppPage({ loaderData }: Route.ComponentProps) {
  return (
    <>
      {loaderData.styles.map((href) => (
        <link key={href} rel="stylesheet" href={href} precedence="fijian-app" />
      ))}
      {/* The apps site's own markup, kept as it was written (app/fijian-apps/pages). */}
      <div
        className={`fijian-app fijian-app-${loaderData.key}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the app's own markup, from this repository, never from a visitor.
        dangerouslySetInnerHTML={{ __html: loaderData.html }}
      />
      {loaderData.scripts.map((src) => (
        <script key={src} src={src} defer />
      ))}
    </>
  );
}
