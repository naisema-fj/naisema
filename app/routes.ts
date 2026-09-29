import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // Staff tools, served only on the admin host (workers/app.ts, ADR-0005).
  ...prefix("admin", [
    index("routes/admin/home.tsx"),
    route("sign-in", "routes/admin/sign-in.tsx"),
    route("sign-out", "routes/admin/sign-out.tsx"),
    route("staff", "routes/admin/staff.tsx"),
    route("two-factor", "routes/admin/two-factor.tsx"),
    route("two-factor/setup", "routes/admin/two-factor-setup.tsx"),
  ]),
] satisfies RouteConfig;
