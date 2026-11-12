import {
  BookOpen,
  Captions,
  Compass,
  Download,
  Eye,
  FileText,
  Flag,
  Globe,
  GraduationCap,
  HandHeart,
  Headphones,
  Languages,
  Library,
  Lock,
  type LucideIcon,
  Mail,
  MessageCircle,
  MessagesSquare,
  Mic,
  Newspaper,
  PencilLine,
  Play,
  Plus,
  Repeat,
  Tag,
  User,
  Users,
} from "lucide-react";
import type { PrimaryArea } from "~/lib/areas";
import type { ContentKind } from "~/lib/content-rules";
import type { FormKey } from "~/lib/forms";
import type { StageId } from "~/lib/immersion";

/**
 * The icon set (Lucide, ISC licence): line icons drawn on the server as inline SVG, so a page
 * needs no script or request for them, and the CSP's "no inline styles" holds (they carry only
 * attributes). An icon always sits beside its word; it never replaces one, so every icon is
 * hidden from assistive technology.
 */
export function Icon({ icon: Glyph, size = 20, className }: { icon: LucideIcon; size?: number; className?: string }) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
      focusable="false"
      className={className ? `icon ${className}` : "icon"}
    />
  );
}

/** One icon per area, shared by the header, the homepage and the area's own pages. */
export const AREA_ICONS: Record<PrimaryArea, LucideIcon> = {
  learn: BookOpen,
  voices: Mic,
  discover: Compass,
  connect: Users,
  ezine: Newspaper,
  resources: Library,
};

/** What kind of piece something is, at a glance, in every list. */
export const KIND_ICONS: Record<ContentKind, LucideIcon> = {
  article: FileText,
  episode: Headphones,
  resource: Download,
  video: Play,
  creator: User,
  provider: GraduationCap,
  page: FileText,
};

/** Each public form, by what it is for. */
export const FORM_ICONS: Record<FormKey, LucideIcon> = {
  enquiry: Mail,
  contribute: Mic,
  teach: GraduationCap,
  consultation: MessagesSquare,
  report: Flag,
  "privacy-request": Lock,
  "suggest-word": Plus,
  "correct-word": PencilLine,
  "suggest-translation": Languages,
};

/** The eight steps of the language player. */
export const STAGE_ICONS: Record<StageId, LucideIcon> = {
  watch: Eye,
  captions: Captions,
  words: Languages,
  support: Globe,
  "listen-again": Headphones,
  practise: Repeat,
  respond: MessageCircle,
  "use-it": Users,
};

/**
 * A Review Label's icon names what was reviewed (language, culture, a personal view): never a
 * tick or a seal, so nothing reads as a generic "verified" badge (PUB-02).
 */
export function labelIcon(label: string): LucideIcon {
  if (label.startsWith("Language")) return Languages;
  if (label.startsWith("Cultural")) return HandHeart;
  if (label.startsWith("Opinion")) return MessageCircle;
  return Tag;
}
