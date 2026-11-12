import {
  CircleCheck,
  Clock,
  ExternalLink,
  Eye,
  Inbox,
  type LucideIcon,
  Plus,
  Sun,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Icon } from "~/components/icons";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { attention } from "~/lib/dashboard.server";
import { getDb } from "~/lib/db.server";
import { formatDay } from "~/lib/rights-rules";
import { can, ROLE_NAMES } from "~/lib/roles";
import { requireStaff } from "~/lib/staff.server";
import { ROLE_DOES } from "~/lib/staff-help";
import type { Route } from "./+types/home";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  const url = new URL(request.url);
  return {
    name: actor.name,
    roles: actor.roles,
    canWrite: can(actor, "content.edit") || can(actor, "video.edit"),
    canUpload: can(actor, "media.upload"),
    // The public site is the staff host without its "admin." in front.
    publicSite: `${url.protocol}//${url.host.replace(/^admin\./, "")}/`,
    ...(await attention(getDb(env.DB), actor)),
  };
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
      <p className="page-lede">{nothing ? "You're all caught up." : "Here's what needs you today."}</p>
      <nav aria-label="Quick actions" className="quick-actions">
        {loaderData.canWrite && (
          <a href="/admin/items" className="button">
            <Icon icon={Plus} />
            Write something new
          </a>
        )}
        {loaderData.canUpload && (
          <a href="/admin/media" className="button button-quiet">
            <Icon icon={Upload} />
            Upload media
          </a>
        )}
        <a href={loaderData.publicSite} className="button button-quiet">
          <Icon icon={ExternalLink} />
          Open the public site
        </a>
      </nav>
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
          <span className="seat seat-large tone-voivoi">
            <Icon icon={Sun} size={30} />
          </span>
          <p className="attention-empty-title">Nothing is waiting for you.</p>
          <p>Vinaka! When something needs you, it will be here.</p>
        </div>
      )}
      <div className="attention-grid">
        {toReview.length > 0 && (
          <section aria-labelledby="review-heading">
            <AttentionHead id="review-heading" icon={Eye} tone="kesa" count={toReview.length}>
              Waiting for your review
            </AttentionHead>
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
            <AttentionHead id="ready-heading" icon={CircleCheck} tone="green" count={ready.length}>
              Ready to publish
            </AttentionHead>
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
            <AttentionHead id="waiting-heading" icon={TriangleAlert} tone="sand" count={waiting.length}>
              Not ready yet
            </AttentionHead>
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
            <AttentionHead id="expiring-heading" icon={Clock} tone="voivoi" count={expiring.length}>
              Rights running out in the next 30 days
            </AttentionHead>
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
            <AttentionHead id="messages-heading" icon={Inbox} tone="sand" count={newMessages}>
              Messages and reports
            </AttentionHead>
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

/** A card's heading: its icon on a round seat, the words, and how many are waiting. */
function AttentionHead({
  id,
  icon,
  tone,
  count,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: "kesa" | "green" | "sand" | "voivoi";
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="attention-head">
      <span className={`seat tone-${tone}`}>
        <Icon icon={icon} />
      </span>
      <h3 id={id}>{children}</h3>
      <span className="count">
        {count}
        <span className="visually-hidden"> waiting</span>
      </span>
    </div>
  );
}
