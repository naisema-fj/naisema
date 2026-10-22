import { Form } from "react-router";
import { TableScroll } from "~/components/table-scroll";
import { listBackups } from "~/lib/backup.server";
import { cloudflareContext } from "~/lib/cloudflare";
import { formatMoment } from "~/lib/monitor-rules";
import { can } from "~/lib/permissions";
import { finishRestore, restoreStatus } from "~/lib/restore.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/restore";

export const handle = { hydrate: false };

export function meta() {
  return [{ title: "Backups and restoring · NAISEMA staff" }, { name: "robots", content: "noindex" }];
}

const size = (bytes: number) =>
  bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} kB` : `${(bytes / 1_000_000).toFixed(1)} MB`;

async function requireRestorer(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  if (!can(staff.actor, { action: "restore.run" })) {
    throw new Response("Only administrators can see backups or finish a restore.", { status: 403 });
  }
  return staff;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  await requireRestorer(env, request);
  const backups = await listBackups(env.BACKUPS);
  return {
    ...(await restoreStatus(env)),
    backups: backups.map((backup) => ({
      key: backup.key,
      size: size(backup.size),
      taken: formatMoment(backup.uploaded),
    })),
  };
}

/** Replays the deletion ledger on the database, then reopens the site if every entry was applied. */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { db, actor } = await requireRestorer(env, request);
  return finishRestore(env, db, actor.userId);
}

export default function Restore({ loaderData, actionData }: Route.ComponentProps) {
  const { locked, learnerEntries, objectEntries, backups } = loaderData;
  return (
    <main id="main" className="page">
      <p>
        <a href="/admin">Back to staff home</a>
      </p>
      <h1>Backups and restoring</h1>
      <p>
        The database is backed up every night, encrypted, and kept for 35 days. The steps for restoring one are in the
        runbook (backups and restoring).
      </p>

      <h2>Finish a restore</h2>
      {locked ? (
        <p role="status">
          <strong>The public site is closed for a restore.</strong> Once the database has been restored, replay the
          deletion ledger below. The site reopens when every entry has been applied.
        </p>
      ) : (
        <p>
          The public site is open. Replaying the ledger is safe at any time, but a restore must do it before reopening.
        </p>
      )}
      <p>
        The deletion ledger holds {learnerEntries} learner {learnerEntries === 1 ? "entry" : "entries"} and{" "}
        {objectEntries} other {objectEntries === 1 ? "entry" : "entries"}.
      </p>
      {actionData && (
        <p role="status">
          Replayed: {actionData.learners} Learner {actionData.learners === 1 ? "Account" : "Accounts"} and{" "}
          {actionData.objects} other {actionData.objects === 1 ? "record" : "records"} deleted again.{" "}
          {actionData.reopened
            ? "The public site is open."
            : `The site stays closed: the replay doesn't know how to delete ${actionData.unknown.join(", ")}. Delete those by hand and run it again.`}
        </p>
      )}
      <Form method="post">
        <button type="submit">Replay the deletion ledger{locked ? " and reopen the site" : ""}</button>
      </Form>

      <h2>Backups held</h2>
      {backups.length ? (
        <TableScroll label="Nightly database backups">
          <table>
            <caption className="visually-hidden">Nightly database backups</caption>
            <thead>
              <tr>
                <th scope="col">Backup</th>
                <th scope="col">Stored</th>
                <th scope="col">Size</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.key}>
                  <th scope="row">{backup.key}</th>
                  <td>{backup.taken}</td>
                  <td>{backup.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : (
        <p>No backup has been taken yet.</p>
      )}
    </main>
  );
}
