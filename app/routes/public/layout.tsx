import { Outlet } from "react-router";
import { errorPage, PublicErrorPage, SiteFooter, SiteHeader } from "~/components/public/site-chrome";
import type { Route } from "./+types/layout";
import "~/styles/public.css";

export const handle = { hydrate: false };

export default function PublicLayout() {
  return (
    <div className="public">
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </div>
  );
}

/** Pages below an error boundary don't contribute meta, so an error page gets its title here. */
export function meta({ error }: Route.MetaArgs) {
  return [{ title: error ? `${errorPage(error).title} · NAISEMA` : "NAISEMA" }];
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <PublicErrorPage error={error} />;
}
