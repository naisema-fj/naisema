import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { attention } from "~/lib/dashboard.server";
import { getDb } from "~/lib/db.server";
import { formatDay } from "~/lib/rights-rules";
import { ROLE_NAMES } from "~/lib/roles";
import { requireStaff } from "~/lib/staff.server";
import { ROLE_DOES } from "~/lib/staff-help";
import type { Route } from "./+types/home";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  return { name: actor.name, roles: actor.roles, ...(await attention(getDb(env.DB), actor)) };
}

export function meta() {
  return [{ title: "Staff home · NAISEMA staff" }];
}

export default function StaffHome({ loaderData }: Route.ComponentProps) {
  const { toReview, ready, waiting, expiring, newMessages, roles } = loaderData;
  const nothing = !toReview.length && !ready.length && !waiting.length && !expiring.length && !newMessages;
  return (
    <main id="main" className="page">
      <h1>Bula, {loaderData.name}</h1>
      <h2>Needs your attention</h2>
      <WhatsThis summary="How this page works">
        <p>This page lists only what needs you. A list with nothing in it isn't shown.</p>
        <ul>
          <li>
            <strong>Waiting for your review:</strong> versions you may review and didn't write.
          </li>
          <li>
            <strong>Ready to publish:</strong> versions that have everything they need.
          </li>
          <li>
            <strong>Not ready yet:</strong> changed items that can't be published, with the first thing each is missing.
          </li>
          <li>
            <strong>Rights running out:</strong> Rights Records whose last day is in the next 30 days.
          </li>
          <li>
            <strong>Messages and reports:</strong> what people sent through the public forms, still to deal with.
          </li>
        </ul>
        <p>
          Your roles decide what you can do. The menu lists only the pages they allow, so a page that isn't there isn't
          an error.
        </p>
        <ul>
          {roles.map((role) => (
            <li key={role}>
              <strong>{ROLE_NAMES[role]}:</strong> {ROLE_DOES[role]}
            </li>
          ))}
        </ul>
      </WhatsThis>
      {nothing && (
        <div className="attention-empty">
          <p>Nothing is waiting for you.</p>
        </div>
      )}
      <div className="attention-grid">
        {toReview.length > 0 && (
          <section aria-labelledby="review-heading">
            <h3 id="review-heading">Waiting for your review</h3>
            <ul>
              {toReview.map(({ item, types }) => (
                <li key={item.id}>
                  <a href={`/admin/items/${item.id}`}>{item.title}</a>: {types.join(", ")}
                </li>
              ))}
            </ul>
          </section>
        )}
        {ready.length > 0 && (
          <section aria-labelledby="ready-heading">
            <h3 id="ready-heading">Ready to publish</h3>
            <ul>
              {ready.map((item) => (
                <li key={item.id}>
                  <a href={`/admin/items/${item.id}`}>{item.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {waiting.length > 0 && (
          <section aria-labelledby="waiting-heading">
            <h3 id="waiting-heading">Not ready yet</h3>
            <ul>
              {waiting.map(({ item, reasons }) => (
                <li key={item.id}>
                  <a href={`/admin/items/${item.id}`}>{item.title}</a>: {reasons[0]}
                  {reasons.length > 1 && ` (and ${reasons.length - 1} more)`}
                </li>
              ))}
            </ul>
          </section>
        )}
        {expiring.length > 0 && (
          <section aria-labelledby="expiring-heading">
            <h3 id="expiring-heading">Rights running out in the next 30 days</h3>
            <ul>
              {expiring.map((record) => (
                <li key={record.id}>
                  <a href={`/admin/rights/${record.subjectType}/${record.subjectId}`}>{record.holder}</a>: last day{" "}
                  {formatDay(record.expiresOn as string)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {newMessages > 0 && (
          <section aria-labelledby="messages-heading">
            <h3 id="messages-heading">Messages and reports</h3>
            <p>
              <a href="/admin/submissions">
                {newMessages === 1 ? "1 message or report" : `${newMessages} messages and reports`} to deal with
              </a>
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
