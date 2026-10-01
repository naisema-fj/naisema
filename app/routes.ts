import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes";
import { INFO_PAGES } from "./lib/info-pages";

export default [
  // The public site: edge-cached, no client JavaScript, eligible content only (ADR-0007).
  layout("routes/public/layout.tsx", [
    index("routes/home.tsx"),
    ...INFO_PAGES.map((page) => route(page.path, "routes/public/info.tsx", { id: `info-${page.path}` })),
    route(":area", "routes/public/area.tsx"),
    route(":area/:slug", "routes/public/article.tsx"),
  ]),
  route("sitemap.xml", "routes/public/sitemap.ts"),
  route("robots.txt", "routes/public/robots.ts"),
  // Staff tools, served only on the admin host (workers/app.ts, ADR-0005).
  ...prefix("admin", [
    index("routes/admin/home.tsx"),
    route("articles", "routes/admin/articles/index.tsx"),
    route("articles/new", "routes/admin/articles/new.tsx"),
    route("articles/:id", "routes/admin/articles/edit.tsx"),
    route("articles/:id/history", "routes/admin/articles/history.tsx"),
    route("articles/:id/revisions/:number", "routes/admin/articles/revision.tsx"),
    route("articles/:id/compare", "routes/admin/articles/compare.tsx"),
    route("articles/:id/rights", "routes/admin/articles/rights.tsx"),
    route("contributors", "routes/admin/contributors.tsx"),
    route("rights/:recordId/evidence", "routes/admin/rights/evidence.tsx"),
    route("sign-in", "routes/admin/sign-in.tsx"),
    route("sign-out", "routes/admin/sign-out.tsx"),
    route("reviews", "routes/admin/reviews.tsx"),
    route("staff", "routes/admin/staff.tsx"),
    route("topics", "routes/admin/topics.tsx"),
    route("two-factor", "routes/admin/two-factor.tsx"),
    route("two-factor/setup", "routes/admin/two-factor-setup.tsx"),
  ]),
] satisfies RouteConfig;
