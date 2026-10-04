import { env } from "cloudflare:test";
import { expect } from "vitest";
import { getDb } from "~/lib/db.server";
import { type Scanner, scanUpload } from "~/lib/scan.server";
import { localProvider } from "~/lib/video-provider.server";
import { mp4 } from "../../fixtures/mp4";
import type { Staff } from "./articles";
import { completeUpload, sendPart, startUpload } from "./media";

/** Stands in for ClamAV: reads the whole file, as the real scanner does, and passes it. */
export const cleanScanner: Scanner = async ({ body }) => {
  await new Response(body).arrayBuffer();
  return { verdict: "clean" };
};

/** A video master uploaded, scanned and "processed" by the local stand-in: a ready Video Asset. */
export async function readyVideoAsset(uploader: Staff, video: { seconds: number; width?: number; height?: number }) {
  const bytes = mp4(video);
  const started = await startUpload(uploader.browser, {
    name: "talanoa.mp4",
    type: "video/mp4",
    size: bytes.length,
    head: bytes,
  });
  expect(started.status).toBe(201);
  const { id } = (await started.json()) as { id: string };
  expect((await sendPart(uploader.browser, id, 1, bytes)).status).toBe(200);
  expect((await completeUpload(uploader.browser, id)).status).toBe(200);
  expect(await scanUpload(env, getDb(env.DB), id, cleanScanner, localProvider(env))).toBe("clean");
  return id;
}
