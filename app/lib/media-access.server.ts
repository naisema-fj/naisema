import { can } from "./permissions";
import { requireStaff } from "./staff.server";

/** The staff gate for uploading and the media library: editors and Educators (`media.upload`). */
export async function requireUploader(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  if (!can(staff.actor, { action: "media.upload" })) {
    throw Response.json({ error: "Only editors and Educators can upload files." }, { status: 403 });
  }
  return staff;
}
