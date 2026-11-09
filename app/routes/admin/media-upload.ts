import { cloudflareContext } from "~/lib/cloudflare";
import { Refused } from "~/lib/content.server";
import { getDb } from "~/lib/db.server";
import { uploadFile } from "~/lib/media.server";
import { requireStaff } from "~/lib/staff.server";
import type { Route } from "./+types/media-upload";

/**
 * PUT /admin/media/upload?name=&alt=&width=&height=&durationMs=: one file, as the request body,
 * into the media library. The size, length and dimensions are what the uploader's browser read.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  if (request.method !== "PUT") return Response.json({ error: "Send the file with PUT." }, { status: 405 });
  const actor = await requireStaff(env, request, "media.upload");
  const query = new URL(request.url).searchParams;
  const number = (name: string) => Number(query.get(name) ?? "") || undefined;
  try {
    const { id } = await uploadFile(env, getDb(env.DB), actor, request, "media", {
      name: query.get("name") ?? "",
      alt: query.get("alt") ?? "",
      width: number("width"),
      height: number("height"),
      durationMs: number("durationMs"),
    });
    return Response.json({ id });
  } catch (error) {
    if (error instanceof Refused) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
