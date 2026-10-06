import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useMatches } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { pageHydrates, type RouteHandle } from "./lib/route-handle";
import { useNonce } from "./lib/security-headers";

/** The NAISEMA woven mark on Shell, inlined so the icon costs no request (the CSP allows data: images). */
const WOVEN_MARK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='18' fill='%23f6f5f2'/%3E%3Crect x='12.5' y='10.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='28.5' y='12.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='48.5' y='10.5' width='11' height='15' rx='1.6' fill='%23d2603f'/%3E%3Crect x='64.5' y='12.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='84.5' y='10.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='10.5' y='30.5' width='15' height='11' rx='1.6' fill='%230f2b35'/%3E%3Crect x='30.5' y='28.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='46.5' y='30.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='66.5' y='28.5' width='11' height='15' rx='1.6' fill='%23d2603f'/%3E%3Crect x='82.5' y='30.5' width='15' height='11' rx='1.6' fill='%230f2b35'/%3E%3Crect x='12.5' y='46.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='28.5' y='48.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='48.5' y='46.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='64.5' y='48.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='84.5' y='46.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='10.5' y='66.5' width='15' height='11' rx='1.6' fill='%230f2b35'/%3E%3Crect x='30.5' y='64.5' width='11' height='15' rx='1.6' fill='%23d2603f'/%3E%3Crect x='46.5' y='66.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='66.5' y='64.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='82.5' y='66.5' width='15' height='11' rx='1.6' fill='%230f2b35'/%3E%3Crect x='12.5' y='82.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3Crect x='28.5' y='84.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='48.5' y='82.5' width='11' height='15' rx='1.6' fill='%23d2603f'/%3E%3Crect x='64.5' y='84.5' width='15' height='11' rx='1.6' fill='%23d2603f'/%3E%3Crect x='84.5' y='82.5' width='11' height='15' rx='1.6' fill='%230f2b35'/%3E%3C/svg%3E";

/**
 * A route opts out of client JavaScript with `export const handle = { hydrate: false }`
 * when it has nothing interactive (docs/phase-1a-defaults.md §7, app/lib/route-handle.ts).
 */
function useHydrates() {
  const leaf = useMatches().at(-1);
  return pageHydrates(leaf?.handle as RouteHandle | undefined, leaf?.loaderData);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  const hydrates = useHydrates();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href={WOVEN_MARK_ICON} />
        <Meta />
        <Links />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        {hydrates && (
          <>
            <ScrollRestoration nonce={nonce} />
            <Scripts nonce={nonce} />
          </>
        )}
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  let details = notFound ? "We couldn't find that page." : "Something went wrong on our side.";
  let stack: string | undefined;

  if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main id="main" className="page">
      <h1>{notFound ? "Page not found" : "Something went wrong"}</h1>
      <p>{details}</p>
      <p>
        <a href="/">Go to the NAISEMA home page</a>
      </p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
