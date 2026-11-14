import { Outlet } from "react-router";
import { errorPage, PublicErrorPage, SiteFooter, SiteHeader } from "~/components/public/site-chrome";
import type { Route } from "./+types/apps-layout";
import "~/styles/public.css";

export const handle = { hydrate: false };

/**
 * The Fijian apps' pages in NAISEMA's header and footer. The app between them sits outside the
 * `.public` wrapper, so the public site's styles never reach into the app's own (public/apps), and
 * the app's styles are scoped to `.fijian-app`, so they never reach the header or footer.
 */
export default function AppsLayout() {
  return (
    <>
      <div className="public public-band">
        <SiteHeader />
      </div>
      <Outlet />
      <div className="public public-band">
        <SiteFooter />
      </div>
    </>
  );
}

export function meta({ error }: Route.MetaArgs) {
  return [{ title: error ? `${errorPage(error).title} · NAISEMA` : "NAISEMA" }];
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PublicErrorPage error={error} />;
}
