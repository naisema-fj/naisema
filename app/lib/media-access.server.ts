import { can } from "./permissions";
import { requireStaff } from "./staff.server";

/** The staff gate for uploading and the media library: editors and Educators (`media.upload`). */
export async function requireUploader(env: Env, request: Request) {
  const staff = await requireStaff(env, request);
  if (!can(staff.actor, { action: "media.upload" })) {
    throw new Response("Only editors and Educators can upload files or use the media library.", { status: 403 });
  }
  return staff;
}
