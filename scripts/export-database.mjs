// Exports a D1 database to a SQL file, the portable copy beside D1 Time Travel's 30 days
// (ADR-0015): `pnpm db:export <staging|production> [file]`. Run it by hand before anything risky
// to the database alone; `pnpm backup` also copies the media and evidence, as the weekly backup
// does. The file holds personal data (staff addresses and form submissions): keep it in the
// NAISEMA Drive, never in the repository.
import { wrangler } from "./wrangler.mjs";

const [target, file = `naisema-${process.argv[2]}-${new Date().toISOString().slice(0, 10)}.sql`] =
  process.argv.slice(2);
if (!["staging", "production"].includes(target)) {
  console.error("Usage: pnpm db:export <staging|production> [file]");
  process.exit(1);
}
wrangler(["d1", "export", "DB", "--remote", "--env", target, "--output", file]);
console.log(`Exported to ${file}`);
