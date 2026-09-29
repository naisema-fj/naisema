import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useMatches } from "react-router";
import type { Route } from "./+types/root";
import "./app.css";
import { useNonce } from "./lib/security-headers";

/**
 * A route opts out of client JavaScript with `export const handle = { hydrate: false }`
 * when it has nothing interactive (docs/phase-1a-defaults.md §7).
 */
function useHydrates() {
  const leaf = useMatches().at(-1);
  return (leaf?.handle as { hydrate?: boolean } | undefined)?.hydrate !== false;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useNonce();
  const hydrates = useHydrates();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:," />
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
        <a href="/">Go to the Na iSema home page</a>
      </p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
