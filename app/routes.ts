import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
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
