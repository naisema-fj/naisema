import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  // The public site: no client JavaScript except the learner player and forms' Turnstile, and
  // eligible content only, decided on every request (ADR-0007, ADR-0015).
  layout("routes/public/layout.tsx", [
    index("routes/public/home.tsx"),
    route("search", "routes/public/search.tsx"),
    route("apps", "routes/public/apps.tsx"),
    route("how-it-works", "routes/public/how-it-works.tsx"),
    route("topics", "routes/public/topic.tsx", { id: "topics" }),
    route("topics/:slug", "routes/public/topic.tsx", { id: "topic" }),
    route("forms/:form", "routes/public/form.tsx"),
    route("newsletter", "routes/public/newsletter.tsx"),
    // One exact Revision, for a Knowledge Holder, never cached or indexed (app/lib/preview.server.ts).
    route("preview/:token", "routes/public/preview.tsx"),
    // An area's listing, or a footer Page at /{slug}.
    route(":area", "routes/public/area.tsx"),
    route(":area/:slug", "routes/public/item.tsx"),
    route(":area/:slug/language", "routes/public/player.tsx"),
  ]),
  route("preview/:token/media/:type/:id/:width?", "routes/public/preview-media.ts"),
  route("sitemap.xml", "routes/public/sitemap.ts"),
  route("robots.txt", "routes/public/robots.ts"),
  // For the external uptime monitor (ADR-0012): never cached, reads D1.
  route("health", "routes/public/health.ts"),
  // Media files whose own rights allow them public, asked on every request (app/lib/media.server.ts).
  route("media/images/:id/:width", "routes/media/image.ts"),
  route("media/files/:id", "routes/media/file.ts"),
  // A public Video's Learning Layer, for the player's tracks and help.
  route("videos/:itemId/captions/:language", "routes/public/captions.ts"),
  route("videos/:itemId/english/:segmentId", "routes/public/english-line.ts"),
  // Staff tools, served only on the admin host; staff sign in with an emailed link (ADR-0016).
  ...prefix("admin", [
    layout("routes/admin/layout.tsx", [
      index("routes/admin/home.tsx"),
      route("sign-in", "routes/admin/sign-in.tsx"),
      route("sign-in/link", "routes/admin/sign-in-link.tsx"),
      route("sign-out", "routes/admin/sign-out.ts"),
      route("items", "routes/admin/items.tsx"),
      route("items/:id", "routes/admin/item.tsx"),
      route("items/:id/layer", "routes/admin/layer.tsx"),
      route("rights/evidence/:recordId", "routes/admin/evidence.ts"),
      route("rights/:type/:id", "routes/admin/rights.tsx"),
      route("media", "routes/admin/media.tsx"),
      route("media/upload", "routes/admin/media-upload.ts"),
      route("topics", "routes/admin/topics.tsx"),
      route("submissions", "routes/admin/submissions.tsx", { id: "submissions" }),
      route("submissions/:id", "routes/admin/submissions.tsx", { id: "submission" }),
      route("staff", "routes/admin/staff.tsx"),
      route("audit", "routes/admin/audit.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
