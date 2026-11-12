import { ArrowLeft, ArrowRight, Clock, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { AREA_ICONS, Icon, KIND_ICONS } from "~/components/icons";
import { DateMark } from "~/components/public/postmarks";
import { AREA_NAMES, type PrimaryArea } from "~/lib/areas";
import type { ContentKind } from "~/lib/content-rules";

/**
 * The parts the public pages share in the "front room" design: the way back, a page's opening
 * cushion, the shelf of pieces and the plain "not open yet" notice. Server-rendered, no script.
 */

/** The way back to where a page sits: one soft button, the arrow and the place's name. */
export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <p className="back">
      <Link to={to} reloadDocument className="back-link">
        <Icon icon={ArrowLeft} size={18} />
        {children}
      </Link>
    </p>
  );
}

/**
 * A page's opening: a cushion in its area's colour (Sand when it has none), with the area's
 * icon on a round seat and the heading. Anything smaller than the heading goes in `plate`, a
 * Shell plate, because small text never sits on Kesa.
 */
export function PageHead({
  tone,
  icon,
  title,
  headingId,
  plate,
}: {
  tone: PrimaryArea | "none";
  icon: LucideIcon;
  title: React.ReactNode;
  headingId?: string;
  plate?: React.ReactNode;
}) {
  return (
    <div className={`page-head tone-${tone}`}>
      <div className="page-head-main">
        <span className="seat seat-large">
          <Icon icon={icon} size={36} />
        </span>
        <h1 id={headingId}>{title}</h1>
      </div>
      {plate && <div className="head-plate">{plate}</div>}
    </div>
  );
}

/** What isn't open yet, said plainly beside a clock (PUB-01). */
export function NotOpen({ children, label = "Not open yet." }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="notice">
      <span className="seat seat-small">
        <Icon icon={Clock} size={20} />
      </span>
      <p>
        <strong>{label}</strong> {children}
      </p>
    </div>
  );
}

type Piece = {
  id?: string;
  path: string;
  title: string;
  summary: string;
  kind: ContentKind;
  kindName: string;
  area: PrimaryArea | null;
  publishedAt: Date | string | null;
};

/**
 * Pieces on a shelf: each a row with its kind's icon in its area's colour, the title (the only
 * link, stretched over the row so the whole row answers a tap), the summary and one meta line.
 */
export function PieceList({ items, showArea = false }: { items: Piece[]; showArea?: boolean }) {
  return (
    <ul className="shelf">
      {items.map((item) => (
        <li key={item.id ?? item.path} className="shelf-item">
          <span className={`shelf-seat tone-${item.area ?? "none"}`}>
            <Icon icon={KIND_ICONS[item.kind]} size={26} />
          </span>
          <div className="shelf-text">
            <Link to={item.path} className="shelf-title">
              {item.title}
            </Link>
            {item.summary && <p>{item.summary}</p>}
            <p className="shelf-meta">
              {showArea && item.area && (
                <span className="meta-part">
                  <Icon icon={AREA_ICONS[item.area]} size={16} />
                  {AREA_NAMES[item.area]}
                </span>
              )}
              <span className="meta-part">{item.kindName}</span>
              {item.publishedAt && (
                <span className="meta-part">
                  <DateMark label="Published" date={item.publishedAt} />
                </span>
              )}
            </p>
          </div>
          <Icon icon={ArrowRight} className="shelf-arrow" />
        </li>
      ))}
    </ul>
  );
}
