import { TableScroll } from "~/components/table-scroll";
import { WhatsThis } from "~/components/whats-this";
import { cloudflareContext } from "~/lib/cloudflare";
import { getDb } from "~/lib/db.server";
import { formatDay } from "~/lib/rights-rules";
import { SOUND_GROUP_NAMES } from "~/lib/sound-rules";
import { loadSounds, mayUseSounds } from "~/lib/sounds.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/sounds";

/**
 * /admin/sounds: the letters of the sound guide and where each stands. Editors change the wording
 * and attach recordings; a Language Reviewer approves what they have listened to (change note 0003).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const actor = await requireStaff(env, request);
  if (!mayUseSounds(actor)) throw new Response("Your roles don't allow this page.", { status: 403 });
  const sounds = await loadSounds(getDb(env.DB));
  return {
    sounds: sounds.map(({ row, review }) => ({
      id: row.id,
      display: row.display,
      group: SOUND_GROUP_NAMES[row.group],
      ipa: row.ipa,
      recording: row.mediaId ? "In the media library" : row.previewAudio ? "Preview file only" : "None",
      reviewed: review.state === "reviewed",
      by: review.state === "reviewed" ? review.by : null,
      on: review.state === "reviewed" ? formatDay(review.at) : null,
    })),
  };
}

export function meta() {
  return [{ title: "Sound guide · NAISEMA staff" }];
}

export default function Sounds({ loaderData }: Route.ComponentProps) {
  const { sounds } = loaderData;
  const reviewed = sounds.filter((entry) => entry.reviewed).length;
  return (
    <main id="main" className="page">
      <h1>Sound guide</h1>
      <p>
        {reviewed} of {sounds.length} sounds reviewed. The public page is{" "}
        <a href="/apps/dictionary/pronunciation/">the pronunciation library</a>.
      </p>
      <WhatsThis summary="How the sound guide works">
        <ul>
          <li>
            <strong>Each letter has its own review.</strong> A Language Reviewer approves a sound's wording together
            with the recording it is heard with. Changing either makes it a draft again until it is approved anew.
          </li>
          <li>
            <strong>Recordings</strong> come from the media library. Upload the file there, add a Rights Record that
            names the speaker and grants Publish, then choose it on the sound. Until then the page plays the preview's
            own file.
          </li>
          <li>
            <strong>The IPA and English comparisons</strong> describe expected sounds. They do not certify a particular
            recording, so a reviewer must listen before approving.
          </li>
        </ul>
      </WhatsThis>
      <TableScroll label="Sounds">
        <table>
          <caption className="visually-hidden">The sounds in the guide, in order</caption>
          <thead>
            <tr>
              <th scope="col">Letter</th>
              <th scope="col">Kind</th>
              <th scope="col">IPA</th>
              <th scope="col">Recording</th>
              <th scope="col">Review</th>
            </tr>
          </thead>
          <tbody>
            {sounds.map((entry) => (
              <tr key={entry.id}>
                <th scope="row">
                  <a href={`/admin/sounds/${entry.id}`}>{entry.display}</a>
                </th>
                <td>{entry.group}</td>
                <td>{entry.ipa ? `/${entry.ipa}/` : "None"}</td>
                <td>{entry.recording}</td>
                <td>{entry.reviewed ? `Reviewed by ${entry.by}, ${entry.on}` : "Draft"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </main>
  );
}
